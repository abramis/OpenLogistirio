import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ClientCompany,
  DocumentType,
  MyDataReconciliationStatus,
  MyDataSyncRunStatus,
  MyDataSyncSource,
  MyDataStatus,
  MyDataTransmissionMode,
  Prisma,
  TransmissionStatus,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { AadeMyDataTestProvider } from './aade-mydata-test.provider';
import {
  FindMyDataReconciliationQueryDto,
  SyncMyDataDocsDto,
  SyncMyDataDocsSourceDto,
} from './dto/sync-mydata-docs.dto';
import { MockMyDataProvider } from './mydata-mock.service';
import { MyDataMappingService } from './mydata-mapping.service';
import { MyDataProvider, MyDataTransmissionResponse } from './mydata-provider.interface';

interface MyDataSendOptions {
  force?: boolean;
}

interface NormalizedAadeDocument {
  mark: string;
  uid?: string;
  qrUrl?: string;
  issuerVatNumber?: string;
  counterpartyVatNumber?: string;
  invoiceType?: string;
  series?: string;
  documentNumber: string;
  issueDate?: Date;
  netAmount?: Prisma.Decimal;
  vatAmount?: Prisma.Decimal;
  totalAmount?: Prisma.Decimal;
  rawPayload: Prisma.InputJsonValue;
}

@Injectable()
export class MyDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mappingService: MyDataMappingService,
    private readonly mockProvider: MockMyDataProvider,
    private readonly aadeTestProvider: AadeMyDataTestProvider,
  ) {}

  async prepare(tenant: TenantContext, documentId: string) {
    const document = await this.getTenantDocument(tenant, documentId);
    this.ensureNotAlreadySent(document);
    const xml = this.mappingService.mapDocumentToXml(document);

    await this.prisma.document.update({
      where: { id: document.id },
      data: {
        myDataStatus: MyDataStatus.READY_TO_SEND,
        myDataXmlPreview: xml,
      },
    });

    const attempt = await this.prisma.transmissionAttempt.create({
      data: {
        documentId: document.id,
        provider: this.mockProvider.providerName,
        environment: 'preview',
        correlationId: randomUUID(),
        status: TransmissionStatus.PREPARED,
        requestPayload: xml,
        responsePayload: { previewOnly: true },
      },
    });

    return {
      documentId: document.id,
      status: MyDataStatus.READY_TO_SEND,
      xml,
      attempt,
    };
  }

  async sendMock(tenant: TenantContext, documentId: string, options: MyDataSendOptions = {}) {
    return this.sendWithProvider(tenant, documentId, this.mockProvider, options);
  }

  async sendTest(tenant: TenantContext, documentId: string, options: MyDataSendOptions = {}) {
    return this.sendWithProvider(tenant, documentId, this.aadeTestProvider, options);
  }

  async prepareExpense(tenant: TenantContext, documentId: string) {
    const document = await this.getTenantDocument(tenant, documentId);
    this.ensurePurchaseInvoice(document.documentType);
    this.ensureNotAlreadySent(document);
    const xml = this.mappingService.mapPurchaseDocumentToExpenseClassificationXml(document);

    await this.prisma.document.update({
      where: { id: document.id },
      data: {
        myDataStatus: MyDataStatus.READY_TO_SEND,
        myDataXmlPreview: xml,
        classificationStatus: 'EXPENSE_PREPARED',
      },
    });

    const attempt = await this.prisma.transmissionAttempt.create({
      data: {
        documentId: document.id,
        provider: 'expense-classification-preview',
        environment: 'preview',
        correlationId: randomUUID(),
        status: TransmissionStatus.PREPARED,
        requestPayload: xml,
        responsePayload: { previewOnly: true, flow: 'receiver-expense-classification' },
      },
    });

    return {
      documentId: document.id,
      status: MyDataStatus.READY_TO_SEND,
      xml,
      attempt,
    };
  }

  async sendExpenseMock(tenant: TenantContext, documentId: string) {
    const document = await this.getTenantDocument(tenant, documentId);
    this.ensurePurchaseInvoice(document.documentType);
    this.ensureNotAlreadySent(document);
    const xml =
      document.myDataXmlPreview ??
      this.mappingService.mapPurchaseDocumentToExpenseClassificationXml(document);
    const mark = `MOCK-EXPENSE-MARK-${document.id}`;
    const uid = `MOCK-EXPENSE-UID-${document.id}`;

    await this.prisma.document.update({
      where: { id: document.id },
      data: {
        myDataStatus: MyDataStatus.SENT,
        myDataMark: mark,
        myDataUid: uid,
        myDataQrUrl: `https://mydata.example.invalid/mock-expense/${document.id}`,
        myDataXmlPreview: xml,
        classificationStatus: 'EXPENSE_CLASSIFIED_MOCK',
      },
    });

    const attempt = await this.prisma.transmissionAttempt.create({
      data: {
        documentId: document.id,
        provider: 'mock-mydata-expense',
        environment: 'mock',
        correlationId: randomUUID(),
        status: TransmissionStatus.SENT,
        requestPayload: xml,
        responsePayload: {
          status: 'sent',
          mark,
          uid,
          flow: 'receiver-expense-classification',
        },
      },
    });

    return {
      documentId: document.id,
      status: MyDataStatus.SENT,
      mark,
      uid,
      attempt,
    };
  }

  private async sendWithProvider(
    tenant: TenantContext,
    documentId: string,
    provider: MyDataProvider,
    options: MyDataSendOptions,
  ) {
    const document = await this.getTenantDocument(tenant, documentId);
    this.ensureNotAlreadySent(document, options.force);
    const xml = document.myDataXmlPreview ?? this.mappingService.mapDocumentToXml(document);
    const correlationId = randomUUID();

    try {
      const response = await provider.transmitInvoice({
        documentId: document.id,
        payloadXml: xml,
        credentialEnvPrefix: this.resolveCredentialEnvPrefix(provider, document.clientCompany),
        force: options.force,
      });

      if (response.status === 'failed') {
        return this.recordFailedTransmission(
          document.id,
          xml,
          provider.providerName,
          response.errorMessage,
          response.errorCode ?? 'MYDATA_FAILED',
          response.rawResponse,
          {
            environment: response.environment,
            endpoint: response.endpoint,
            correlationId,
            forcedRetry: options.force === true,
          },
        );
      }

      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          myDataStatus: MyDataStatus.SENT,
          myDataMark: response.mark,
          myDataUid: response.uid,
          myDataQrUrl: response.qrUrl,
          myDataXmlPreview: xml,
        },
      });

      const attempt = await this.prisma.transmissionAttempt.create({
        data: {
          documentId: document.id,
          provider: provider.providerName,
          environment: response.environment ?? this.resolveAttemptEnvironment(provider),
          endpoint: response.endpoint,
          correlationId,
          forcedRetry: options.force === true,
          status: TransmissionStatus.SENT,
          requestPayload: xml,
          responsePayload: this.toResponsePayload(response),
        },
      });

      return {
        documentId: document.id,
        status: MyDataStatus.SENT,
        mark: response.mark,
        uid: response.uid,
        qrUrl: response.qrUrl,
        environment: response.environment ?? this.resolveAttemptEnvironment(provider),
        attempt,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'myDATA transmission failed.';
      return this.recordFailedTransmission(
        document.id,
        xml,
        provider.providerName,
        message,
        'MYDATA_EXCEPTION',
        undefined,
        {
          environment: this.resolveAttemptEnvironment(provider),
          correlationId,
          forcedRetry: options.force === true,
        },
      );
    }
  }

  async history(tenant: TenantContext, documentId: string) {
    const document = await this.getTenantDocument(tenant, documentId);

    return this.prisma.transmissionAttempt.findMany({
      where: { documentId: document.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async syncRequestDocs(tenant: TenantContext, dto: SyncMyDataDocsDto) {
    const clientCompany = await this.getTenantClientCompany(tenant, dto.clientCompanyId);
    const source = dto.source ?? SyncMyDataDocsSourceDto.REQUEST_DOCS;
    const mark = dto.mark ?? '0';
    const credentialEnvPrefix = this.resolveCredentialEnvPrefix(
      this.aadeTestProvider,
      clientCompany,
    );

    if (!this.aadeTestProvider.requestDocs) {
      throw new BadRequestException('The configured myDATA provider does not support RequestDocs.');
    }

    const request = {
      source,
      mark,
      entityVatNumber: clientCompany.vatNumber,
      counterVatNumber: dto.counterVatNumber,
      dateFrom: dto.dateFrom ? formatAadeDate(dto.dateFrom) : undefined,
      dateTo: dto.dateTo ? formatAadeDate(dto.dateTo) : undefined,
      invType: dto.invType,
      maxMark: dto.maxMark,
      credentialEnvPrefix,
    };

    const response = await this.aadeTestProvider.requestDocs(request);

    if (response.status === 'failed') {
      const failedRun = await this.prisma.myDataSyncRun.create({
        data: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: clientCompany.id,
          source: source as MyDataSyncSource,
          status: MyDataSyncRunStatus.FAILED,
          environment: response.environment,
          endpoint: response.endpoint,
          markFrom: mark,
          maxMark: dto.maxMark,
          dateFrom: dto.dateFrom ? new Date(dto.dateFrom) : undefined,
          dateTo: dto.dateTo ? new Date(dto.dateTo) : undefined,
          errorMessage: response.errorMessage,
          rawResponse: this.toJsonValue(response.rawResponse),
        },
      });

      throw new BadGatewayException({
        message: response.errorMessage ?? 'AADE myDATA RequestDocs failed.',
        syncRunId: failedRun.id,
      });
    }

    const syncRun = await this.prisma.myDataSyncRun.create({
      data: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: clientCompany.id,
        source: source as MyDataSyncSource,
        status: MyDataSyncRunStatus.COMPLETED,
        environment: response.environment,
        endpoint: response.endpoint,
        markFrom: mark,
        maxMark: dto.maxMark,
        dateFrom: dto.dateFrom ? new Date(dto.dateFrom) : undefined,
        dateTo: dto.dateTo ? new Date(dto.dateTo) : undefined,
        rawResponse: this.toJsonValue(response.rawResponse),
      },
    });

    const normalizedDocuments = this.normalizeAadeDocuments(response.rawResponse);
    let matchedCount = 0;
    let mismatchCount = 0;

    for (const normalizedDocument of normalizedDocuments) {
      const reconciliation = await this.reconcileAadeDocument(
        tenant,
        clientCompany,
        source as MyDataSyncSource,
        normalizedDocument,
      );

      if (reconciliation.status === MyDataReconciliationStatus.MATCHED) {
        matchedCount += 1;
      } else {
        mismatchCount += 1;
      }

      await this.prisma.myDataSnapshot.upsert({
        where: {
          clientCompanyId_source_mark: {
            clientCompanyId: clientCompany.id,
            source: source as MyDataSyncSource,
            mark: normalizedDocument.mark,
          },
        },
        create: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: clientCompany.id,
          syncRunId: syncRun.id,
          matchedDocumentId: reconciliation.documentId,
          source: source as MyDataSyncSource,
          reconciliationStatus: reconciliation.status,
          reconciliationIssues: reconciliation.issues,
          mark: normalizedDocument.mark,
          uid: normalizedDocument.uid,
          qrUrl: normalizedDocument.qrUrl,
          issuerVatNumber: normalizedDocument.issuerVatNumber,
          counterpartyVatNumber: normalizedDocument.counterpartyVatNumber,
          invoiceType: normalizedDocument.invoiceType,
          series: normalizedDocument.series,
          documentNumber: normalizedDocument.documentNumber,
          issueDate: normalizedDocument.issueDate,
          netAmount: normalizedDocument.netAmount,
          vatAmount: normalizedDocument.vatAmount,
          totalAmount: normalizedDocument.totalAmount,
          rawPayload: normalizedDocument.rawPayload,
        },
        update: {
          syncRunId: syncRun.id,
          matchedDocumentId: reconciliation.documentId,
          reconciliationStatus: reconciliation.status,
          reconciliationIssues: reconciliation.issues,
          uid: normalizedDocument.uid,
          qrUrl: normalizedDocument.qrUrl,
          issuerVatNumber: normalizedDocument.issuerVatNumber,
          counterpartyVatNumber: normalizedDocument.counterpartyVatNumber,
          invoiceType: normalizedDocument.invoiceType,
          series: normalizedDocument.series,
          documentNumber: normalizedDocument.documentNumber,
          issueDate: normalizedDocument.issueDate,
          netAmount: normalizedDocument.netAmount,
          vatAmount: normalizedDocument.vatAmount,
          totalAmount: normalizedDocument.totalAmount,
          rawPayload: normalizedDocument.rawPayload,
          fetchedAt: new Date(),
        },
      });
    }

    const updatedRun = await this.prisma.myDataSyncRun.update({
      where: { id: syncRun.id },
      data: {
        fetchedCount: normalizedDocuments.length,
        matchedCount,
        mismatchCount,
      },
    });

    return {
      syncRun: updatedRun,
      fetchedCount: normalizedDocuments.length,
      matchedCount,
      mismatchCount,
      nextPartitionKey: findFirstValue(response.rawResponse, ['nextPartitionKey']),
      nextRowKey: findFirstValue(response.rawResponse, ['nextRowKey']),
    };
  }

  async findReconciliation(tenant: TenantContext, query: FindMyDataReconciliationQueryDto) {
    const clientCompany = await this.getTenantClientCompany(tenant, query.clientCompanyId);
    const take = Math.min(Math.max(Number(query.take ?? 100), 1), 500);

    return this.prisma.myDataSnapshot.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: clientCompany.id,
        source: query.source as MyDataSyncSource | undefined,
        reconciliationStatus: query.status as MyDataReconciliationStatus | undefined,
        issueDate:
          query.dateFrom || query.dateTo
            ? {
                gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
                lte: query.dateTo ? new Date(query.dateTo) : undefined,
              }
            : undefined,
      },
      include: {
        matchedDocument: {
          select: {
            id: true,
            documentType: true,
            series: true,
            documentNumber: true,
            issueDate: true,
            counterpartyName: true,
            counterpartyVatNumber: true,
            netAmount: true,
            vatAmount: true,
            totalAmount: true,
            myDataStatus: true,
            myDataMark: true,
          },
        },
        syncRun: {
          select: {
            id: true,
            createdAt: true,
            environment: true,
            endpoint: true,
          },
        },
      },
      orderBy: [{ issueDate: 'desc' }, { fetchedAt: 'desc' }],
      take,
    });
  }

  async capabilities(tenant: TenantContext, documentId: string) {
    const document = await this.getTenantDocument(tenant, documentId);
    const supportsSendInvoices = this.supportsSendInvoices(document.documentType);
    const supportsExpenseReceiver = document.documentType === DocumentType.PURCHASE_INVOICE;
    const alreadySent = document.myDataStatus === MyDataStatus.SENT;
    const configuration = this.describeClientConfiguration(document.clientCompany);
    const blockers: string[] = [];

    if (!supportsSendInvoices && !supportsExpenseReceiver) {
      blockers.push('Ο τύπος παραστατικού δεν υποστηρίζεται από την τρέχουσα myDATA ροή.');
    }

    if (supportsSendInvoices && !configuration.canUseApi) {
      blockers.push(configuration.reason);
    }

    if (alreadySent) {
      blockers.push('Το παραστατικό έχει ήδη διαβιβαστεί. Νέα αποστολή χρειάζεται forced retry.');
    }

    return {
      documentId: document.id,
      flow: supportsSendInvoices
        ? 'issued-send-invoices'
        : supportsExpenseReceiver
          ? 'receiver-expense-classification-preview'
          : 'unsupported',
      status: document.myDataStatus,
      mark: document.myDataMark,
      canPrepare: (supportsSendInvoices || supportsExpenseReceiver) && !alreadySent,
      canSendMock: supportsSendInvoices && !alreadySent,
      canSendAade: supportsSendInvoices && configuration.canUseApi && !alreadySent,
      canForceResend: supportsSendInvoices && alreadySent && configuration.canUseApi,
      canPrepareExpense: supportsExpenseReceiver && !alreadySent,
      canSendExpenseMock: supportsExpenseReceiver && !alreadySent,
      configuration,
      blockers,
    };
  }

  private async recordFailedTransmission(
    documentId: string,
    xml: string,
    providerName: string,
    message = 'myDATA transmission failed.',
    code = 'MYDATA_FAILED',
    rawResponse?: unknown,
    metadata: {
      environment?: string;
      endpoint?: string;
      correlationId?: string;
      forcedRetry?: boolean;
    } = {},
  ): Promise<never> {
    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        myDataStatus: MyDataStatus.FAILED,
        myDataXmlPreview: xml,
      },
    });

    await this.prisma.transmissionAttempt.create({
      data: {
        documentId,
        provider: providerName,
        environment: metadata.environment,
        endpoint: metadata.endpoint,
        correlationId: metadata.correlationId,
        forcedRetry: metadata.forcedRetry ?? false,
        status: TransmissionStatus.FAILED,
        requestPayload: xml,
        errorCode: code,
        errorMessage: message,
        responsePayload: {
          status: 'failed',
          errorCode: code,
          errorMessage: message,
          rawResponse: this.toJsonValue(rawResponse),
        },
      },
    });

    throw new BadGatewayException(message);
  }

  private async getTenantDocument(tenant: TenantContext, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        accountingOfficeId: tenant.accountingOfficeId,
        deletedAt: null,
      },
      include: {
        clientCompany: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Document was not found.');
    }

    return document;
  }

  private async getTenantClientCompany(tenant: TenantContext, clientCompanyId: string) {
    const clientCompany = await this.prisma.clientCompany.findFirst({
      where: {
        id: clientCompanyId,
        accountingOfficeId: tenant.accountingOfficeId,
        deletedAt: null,
      },
    });

    if (!clientCompany) {
      throw new NotFoundException('Client company was not found.');
    }

    return clientCompany;
  }

  private resolveCredentialEnvPrefix(
    provider: MyDataProvider,
    clientCompany: ClientCompany,
  ): string | undefined {
    if (provider.providerName !== this.aadeTestProvider.providerName) {
      return undefined;
    }

    switch (clientCompany.myDataMode) {
      case MyDataTransmissionMode.ACCOUNTING_OFFICE_AUTHORIZED:
        if (!clientCompany.myDataAuthorized) {
          throw new BadRequestException(
            'Ο πελάτης δεν έχει σημειωθεί ως εξουσιοδοτημένος για αποστολή myDATA από το λογιστικό γραφείο.',
          );
        }
        return 'AADE_MYDATA';

      case MyDataTransmissionMode.OWN_API_CREDENTIALS_ENV_REF:
        return this.resolveClientCredentialEnvPrefix(clientCompany);

      case MyDataTransmissionMode.MANUAL_UPLOAD:
        throw new BadRequestException(
          'Ο πελάτης είναι ρυθμισμένος για χειροκίνητη αποστολή/ανέβασμα και όχι API send.',
        );

      case MyDataTransmissionMode.NOT_CONFIGURED:
      default:
        throw new BadRequestException(
          'Δεν έχει ολοκληρωθεί η ρύθμιση myDATA για αυτόν τον πελάτη.',
        );
    }
  }

  private resolveClientCredentialEnvPrefix(clientCompany: ClientCompany): string {
    const credentialRef = clientCompany.myDataCredentialRef?.trim();

    if (!credentialRef || !/^[A-Z0-9_]+$/.test(credentialRef)) {
      throw new BadRequestException(
        'Λείπει έγκυρο myDATA credential env reference για τον πελάτη.',
      );
    }

    return `AADE_MYDATA_${credentialRef}`;
  }

  private ensurePurchaseInvoice(documentType: DocumentType): void {
    if (documentType !== DocumentType.PURCHASE_INVOICE) {
      throw new BadRequestException('This myDATA receiver flow supports purchase invoices only.');
    }
  }

  private toResponsePayload(response: MyDataTransmissionResponse): Prisma.InputJsonValue {
    return {
      status: response.status,
      environment: response.environment ?? null,
      endpoint: response.endpoint ?? null,
      httpStatus: response.httpStatus ?? null,
      mark: response.mark ?? null,
      uid: response.uid ?? null,
      qrUrl: response.qrUrl ?? null,
      errorCode: response.errorCode ?? null,
      errorMessage: response.errorMessage ?? null,
      rawResponse: this.toJsonValue(response.rawResponse),
    };
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    if (value === undefined) {
      return null as unknown as Prisma.InputJsonValue;
    }

    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private normalizeAadeDocuments(rawResponse: unknown): NormalizedAadeDocument[] {
    return collectInvoicePayloads(rawResponse).map((invoice, index) => {
      const header = findObjectValue(invoice, 'invoiceHeader');
      const issuer = findObjectValue(invoice, 'issuer');
      const counterpart = findObjectValue(invoice, 'counterpart');
      const summary = findObjectValue(invoice, 'invoiceSummary');
      const mark =
        findFirstValue(invoice, ['invoiceMark', 'mark']) ??
        findFirstValue(rawResponse, ['invoiceMark', 'mark']) ??
        findFirstValue(invoice, ['uid', 'invoiceUid']) ??
        `NO_MARK_${index + 1}`;

      return {
        mark,
        uid: findFirstValue(invoice, ['invoiceUid', 'uid']),
        qrUrl: findFirstValue(invoice, ['qrUrl', 'qrCodeUrl']),
        issuerVatNumber: findFirstValue(issuer, ['vatNumber']),
        counterpartyVatNumber: findFirstValue(counterpart, ['vatNumber']),
        invoiceType: findFirstValue(header, ['invoiceType']),
        series: emptyStringToUndefined(findFirstValue(header, ['series'])),
        documentNumber: findFirstValue(header, ['aa', 'documentNumber']) ?? mark,
        issueDate: parseAadeDate(findFirstValue(header, ['issueDate'])),
        netAmount: toDecimal(findFirstValue(summary, ['totalNetValue'])),
        vatAmount: toDecimal(findFirstValue(summary, ['totalVatAmount'])),
        totalAmount: toDecimal(findFirstValue(summary, ['totalGrossValue'])),
        rawPayload: this.toJsonValue(invoice),
      };
    });
  }

  private async reconcileAadeDocument(
    tenant: TenantContext,
    clientCompany: ClientCompany,
    source: MyDataSyncSource,
    aadeDocument: NormalizedAadeDocument,
  ): Promise<{
    documentId?: string;
    status: MyDataReconciliationStatus;
    issues: Prisma.InputJsonValue;
  }> {
    const candidates = await this.findReconciliationCandidates(
      tenant,
      clientCompany,
      source,
      aadeDocument,
    );
    const document = candidates[0];

    if (!document) {
      return {
        status: MyDataReconciliationStatus.MISSING_INTERNAL,
        issues: { missing: ['internalDocument'] },
      };
    }

    const issues: string[] = [];
    const expectedDocumentType = mapAadeInvoiceTypeToInternalDocumentType(
      source,
      aadeDocument.invoiceType,
    );

    if (expectedDocumentType && document.documentType !== expectedDocumentType) {
      issues.push('documentType');
    }

    if (
      aadeDocument.issueDate &&
      document.issueDate.toISOString().slice(0, 10) !==
        aadeDocument.issueDate.toISOString().slice(0, 10)
    ) {
      issues.push('issueDate');
    }

    if (aadeDocument.totalAmount && decimalDiffers(document.totalAmount, aadeDocument.totalAmount)) {
      issues.push('totalAmount');
    }

    if (aadeDocument.netAmount && decimalDiffers(document.netAmount, aadeDocument.netAmount)) {
      issues.push('netAmount');
    }

    if (aadeDocument.vatAmount && decimalDiffers(document.vatAmount, aadeDocument.vatAmount)) {
      issues.push('vatAmount');
    }

    const expectedCounterpartyVat =
      source === MyDataSyncSource.REQUEST_DOCS
        ? aadeDocument.issuerVatNumber
        : aadeDocument.counterpartyVatNumber;

    if (
      expectedCounterpartyVat &&
      document.counterpartyVatNumber &&
      normalizeVat(document.counterpartyVatNumber) !== normalizeVat(expectedCounterpartyVat)
    ) {
      issues.push('counterpartyVatNumber');
    }

    return {
      documentId: document.id,
      status: toReconciliationStatus(issues),
      issues: { fields: issues },
    };
  }

  private async findReconciliationCandidates(
    tenant: TenantContext,
    clientCompany: ClientCompany,
    source: MyDataSyncSource,
    aadeDocument: NormalizedAadeDocument,
  ) {
    const byMark = await this.prisma.document.findFirst({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: clientCompany.id,
        deletedAt: null,
        OR: [
          { myDataMark: aadeDocument.mark },
          ...(aadeDocument.uid ? [{ myDataUid: aadeDocument.uid }] : []),
        ],
      },
    });

    if (byMark) {
      return [byMark];
    }

    const expectedCounterpartyVat =
      source === MyDataSyncSource.REQUEST_DOCS
        ? aadeDocument.issuerVatNumber
        : aadeDocument.counterpartyVatNumber;

    return this.prisma.document.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: clientCompany.id,
        deletedAt: null,
        documentNumber: aadeDocument.documentNumber,
        issueDate: aadeDocument.issueDate
          ? {
              gte: startOfDay(aadeDocument.issueDate),
              lte: endOfDay(aadeDocument.issueDate),
            }
          : undefined,
        counterpartyVatNumber: expectedCounterpartyVat
          ? { equals: expectedCounterpartyVat }
          : undefined,
      },
      orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
      take: 5,
    });
  }

  private ensureNotAlreadySent(
    document: { myDataStatus: MyDataStatus; myDataMark?: string | null },
    force = false,
  ): void {
    if (document.myDataStatus === MyDataStatus.SENT && !force) {
      throw new BadRequestException(
        'Το παραστατικό έχει ήδη διαβιβαστεί στο myDATA. Για νέα αποστολή απαιτείται forced retry ώστε να καταγραφεί ρητά στο ιστορικό.',
      );
    }
  }

  private supportsSendInvoices(documentType: DocumentType): boolean {
    const supportedTypes: DocumentType[] = [
      DocumentType.SALES_INVOICE,
      DocumentType.CREDIT_NOTE,
      DocumentType.RETAIL_RECEIPT,
    ];

    return supportedTypes.includes(documentType);
  }

  private resolveAttemptEnvironment(provider: MyDataProvider): string {
    if (provider.providerName === this.mockProvider.providerName) {
      return 'mock';
    }

    if (provider.providerName === this.aadeTestProvider.providerName) {
      return 'aade-configured';
    }

    return 'unknown';
  }

  private describeClientConfiguration(clientCompany: ClientCompany): {
    mode: MyDataTransmissionMode;
    canUseApi: boolean;
    reason: string;
  } {
    switch (clientCompany.myDataMode) {
      case MyDataTransmissionMode.ACCOUNTING_OFFICE_AUTHORIZED:
        return clientCompany.myDataAuthorized
          ? {
              mode: clientCompany.myDataMode,
              canUseApi: true,
              reason: 'Ο πελάτης έχει εξουσιοδότηση προς το λογιστικό γραφείο.',
            }
          : {
              mode: clientCompany.myDataMode,
              canUseApi: false,
              reason: 'Λείπει εξουσιοδότηση myDATA προς το λογιστικό γραφείο.',
            };

      case MyDataTransmissionMode.OWN_API_CREDENTIALS_ENV_REF:
        return {
          mode: clientCompany.myDataMode,
          canUseApi: Boolean(clientCompany.myDataCredentialRef?.trim()),
          reason: clientCompany.myDataCredentialRef?.trim()
            ? 'Ο πελάτης χρησιμοποιεί δικά του API credentials από env reference.'
            : 'Λείπει myDATA credential env reference για τον πελάτη.',
        };

      case MyDataTransmissionMode.MANUAL_UPLOAD:
        return {
          mode: clientCompany.myDataMode,
          canUseApi: false,
          reason: 'Ο πελάτης είναι ρυθμισμένος για χειροκίνητη αποστολή.',
        };

      case MyDataTransmissionMode.NOT_CONFIGURED:
      default:
        return {
          mode: clientCompany.myDataMode,
          canUseApi: false,
          reason: 'Δεν έχει ολοκληρωθεί η ρύθμιση myDATA για αυτόν τον πελάτη.',
        };
    }
  }
}

function collectInvoicePayloads(value: unknown): unknown[] {
  const invoices: unknown[] = [];
  collectInvoicePayloadsInto(value, invoices);
  return invoices;
}

function collectInvoicePayloadsInto(value: unknown, invoices: unknown[]): void {
  if (value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectInvoicePayloadsInto(entry, invoices));
    return;
  }

  if (typeof value !== 'object') {
    return;
  }

  for (const [key, entryValue] of Object.entries(value)) {
    if (key.toLowerCase() === 'invoice') {
      if (Array.isArray(entryValue)) {
        invoices.push(...entryValue);
      } else if (entryValue !== null && entryValue !== undefined) {
        invoices.push(entryValue);
      }
      continue;
    }

    collectInvoicePayloadsInto(entryValue, invoices);
  }
}

function findObjectValue(value: unknown, key: string): unknown {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findObjectValue(entry, key);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }

  if (typeof value !== 'object') {
    return undefined;
  }

  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryKey.toLowerCase() === key.toLowerCase()) {
      return entryValue;
    }

    const found = findObjectValue(entryValue, key);
    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

function findFirstValue(value: unknown, keys: string[]): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstValue(item, keys);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }

  if (typeof value !== 'object') {
    return undefined;
  }

  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (keys.some((key) => key.toLowerCase() === entryKey.toLowerCase())) {
      return typeof entryValue === 'string' || typeof entryValue === 'number'
        ? String(entryValue)
        : JSON.stringify(entryValue);
    }

    const found = findFirstValue(entryValue, keys);
    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

function formatAadeDate(value: string): string {
  const date = new Date(value);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

function parseAadeDate(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (ddmmyyyy) {
    return new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}T00:00:00.000Z`);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toDecimal(value: string | undefined): Prisma.Decimal | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(',', '.');
  return Number.isNaN(Number(normalized)) ? undefined : new Prisma.Decimal(normalized);
}

function emptyStringToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function decimalDiffers(left: Prisma.Decimal, right: Prisma.Decimal): boolean {
  return Math.abs(left.toNumber() - right.toNumber()) > 0.01;
}

function normalizeVat(value: string): string {
  return value.replace(/\D/g, '');
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
}

function endOfDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
  );
}

function mapAadeInvoiceTypeToInternalDocumentType(
  source: MyDataSyncSource,
  invoiceType: string | undefined,
): DocumentType | undefined {
  if (!invoiceType) {
    return undefined;
  }

  if (source === MyDataSyncSource.REQUEST_DOCS) {
    if (invoiceType.startsWith('5.')) {
      return DocumentType.CREDIT_NOTE;
    }

    return DocumentType.PURCHASE_INVOICE;
  }

  const mappings: Record<string, DocumentType> = {
    '1.1': DocumentType.SALES_INVOICE,
    '5.1': DocumentType.CREDIT_NOTE,
    '11.1': DocumentType.RETAIL_RECEIPT,
  };

  return mappings[invoiceType];
}

function toReconciliationStatus(issues: string[]): MyDataReconciliationStatus {
  if (issues.length === 0) {
    return MyDataReconciliationStatus.MATCHED;
  }

  if (issues.some((issue) => ['totalAmount', 'netAmount', 'vatAmount'].includes(issue))) {
    return MyDataReconciliationStatus.AMOUNT_MISMATCH;
  }

  if (issues.includes('issueDate')) {
    return MyDataReconciliationStatus.DATE_MISMATCH;
  }

  if (issues.includes('documentType')) {
    return MyDataReconciliationStatus.TYPE_MISMATCH;
  }

  if (issues.includes('counterpartyVatNumber')) {
    return MyDataReconciliationStatus.COUNTERPARTY_MISMATCH;
  }

  return MyDataReconciliationStatus.MISSING_INTERNAL;
}
