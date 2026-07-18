import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  AuditAction,
  ClientCompany,
  CounterpartyType,
  DocumentType,
  ExpenseClassificationApprovalStatus,
  MyDataSnapshot,
  MyDataReconciliationStatus,
  MyDataSnapshotReviewStatus,
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
  OfficeMyDataDashboardQueryDto,
  SyncMyDataDocsDto,
  SyncMyDataDocsSourceDto,
  SyncOfficeMyDataDto,
} from './dto/sync-mydata-docs.dto';
import {
  MatchMyDataSnapshotDto,
  ReviewMyDataSnapshotActionDto,
  ReviewMyDataSnapshotDto,
} from './dto/resolve-mydata-snapshot.dto';
import {
  ApproveExpenseClassificationDto,
  BatchApproveExpenseClassificationDto,
  ExpenseClassificationApprovalActionDto,
  SendExpenseClassificationBatchDto,
} from './dto/approve-expense-classification.dto';
import { MockMyDataProvider } from './mydata-mock.service';
import { MyDataMappingService } from './mydata-mapping.service';
import { MyDataProvider, MyDataTransmissionResponse } from './mydata-provider.interface';
import { MyDataXmlValidationService } from './mydata-xml-validation.service';
import { UpdateExpenseClassificationDraftDto } from './dto/update-expense-classification-draft.dto';

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
    private readonly xmlValidationService: MyDataXmlValidationService,
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
        expenseClassificationApprovalStatus: ExpenseClassificationApprovalStatus.PENDING,
        expenseClassificationApprovedById: null,
        expenseClassificationApprovedAt: null,
        expenseClassificationApprovalNotes: null,
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
      preview: this.expenseClassificationPreview(document),
      attempt,
    };
  }

  async updateExpenseClassificationDraft(
    tenant: TenantContext,
    documentId: string,
    dto: UpdateExpenseClassificationDraftDto,
  ) {
    const document = await this.getTenantDocument(tenant, documentId);
    this.ensurePurchaseInvoice(document.documentType);
    if (!document.myDataMark) {
      throw new BadRequestException('Expense classification requires an incoming AADE MARK.');
    }
    if (
      document.classificationStatus === 'EXPENSE_CLASSIFIED_AADE' ||
      document.expenseClassificationApprovalStatus ===
        ExpenseClassificationApprovalStatus.CONSUMED
    ) {
      throw new BadRequestException('A classification already sent to AADE cannot be edited.');
    }

    const draftByLine = new Map(dto.lines.map((line) => [line.lineNumber, line]));
    if (draftByLine.size !== dto.lines.length) {
      throw new BadRequestException('Each expense classification line number must be unique.');
    }
    if (
      draftByLine.size !== document.lines.length ||
      document.lines.some((line) => !draftByLine.has(line.lineNumber))
    ) {
      throw new BadRequestException(
        'A classification type and category must be supplied for every document line.',
      );
    }

    const candidateLines = document.lines.map((line) => {
      const draft = draftByLine.get(line.lineNumber)!;
      return {
        ...line,
        expenseClassificationType: draft.expenseClassificationType,
        expenseClassificationCategory: draft.expenseClassificationCategory,
        vatClassificationType: draft.vatClassificationType ?? null,
      };
    });
    const xml = this.mappingService.mapPurchaseDocumentToExpenseClassificationXml({
      ...document,
      lines: candidateLines,
    });
    this.xmlValidationService.validateExpenseClassifications(xml);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      for (const line of candidateLines) {
        await tx.documentLine.update({
          where: {
            documentId_lineNumber: {
              documentId: document.id,
              lineNumber: line.lineNumber,
            },
          },
          data: {
            expenseClassificationType: line.expenseClassificationType,
            expenseClassificationCategory: line.expenseClassificationCategory,
            vatClassificationType: line.vatClassificationType,
          },
        });
      }
      const updatedDocument = await tx.document.update({
        where: { id: document.id },
        data: {
          myDataStatus: MyDataStatus.READY_TO_SEND,
          myDataXmlPreview: xml,
          classificationStatus: 'EXPENSE_PREPARED',
          expenseClassificationApprovalStatus: ExpenseClassificationApprovalStatus.PENDING,
          expenseClassificationApprovedById: null,
          expenseClassificationApprovedAt: null,
          expenseClassificationApprovalNotes: null,
        },
        include: {
          clientCompany: true,
          lines: { orderBy: { lineNumber: 'asc' } },
          payments: { orderBy: { paymentNumber: 'asc' } },
        },
      });
      const attempt = await tx.transmissionAttempt.create({
        data: {
          documentId: document.id,
          provider: 'expense-classification-preview',
          environment: 'preview',
          correlationId: randomUUID(),
          status: TransmissionStatus.PREPARED,
          requestPayload: xml,
          responsePayload: {
            previewOnly: true,
            flow: 'receiver-expense-classification',
            edited: true,
          },
        },
      });
      await tx.auditLog.create({
        data: {
          accountingOfficeId: tenant.accountingOfficeId,
          userId: tenant.userId,
          action: AuditAction.UPDATE,
          entityType: 'ExpenseClassificationDraft',
          entityId: document.id,
          oldValue: {
            lines: document.lines.map((line) => ({
              lineNumber: line.lineNumber,
              expenseClassificationType: line.expenseClassificationType,
              expenseClassificationCategory: line.expenseClassificationCategory,
              vatClassificationType: line.vatClassificationType,
            })),
          },
          newValue: {
            lines: dto.lines.map((line) => ({
              lineNumber: line.lineNumber,
              expenseClassificationType: line.expenseClassificationType,
              expenseClassificationCategory: line.expenseClassificationCategory,
              vatClassificationType: line.vatClassificationType ?? null,
            })),
            approvalStatus: ExpenseClassificationApprovalStatus.PENDING,
            updatedAt: now.toISOString(),
          },
        },
      });
      return {
        document: updatedDocument,
        status: MyDataStatus.READY_TO_SEND,
        xml,
        preview: this.expenseClassificationPreview(updatedDocument),
        attempt,
      };
    });
  }

  approveExpenseClassification(
    tenant: TenantContext,
    documentId: string,
    dto: ApproveExpenseClassificationDto,
  ) {
    return this.approveExpenseClassificationBatch(tenant, {
      ...dto,
      documentIds: [documentId],
    }).then((result) => result.documents[0]);
  }

  async approveExpenseClassificationBatch(
    tenant: TenantContext,
    dto: BatchApproveExpenseClassificationDto,
  ) {
    const documentIds = [...new Set(dto.documentIds)];
    const documents = await this.prisma.document.findMany({
      where: {
        id: { in: documentIds },
        accountingOfficeId: tenant.accountingOfficeId,
        deletedAt: null,
      },
    });
    if (documents.length !== documentIds.length) {
      throw new NotFoundException('One or more expense documents were not found.');
    }
    if (
      dto.action === ExpenseClassificationApprovalActionDto.REJECT &&
      !dto.notes?.trim()
    ) {
      throw new BadRequestException('Rejection notes are required.');
    }
    for (const document of documents) {
      this.ensurePurchaseInvoice(document.documentType);
      if (!document.myDataMark) {
        throw new BadRequestException(
          'Document ' + document.documentNumber + ' has no incoming AADE MARK.',
        );
      }
      if (document.classificationStatus !== 'EXPENSE_PREPARED') {
        throw new BadRequestException(
          'Document ' +
            document.documentNumber +
            ' must have a fresh expense preview before approval.',
        );
      }
      if (
        document.expenseClassificationApprovalStatus ===
        ExpenseClassificationApprovalStatus.CONSUMED
      ) {
        throw new BadRequestException(
          'Document ' +
            document.documentNumber +
            ' classification approval is already consumed.',
        );
      }
    }

    const approvalStatus =
      dto.action === ExpenseClassificationApprovalActionDto.APPROVE
        ? ExpenseClassificationApprovalStatus.APPROVED
        : ExpenseClassificationApprovalStatus.REJECTED;
    const approvedAt =
      approvalStatus === ExpenseClassificationApprovalStatus.APPROVED ? new Date() : null;
    const approvedById =
      approvalStatus === ExpenseClassificationApprovalStatus.APPROVED ? tenant.userId : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const results = [];
      for (const document of documents) {
        results.push(
          await tx.document.update({
            where: { id: document.id },
            data: {
              expenseClassificationApprovalStatus: approvalStatus,
              expenseClassificationApprovedById: approvedById,
              expenseClassificationApprovedAt: approvedAt,
              expenseClassificationApprovalNotes: dto.notes?.trim() || null,
            },
          }),
        );
        await tx.auditLog.create({
          data: {
            accountingOfficeId: tenant.accountingOfficeId,
            userId: tenant.userId,
            action: AuditAction.UPDATE,
            entityType: 'ExpenseClassificationApproval',
            entityId: document.id,
            oldValue: {
              status: document.expenseClassificationApprovalStatus,
            },
            newValue: {
              status: approvalStatus,
              notes: dto.notes?.trim() || null,
            },
          },
        });
      }
      return results;
    });

    return { count: updated.length, status: approvalStatus, documents: updated };
  }

  async sendExpenseClassificationBatch(
    tenant: TenantContext,
    dto: SendExpenseClassificationBatchDto,
  ) {
    const documentIds = [...new Set(dto.documentIds)];
    const documents = await this.prisma.document.findMany({
      where: {
        id: { in: documentIds },
        accountingOfficeId: tenant.accountingOfficeId,
        deletedAt: null,
      },
      select: {
        id: true,
        documentNumber: true,
        documentType: true,
        classificationStatus: true,
        expenseClassificationApprovalStatus: true,
      },
    });
    if (documents.length !== documentIds.length) {
      throw new NotFoundException('One or more batch expense documents were not found.');
    }
    for (const document of documents) {
      this.ensurePurchaseInvoice(document.documentType);
      if (
        document.classificationStatus !== 'EXPENSE_PREPARED' ||
        document.expenseClassificationApprovalStatus !==
          ExpenseClassificationApprovalStatus.APPROVED
      ) {
        throw new BadRequestException(
          'Document ' +
            document.documentNumber +
            ' requires a fresh approved expense preview before batch send.',
        );
      }
    }

    const batchId = randomUUID();
    const results: Array<Record<string, unknown>> = [];
    for (const documentId of documentIds) {
      try {
        const result = await this.sendExpenseTest(tenant, documentId);
        results.push({
          documentId,
          status: 'SENT',
          classificationMark: result.classificationMark,
          environment: result.environment,
        });
      } catch (error) {
        results.push({
          documentId,
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Expense classification send failed.',
        });
      }
    }
    return {
      batchId,
      environment: this.aadeTestProvider.configuredEnvironment(),
      requestedCount: documentIds.length,
      sentCount: results.filter((result) => result.status === 'SENT').length,
      failedCount: results.filter((result) => result.status === 'FAILED').length,
      results,
    };
  }

  async sendExpenseMock(tenant: TenantContext, documentId: string) {
    const document = await this.getTenantDocument(tenant, documentId);
    this.ensurePurchaseInvoice(document.documentType);
    this.ensureNotAlreadySent(document);
    const xml = this.mappingService.mapPurchaseDocumentToExpenseClassificationXml(document);
    const mark = `MOCK-EXPENSE-MARK-${document.id}`;
    const uid = `MOCK-EXPENSE-UID-${document.id}`;

    await this.prisma.document.update({
      where: { id: document.id },
      data: {
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
      status: document.myDataStatus,
      mark: document.myDataMark,
      classificationMark: mark,
      uid,
      attempt,
    };
  }

  async sendExpenseTest(
    tenant: TenantContext,
    documentId: string,
    options: MyDataSendOptions = {},
  ) {
    const document = await this.getTenantDocument(tenant, documentId);
    this.ensurePurchaseInvoice(document.documentType);
    this.ensureSendAllowed(document, options.force);
    const configuredEnvironment = this.aadeTestProvider.configuredEnvironment();
    if (
      configuredEnvironment === 'production' &&
      document.expenseClassificationApprovalStatus !==
        ExpenseClassificationApprovalStatus.APPROVED
    ) {
      throw new BadRequestException(
        'Production expense classification requires explicit approval after the latest preview.',
      );
    }

    if (!this.aadeTestProvider.transmitExpenseClassification) {
      throw new BadRequestException(
        'The configured myDATA provider does not support SendExpensesClassification.',
      );
    }

    const xml = this.mappingService.mapPurchaseDocumentToExpenseClassificationXml(document);
    const correlationId = randomUUID();

    try {
      const response = await this.aadeTestProvider.transmitExpenseClassification({
        documentId: document.id,
        payloadXml: xml,
        postPerInvoice: true,
        force: options.force,
        credentialEnvPrefix: this.resolveCredentialEnvPrefix(
          this.aadeTestProvider,
          document.clientCompany,
        ),
      });

      if (response.status === 'failed') {
        return this.recordFailedTransmission(
          document.id,
          xml,
          this.aadeTestProvider.providerName,
          response.errorMessage,
          response.errorCode ?? 'MYDATA_EXPENSE_CLASSIFICATION_FAILED',
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
          myDataMark: response.mark ?? document.myDataMark,
          myDataUid: response.uid ?? document.myDataUid,
          myDataQrUrl: response.qrUrl ?? document.myDataQrUrl,
          myDataClassificationMark: response.classificationMark,
          myDataXmlPreview: xml,
          classificationStatus: 'EXPENSE_CLASSIFIED_AADE',
          expenseClassificationApprovalStatus:
            configuredEnvironment === 'production'
              ? ExpenseClassificationApprovalStatus.CONSUMED
              : document.expenseClassificationApprovalStatus,
        },
      });

      const attempt = await this.prisma.transmissionAttempt.create({
        data: {
          documentId: document.id,
          provider: this.aadeTestProvider.providerName,
          environment:
            response.environment ?? this.resolveAttemptEnvironment(this.aadeTestProvider),
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
        mark: response.mark ?? document.myDataMark,
        classificationMark: response.classificationMark,
        uid: response.uid ?? document.myDataUid,
        qrUrl: response.qrUrl ?? document.myDataQrUrl,
        environment: response.environment ?? this.resolveAttemptEnvironment(this.aadeTestProvider),
        attempt,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : 'myDATA expense classification failed.';
      return this.recordFailedTransmission(
        document.id,
        xml,
        this.aadeTestProvider.providerName,
        message,
        'MYDATA_EXPENSE_CLASSIFICATION_EXCEPTION',
        undefined,
        {
          environment: this.resolveAttemptEnvironment(this.aadeTestProvider),
          correlationId,
          forcedRetry: options.force === true,
        },
      );
    }
  }

  async cancelTest(tenant: TenantContext, documentId: string) {
    const document = await this.getTenantDocument(tenant, documentId);

    if (!this.supportsSendInvoices(document.documentType)) {
      throw new BadRequestException(
        'AADE CancelInvoice is supported by this slice only for issued sales documents.',
      );
    }

    if (document.myDataStatus === MyDataStatus.CANCELLED) {
      throw new BadRequestException('Το παραστατικό είναι ήδη ακυρωμένο.');
    }

    if (document.myDataStatus !== MyDataStatus.SENT || !document.myDataMark) {
      throw new BadRequestException(
        'Για ακύρωση στην ΑΑΔΕ χρειάζεται ήδη σταλμένο παραστατικό με MARK.',
      );
    }

    if (!this.aadeTestProvider.cancelInvoice) {
      throw new BadRequestException(
        'The configured myDATA provider does not support CancelInvoice.',
      );
    }

    const correlationId = randomUUID();
    const requestPayload = `CancelInvoice mark=${document.myDataMark}`;

    try {
      const response = await this.aadeTestProvider.cancelInvoice({
        documentId: document.id,
        mark: document.myDataMark,
        entityVatNumber: this.resolveEntityVatNumberForThirdPartyCall(document.clientCompany),
        credentialEnvPrefix: this.resolveCredentialEnvPrefix(
          this.aadeTestProvider,
          document.clientCompany,
        ),
      });

      if (response.status === 'failed') {
        return this.recordFailedActionAttempt(document.id, requestPayload, this.aadeTestProvider, {
          message: response.errorMessage ?? 'AADE myDATA cancellation failed.',
          code: response.errorCode ?? 'MYDATA_CANCEL_FAILED',
          rawResponse: response.rawResponse,
          environment: response.environment,
          endpoint: response.endpoint,
          correlationId,
        });
      }

      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          myDataStatus: MyDataStatus.CANCELLED,
          myDataCancellationMark: response.cancellationMark,
          myDataCancelledAt: new Date(),
        },
      });

      const attempt = await this.prisma.transmissionAttempt.create({
        data: {
          documentId: document.id,
          provider: this.aadeTestProvider.providerName,
          environment:
            response.environment ?? this.resolveAttemptEnvironment(this.aadeTestProvider),
          endpoint: response.endpoint,
          correlationId,
          status: TransmissionStatus.SENT,
          requestPayload,
          responsePayload: this.toResponsePayload(response),
        },
      });

      return {
        documentId: document.id,
        status: MyDataStatus.CANCELLED,
        mark: document.myDataMark,
        cancellationMark: response.cancellationMark,
        environment: response.environment ?? this.resolveAttemptEnvironment(this.aadeTestProvider),
        attempt,
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof BadGatewayException) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'myDATA cancellation failed.';
      return this.recordFailedActionAttempt(document.id, requestPayload, this.aadeTestProvider, {
        message,
        code: 'MYDATA_CANCEL_EXCEPTION',
        environment: this.resolveAttemptEnvironment(this.aadeTestProvider),
        correlationId,
      });
    }
  }

  private async sendWithProvider(
    tenant: TenantContext,
    documentId: string,
    provider: MyDataProvider,
    options: MyDataSendOptions,
  ) {
    const document = await this.getTenantDocument(tenant, documentId);
    this.ensureSendAllowed(document, options.force);
    // A forced retry follows a correction after a failed transmission. Rebuild its payload
    // from the current document instead of replaying a stale preview.
    const xml =
      options.force === true
        ? this.mappingService.mapDocumentToXml(document)
        : document.myDataXmlPreview ?? this.mappingService.mapDocumentToXml(document);
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
      nextPartitionKey: dto.nextPartitionKey,
      nextRowKey: dto.nextRowKey,
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
    const normalizedCancellations = normalizeAadeCancellations(response.rawResponse);
    const normalizedExpenseClassifications = normalizeAadeExpenseClassifications(
      response.rawResponse,
    );
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
        if (reconciliation.documentId) {
          await this.prisma.document.update({
            where: { id: reconciliation.documentId },
            data: {
              myDataMark: normalizedDocument.mark,
              myDataUid: normalizedDocument.uid,
              myDataQrUrl: normalizedDocument.qrUrl,
            },
          });
        }
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
          reviewStatus:
            reconciliation.status === MyDataReconciliationStatus.MATCHED
              ? MyDataSnapshotReviewStatus.RESOLVED
              : MyDataSnapshotReviewStatus.PENDING,
          reviewedAt:
            reconciliation.status === MyDataReconciliationStatus.MATCHED ? new Date() : undefined,
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
          reviewStatus:
            reconciliation.status === MyDataReconciliationStatus.MATCHED
              ? MyDataSnapshotReviewStatus.RESOLVED
              : undefined,
          reviewedAt:
            reconciliation.status === MyDataReconciliationStatus.MATCHED ? new Date() : undefined,
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

    let cancellationsApplied = 0;
    for (const cancellation of normalizedCancellations) {
      const result = await this.prisma.document.updateMany({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: clientCompany.id,
          myDataMark: cancellation.invoiceMark,
          deletedAt: null,
        },
        data: {
          myDataStatus: MyDataStatus.CANCELLED,
          myDataCancellationMark: cancellation.cancellationMark,
          myDataCancelledAt: cancellation.cancellationDate,
        },
      });
      cancellationsApplied += result.count;
    }

    let classificationsApplied = 0;
    for (const classification of normalizedExpenseClassifications) {
      if (!classification.classificationMark) {
        continue;
      }

      const result = await this.prisma.document.updateMany({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: clientCompany.id,
          myDataMark: classification.invoiceMark,
          deletedAt: null,
        },
        data: {
          myDataClassificationMark: classification.classificationMark,
          classificationStatus: 'EXPENSE_CLASSIFIED_AADE',
          expenseClassificationApprovalStatus:
            ExpenseClassificationApprovalStatus.CONSUMED,
        },
      });
      classificationsApplied += result.count;
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
      cancellationCount: normalizedCancellations.length,
      cancellationsApplied,
      expenseClassificationCount: normalizedExpenseClassifications.length,
      classificationsApplied,
      nextPartitionKey: findFirstValue(response.rawResponse, ['nextPartitionKey']),
      nextRowKey: findFirstValue(response.rawResponse, ['nextRowKey']),
    };
  }

  async syncOffice(tenant: TenantContext, dto: SyncOfficeMyDataDto) {
    const sources = dto.sources?.length
      ? dto.sources
      : [
          SyncMyDataDocsSourceDto.REQUEST_DOCS,
          SyncMyDataDocsSourceDto.REQUEST_TRANSMITTED_DOCS,
        ];
    const companies = await this.prisma.clientCompany.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        deletedAt: null,
        OR: [
          {
            myDataMode: MyDataTransmissionMode.ACCOUNTING_OFFICE_AUTHORIZED,
            myDataAuthorized: true,
          },
          { myDataMode: MyDataTransmissionMode.OWN_API_CREDENTIALS_ENV_REF },
        ],
        id: dto.clientCompanyIds?.length ? { in: dto.clientCompanyIds } : undefined,
      },
      select: { id: true, legalName: true },
      orderBy: { legalName: 'asc' },
    });
    const results: Array<Record<string, unknown>> = [];

    for (const company of companies) {
      for (const source of sources) {
        let nextPartitionKey: string | undefined;
        let nextRowKey: string | undefined;
        let pages = 0;
        let fetchedCount = 0;
        let matchedCount = 0;
        let mismatchCount = 0;
        let cancellationCount = 0;
        let expenseClassificationCount = 0;
        const seenCursors = new Set<string>();
        const initialMark = dto.incremental
          ? await this.latestSnapshotMark(
              tenant.accountingOfficeId,
              company.id,
              source as MyDataSyncSource,
            )
          : '0';

        try {
          do {
            const page = await this.syncRequestDocs(tenant, {
              clientCompanyId: company.id,
              source,
              mark: initialMark,
              dateFrom: dto.dateFrom,
              dateTo: dto.dateTo,
              nextPartitionKey,
              nextRowKey,
            });
            pages += 1;
            fetchedCount += page.fetchedCount;
            matchedCount += page.matchedCount;
            mismatchCount += page.mismatchCount;
            cancellationCount += page.cancellationCount;
            expenseClassificationCount += page.expenseClassificationCount;
            nextPartitionKey = page.nextPartitionKey;
            nextRowKey = page.nextRowKey;
            const cursor = `${nextPartitionKey ?? ''}:${nextRowKey ?? ''}`;
            if ((!nextPartitionKey && !nextRowKey) || seenCursors.has(cursor)) break;
            seenCursors.add(cursor);
          } while (pages < (dto.maxPages ?? 10));

          results.push({
            clientCompanyId: company.id,
            legalName: company.legalName,
            source,
            status: 'COMPLETED',
            pages,
            fetchedCount,
            matchedCount,
            mismatchCount,
            cancellationCount,
            expenseClassificationCount,
            hasMore: Boolean(nextPartitionKey || nextRowKey),
          });
        } catch (error) {
          results.push({
            clientCompanyId: company.id,
            legalName: company.legalName,
            source,
            status: 'FAILED',
            pages,
            fetchedCount,
            matchedCount,
            mismatchCount,
            error: error instanceof Error ? error.message : 'Unknown myDATA synchronization error.',
          });
        }
      }
    }

    return {
      companyCount: companies.length,
      flowCount: results.length,
      completedCount: results.filter((result) => result.status === 'COMPLETED').length,
      failedCount: results.filter((result) => result.status === 'FAILED').length,
      fetchedCount: results.reduce((sum, result) => sum + Number(result.fetchedCount ?? 0), 0),
      matchedCount: results.reduce((sum, result) => sum + Number(result.matchedCount ?? 0), 0),
      mismatchCount: results.reduce((sum, result) => sum + Number(result.mismatchCount ?? 0), 0),
      results,
    };
  }

  async syncScheduledOffices(maxPages = 10) {
    const offices = await this.prisma.accountingOffice.findMany({
      where: {
        clientCompanies: {
          some: {
            deletedAt: null,
            OR: [
              {
                myDataMode: MyDataTransmissionMode.ACCOUNTING_OFFICE_AUTHORIZED,
                myDataAuthorized: true,
              },
              { myDataMode: MyDataTransmissionMode.OWN_API_CREDENTIALS_ENV_REF },
            ],
          },
        },
      },
      select: { id: true },
    });
    const results = [];
    for (const office of offices) {
      results.push(
        await this.syncOffice(
          { accountingOfficeId: office.id },
          {
            incremental: true,
            maxPages,
            sources: [
              SyncMyDataDocsSourceDto.REQUEST_DOCS,
              SyncMyDataDocsSourceDto.REQUEST_TRANSMITTED_DOCS,
            ],
          },
        ),
      );
    }
    const failedCount = results.reduce((sum, result) => sum + result.failedCount, 0);
    if (failedCount > 0) {
      throw new BadGatewayException(
        'Scheduled myDATA sync completed with ' + failedCount + ' failed flow(s).',
      );
    }
    return {
      officeCount: offices.length,
      flowCount: results.reduce((sum, result) => sum + result.flowCount, 0),
      fetchedCount: results.reduce((sum, result) => sum + result.fetchedCount, 0),
      mismatchCount: results.reduce((sum, result) => sum + result.mismatchCount, 0),
    };
  }

  async officeDashboard(tenant: TenantContext, query: OfficeMyDataDashboardQueryDto) {
    const issueDate =
      query.dateFrom || query.dateTo
        ? {
            gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
            lte: query.dateTo ? endOfDay(new Date(query.dateTo)) : undefined,
          }
        : undefined;
    const snapshotWhere: Prisma.MyDataSnapshotWhereInput = {
      accountingOfficeId: tenant.accountingOfficeId,
      source: query.source as MyDataSyncSource | undefined,
      issueDate,
    };
    const exceptionWhere: Prisma.MyDataSnapshotWhereInput = {
      ...snapshotWhere,
      reviewStatus: MyDataSnapshotReviewStatus.PENDING,
      reconciliationStatus:
        query.status ?? { not: MyDataReconciliationStatus.MATCHED },
    };

    const [companies, groups, lastRuns, exceptions] = await Promise.all([
      this.prisma.clientCompany.findMany({
        where: { accountingOfficeId: tenant.accountingOfficeId, deletedAt: null },
        select: {
          id: true,
          legalName: true,
          vatNumber: true,
          myDataAuthorized: true,
          myDataMode: true,
        },
        orderBy: { legalName: 'asc' },
      }),
      this.prisma.myDataSnapshot.groupBy({
        by: ['clientCompanyId', 'source', 'reconciliationStatus', 'reviewStatus'],
        where: snapshotWhere,
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.myDataSyncRun.findMany({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          source: query.source as MyDataSyncSource | undefined,
        },
        select: {
          clientCompanyId: true,
          source: true,
          status: true,
          environment: true,
          fetchedCount: true,
          matchedCount: true,
          mismatchCount: true,
          errorMessage: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.myDataSnapshot.findMany({
        where: exceptionWhere,
        include: {
          clientCompany: { select: { id: true, legalName: true, vatNumber: true } },
          matchedDocument: {
            select: { id: true, series: true, documentNumber: true, documentType: true },
          },
        },
        orderBy: [{ issueDate: 'desc' }, { fetchedAt: 'desc' }],
        take: query.take ?? 100,
      }),
    ]);

    const lastRunByCompanyAndSource = new Map<string, (typeof lastRuns)[number]>();
    for (const run of lastRuns) {
      const key = `${run.clientCompanyId}:${run.source}`;
      if (!lastRunByCompanyAndSource.has(key)) lastRunByCompanyAndSource.set(key, run);
    }
    const summaries = companies.map((company) => {
      const companyGroups = groups.filter((group) => group.clientCompanyId === company.id);
      const count = (status: MyDataReconciliationStatus) =>
        companyGroups
          .filter((group) => group.reconciliationStatus === status)
          .reduce((sum, group) => sum + group._count._all, 0);
      const totalCount = companyGroups.reduce((sum, group) => sum + group._count._all, 0);
      const matchedCount = count(MyDataReconciliationStatus.MATCHED);
      const pendingGroups = companyGroups.filter(
        (group) => group.reviewStatus === MyDataSnapshotReviewStatus.PENDING,
      );
      const pendingCount = (status: MyDataReconciliationStatus) =>
        pendingGroups
          .filter((group) => group.reconciliationStatus === status)
          .reduce((sum, group) => sum + group._count._all, 0);
      const pendingMissingInternalCount = pendingCount(
        MyDataReconciliationStatus.MISSING_INTERNAL,
      );
      const pendingMismatchCount =
        pendingGroups.reduce((sum, group) => sum + group._count._all, 0) -
        pendingMissingInternalCount;
      return {
        ...company,
        apiReady:
          (company.myDataMode === MyDataTransmissionMode.ACCOUNTING_OFFICE_AUTHORIZED &&
            company.myDataAuthorized) ||
          company.myDataMode === MyDataTransmissionMode.OWN_API_CREDENTIALS_ENV_REF,
        totalCount,
        matchedCount,
        missingInternalCount: pendingMissingInternalCount,
        mismatchCount: pendingMismatchCount,
        totalAmount: companyGroups.reduce(
          (sum, group) => sum + Number(group._sum.totalAmount ?? 0),
          0,
        ),
        lastReceivedSync: lastRunByCompanyAndSource.get(
          `${company.id}:${MyDataSyncSource.REQUEST_DOCS}`,
        ),
        lastTransmittedSync: lastRunByCompanyAndSource.get(
          `${company.id}:${MyDataSyncSource.REQUEST_TRANSMITTED_DOCS}`,
        ),
      };
    });

    return {
      overview: {
        companyCount: companies.length,
        authorizedCompanyCount: companies.filter(
          (company) =>
            (company.myDataMode === MyDataTransmissionMode.ACCOUNTING_OFFICE_AUTHORIZED &&
              company.myDataAuthorized) ||
            company.myDataMode === MyDataTransmissionMode.OWN_API_CREDENTIALS_ENV_REF,
        ).length,
        totalCount: summaries.reduce((sum, company) => sum + company.totalCount, 0),
        matchedCount: summaries.reduce((sum, company) => sum + company.matchedCount, 0),
        missingInternalCount: summaries.reduce(
          (sum, company) => sum + company.missingInternalCount,
          0,
        ),
        mismatchCount: summaries.reduce((sum, company) => sum + company.mismatchCount, 0),
        companiesNeedingReviewCount: summaries.filter(
          (company) => company.missingInternalCount + company.mismatchCount > 0,
        ).length,
        failedSyncCountLast24Hours: lastRuns.filter(
          (run) =>
            run.status === MyDataSyncRunStatus.FAILED &&
            run.createdAt.getTime() >= Date.now() - 24 * 60 * 60 * 1000,
        ).length,
      },
      companies: summaries,
      exceptions,
    };
  }

  async createPurchaseFromSnapshot(tenant: TenantContext, snapshotId: string) {
    const snapshot = await this.getTenantSnapshot(tenant, snapshotId);
    const draft = await this.buildSnapshotPurchaseDraft(tenant, snapshot);
    if (draft.possibleDuplicate) {
      throw new BadRequestException({
        message: 'A possible duplicate internal document already exists. Use manual match.',
        documentId: draft.possibleDuplicate.id,
      });
    }

    const { lines, totalAmount, payments, supplierName } = draft;
    const issuer = findObjectValue(snapshot.rawPayload, 'issuer');
    const now = new Date();

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        let counterparty = await tx.counterparty.findFirst({
          where: {
            accountingOfficeId: tenant.accountingOfficeId,
            clientCompanyId: snapshot.clientCompanyId,
            vatNumber: snapshot.issuerVatNumber!,
            deletedAt: null,
          },
        });
        if (!counterparty) {
          counterparty = await tx.counterparty.create({
            data: {
              accountingOfficeId: tenant.accountingOfficeId,
              clientCompanyId: snapshot.clientCompanyId,
              type: CounterpartyType.SUPPLIER,
              name: supplierName,
              vatNumber: snapshot.issuerVatNumber!,
              country: findFirstValue(issuer, ['country']) ?? 'GR',
              notes: `Δημιουργήθηκε από myDATA MARK ${snapshot.mark}`,
            },
          });
        } else if (counterparty.type === CounterpartyType.CUSTOMER) {
          counterparty = await tx.counterparty.update({
            where: { id: counterparty.id },
            data: { type: CounterpartyType.BOTH },
          });
        }

        const document = await tx.document.create({
          data: {
            accountingOfficeId: tenant.accountingOfficeId,
            clientCompanyId: snapshot.clientCompanyId,
            documentType: DocumentType.PURCHASE_INVOICE,
            series: snapshot.series,
            documentNumber: snapshot.documentNumber,
            issueDate: snapshot.issueDate!,
            counterpartyName: counterparty.name,
            counterpartyVatNumber: snapshot.issuerVatNumber,
            movementCode: 'PURCHASE_INVOICE',
            journalCode: 'PURCHASES',
            netAmount: snapshot.netAmount ?? 0,
            vatAmount: snapshot.vatAmount ?? 0,
            totalAmount,
            vatCategory:
              new Set(lines.map((line) => line.vatCategory)).size === 1
                ? lines[0].vatCategory
                : 'MULTIPLE',
            paymentMethodType: payments[0].type,
            myDataMark: snapshot.mark,
            myDataUid: snapshot.uid,
            myDataQrUrl: snapshot.qrUrl,
            classificationStatus: 'AADE_RECEIVED_PENDING_CLASSIFICATION',
            lines: { create: lines },
            payments: { create: payments },
          },
          include: {
            lines: { orderBy: { lineNumber: 'asc' } },
            payments: { orderBy: { paymentNumber: 'asc' } },
          },
        });
        await tx.myDataSnapshot.update({
          where: { id: snapshot.id },
          data: {
            matchedDocumentId: document.id,
            reconciliationStatus: MyDataReconciliationStatus.MATCHED,
            reconciliationIssues: { fields: [] },
            reviewStatus: MyDataSnapshotReviewStatus.RESOLVED,
            reviewedById: tenant.userId,
            reviewedAt: now,
            reviewNotes: 'Created purchase invoice from AADE snapshot after preview.',
          },
        });
        await tx.auditLog.create({
          data: {
            accountingOfficeId: tenant.accountingOfficeId,
            userId: tenant.userId,
            action: AuditAction.CREATE,
            entityType: 'DocumentFromMyDataSnapshot',
            entityId: document.id,
            oldValue: Prisma.JsonNull,
            newValue: {
              snapshotId: snapshot.id,
              mark: snapshot.mark,
              documentType: document.documentType,
              lineCount: lines.length,
              previewed: true,
            },
          },
        });
        return { document, counterparty };
      });

      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException(
          'The AADE MARK or UID is already linked to another internal document.',
        );
      }
      throw error;
    }
  }

  async previewPurchaseFromSnapshot(tenant: TenantContext, snapshotId: string) {
    const snapshot = await this.getTenantSnapshot(tenant, snapshotId);
    const draft = await this.buildSnapshotPurchaseDraft(tenant, snapshot);

    return {
      snapshotId: snapshot.id,
      clientCompanyId: snapshot.clientCompanyId,
      mark: snapshot.mark,
      uid: snapshot.uid,
      invoiceType: snapshot.invoiceType,
      series: snapshot.series,
      documentNumber: snapshot.documentNumber,
      issueDate: snapshot.issueDate,
      supplier: {
        vatNumber: snapshot.issuerVatNumber,
        name: draft.supplierName,
      },
      totals: {
        netAmount: Number(snapshot.netAmount),
        vatAmount: Number(snapshot.vatAmount),
        totalAmount: draft.totalAmount,
      },
      vatBreakdown: snapshotVatBreakdown(draft.lines),
      lines: draft.lines,
      payments: draft.payments,
      possibleDuplicate: draft.possibleDuplicate,
      canCreate: !draft.possibleDuplicate,
    };
  }

  private async buildSnapshotPurchaseDraft(tenant: TenantContext, snapshot: MyDataSnapshot) {
    if (snapshot.source !== MyDataSyncSource.REQUEST_DOCS) {
      throw new BadRequestException('Only incoming AADE documents can create purchase invoices.');
    }
    if (snapshot.matchedDocumentId) {
      throw new BadRequestException('This AADE snapshot is already linked to an internal document.');
    }
    if (snapshot.invoiceType?.startsWith('5.')) {
      throw new BadRequestException(
        'Incoming credit notes require manual review until purchase credit notes have a separate internal document type.',
      );
    }
    if (!snapshot.issueDate || !snapshot.issuerVatNumber) {
      throw new BadRequestException('AADE issue date and supplier VAT number are required.');
    }

    const possibleDuplicate = await this.prisma.document.findFirst({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: snapshot.clientCompanyId,
        deletedAt: null,
        OR: [
          { myDataMark: snapshot.mark },
          ...(snapshot.uid ? [{ myDataUid: snapshot.uid }] : []),
          {
            series: snapshot.series,
            documentNumber: snapshot.documentNumber,
            issueDate: { gte: startOfDay(snapshot.issueDate), lte: endOfDay(snapshot.issueDate) },
            counterpartyVatNumber: snapshot.issuerVatNumber,
          },
        ],
      },
      select: { id: true, series: true, documentNumber: true },
    });
    const lines = snapshotDocumentLines(snapshot.rawPayload);
    this.assertSnapshotTotals(snapshot, lines);
    const totalAmount = snapshotTotal(lines);
    const payments = snapshotPayments(snapshot.rawPayload, totalAmount);
    const issuer = findObjectValue(snapshot.rawPayload, 'issuer');
    const supplierName =
      findFirstValue(issuer, ['name', 'legalName', 'branchName']) ??
      `Προμηθευτής ΑΦΜ ${snapshot.issuerVatNumber}`;
    return { lines, totalAmount, payments, supplierName, possibleDuplicate };
  }

  async matchSnapshot(tenant: TenantContext, snapshotId: string, dto: MatchMyDataSnapshotDto) {
    const snapshot = await this.getTenantSnapshot(tenant, snapshotId);
    const document = await this.prisma.document.findFirst({
      where: {
        id: dto.documentId,
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: snapshot.clientCompanyId,
        deletedAt: null,
      },
    });
    if (!document) throw new NotFoundException('Internal document was not found for this client.');
    if (document.myDataMark && document.myDataMark !== snapshot.mark) {
      throw new BadRequestException('The internal document is linked to a different AADE MARK.');
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: document.id },
        data: {
          myDataMark: snapshot.mark,
          myDataUid: snapshot.uid,
          myDataQrUrl: snapshot.qrUrl,
        },
      });
      const updated = await tx.myDataSnapshot.update({
        where: { id: snapshot.id },
        data: {
          matchedDocumentId: document.id,
          reconciliationStatus: MyDataReconciliationStatus.MATCHED,
          reconciliationIssues: { fields: [] },
          reviewStatus: MyDataSnapshotReviewStatus.RESOLVED,
          reviewedById: tenant.userId,
          reviewedAt: now,
          reviewNotes: dto.notes ?? 'Manual match accepted by user.',
        },
        include: { matchedDocument: true },
      });
      await tx.auditLog.create({
        data: {
          accountingOfficeId: tenant.accountingOfficeId,
          userId: tenant.userId,
          action: AuditAction.UPDATE,
          entityType: 'MyDataSnapshot',
          entityId: snapshot.id,
          oldValue: { matchedDocumentId: snapshot.matchedDocumentId },
          newValue: { matchedDocumentId: document.id, reviewStatus: 'RESOLVED' },
        },
      });
      return updated;
    });
  }

  async reviewSnapshot(tenant: TenantContext, snapshotId: string, dto: ReviewMyDataSnapshotDto) {
    const snapshot = await this.getTenantSnapshot(tenant, snapshotId);
    const reviewStatus =
      dto.action === ReviewMyDataSnapshotActionDto.IGNORE
        ? MyDataSnapshotReviewStatus.IGNORED
        : MyDataSnapshotReviewStatus.PENDING;
    const now = new Date();
    const updated = await this.prisma.myDataSnapshot.update({
      where: { id: snapshot.id },
      data: {
        reviewStatus,
        reviewedById: dto.action === ReviewMyDataSnapshotActionDto.IGNORE ? tenant.userId : null,
        reviewedAt: dto.action === ReviewMyDataSnapshotActionDto.IGNORE ? now : null,
        reviewNotes: dto.notes ?? null,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        accountingOfficeId: tenant.accountingOfficeId,
        userId: tenant.userId,
        action: AuditAction.UPDATE,
        entityType: 'MyDataSnapshot',
        entityId: snapshot.id,
        oldValue: { reviewStatus: snapshot.reviewStatus },
        newValue: { reviewStatus, notes: dto.notes ?? null },
      },
    });
    return updated;
  }

  async snapshotCandidates(tenant: TenantContext, snapshotId: string) {
    const snapshot = await this.getTenantSnapshot(tenant, snapshotId);
    const issueDate = snapshot.issueDate ?? new Date();
    const dateFrom = new Date(issueDate);
    const dateTo = new Date(issueDate);
    dateFrom.setUTCDate(dateFrom.getUTCDate() - 7);
    dateTo.setUTCDate(dateTo.getUTCDate() + 7);
    return this.prisma.document.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: snapshot.clientCompanyId,
        deletedAt: null,
        issueDate: { gte: startOfDay(dateFrom), lte: endOfDay(dateTo) },
        OR: [
          { documentNumber: snapshot.documentNumber },
          { counterpartyVatNumber: snapshot.issuerVatNumber ?? undefined },
          { totalAmount: snapshot.totalAmount ?? undefined },
        ],
      },
      select: {
        id: true,
        documentType: true,
        series: true,
        documentNumber: true,
        issueDate: true,
        counterpartyName: true,
        counterpartyVatNumber: true,
        totalAmount: true,
        myDataMark: true,
      },
      orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    });
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
    const alreadyCancelled = document.myDataStatus === MyDataStatus.CANCELLED;
    const failed = document.myDataStatus === MyDataStatus.FAILED;
    const configuration = this.describeClientConfiguration(document.clientCompany);
    const blockers: string[] = [];

    if (!supportsSendInvoices && !supportsExpenseReceiver) {
      blockers.push('Ο τύπος παραστατικού δεν υποστηρίζεται από την τρέχουσα myDATA ροή.');
    }

    if (supportsSendInvoices && !configuration.canUseApi) {
      blockers.push(configuration.reason);
    }

    if (alreadySent) {
      blockers.push(
        'Το παραστατικό έχει ήδη διαβιβαστεί. Χρειάζεται ακύρωση ή διορθωτικό παραστατικό, όχι επαναποστολή.',
      );
    }

    if (alreadyCancelled) {
      blockers.push('Το παραστατικό έχει ακυρωθεί στο myDATA.');
    }

    if (supportsExpenseReceiver && !document.myDataMark) {
      blockers.push(
        'Για χαρακτηρισμό εξόδου χρειάζεται πρώτα MARK από RequestDocs reconciliation.',
      );
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
      canPrepare:
        (supportsSendInvoices || supportsExpenseReceiver) && !alreadySent && !alreadyCancelled,
      canSendMock: supportsSendInvoices && !alreadySent && !alreadyCancelled,
      canSendAade:
        supportsSendInvoices &&
        configuration.canUseApi &&
        !alreadySent &&
        !alreadyCancelled &&
        !failed,
      canForceResend: supportsSendInvoices && failed && configuration.canUseApi,
      canCancelAade:
        supportsSendInvoices &&
        configuration.canUseApi &&
        document.myDataStatus === MyDataStatus.SENT &&
        Boolean(document.myDataMark),
      canPrepareExpense:
        supportsExpenseReceiver &&
        !alreadySent &&
        !alreadyCancelled &&
        Boolean(document.myDataMark),
      canSendExpenseMock:
        supportsExpenseReceiver &&
        !alreadySent &&
        !alreadyCancelled &&
        Boolean(document.myDataMark),
      canSendExpenseAade:
        supportsExpenseReceiver &&
        configuration.canUseApi &&
        !alreadySent &&
        !alreadyCancelled &&
        !failed &&
        Boolean(document.myDataMark),
      canForceExpenseResend:
        supportsExpenseReceiver &&
        configuration.canUseApi &&
        failed &&
        Boolean(document.myDataMark),
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

  private async recordFailedActionAttempt(
    documentId: string,
    requestPayload: string,
    provider: MyDataProvider,
    metadata: {
      message: string;
      code: string;
      rawResponse?: unknown;
      environment?: string;
      endpoint?: string;
      correlationId?: string;
    },
  ): Promise<never> {
    await this.prisma.transmissionAttempt.create({
      data: {
        documentId,
        provider: provider.providerName,
        environment: metadata.environment,
        endpoint: metadata.endpoint,
        correlationId: metadata.correlationId,
        status: TransmissionStatus.FAILED,
        requestPayload,
        errorCode: metadata.code,
        errorMessage: metadata.message,
        responsePayload: {
          status: 'failed',
          errorCode: metadata.code,
          errorMessage: metadata.message,
          rawResponse: this.toJsonValue(metadata.rawResponse),
        },
      },
    });

    throw new BadGatewayException(metadata.message);
  }

  private async latestSnapshotMark(
    accountingOfficeId: string,
    clientCompanyId: string,
    source: MyDataSyncSource,
  ): Promise<string> {
    const snapshots = await this.prisma.myDataSnapshot.findMany({
      where: { accountingOfficeId, clientCompanyId, source },
      select: { mark: true },
    });
    return snapshots.reduce(
      (highest, snapshot) =>
        compareNumericStrings(snapshot.mark, highest) > 0 ? snapshot.mark : highest,
      '0',
    );
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
        lines: {
          orderBy: { lineNumber: 'asc' },
        },
        payments: {
          orderBy: { paymentNumber: 'asc' },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document was not found.');
    }

    return document;
  }

  private expenseClassificationPreview(document: {
    id: string;
    myDataMark: string | null;
    netAmount: Prisma.Decimal;
    vatAmount: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    lines: Array<{
      lineNumber: number;
      description: string | null;
      netAmount: Prisma.Decimal;
      vatAmount: Prisma.Decimal;
      vatCategory: string;
      expenseClassificationType: string | null;
      expenseClassificationCategory: string | null;
      vatClassificationType: string | null;
    }>;
  }) {
    return {
      documentId: document.id,
      invoiceMark: document.myDataMark,
      totals: {
        netAmount: Number(document.netAmount),
        vatAmount: Number(document.vatAmount),
        totalAmount: Number(document.totalAmount),
      },
      lines: document.lines.map((line) => ({
        lineNumber: line.lineNumber,
        description: line.description,
        netAmount: Number(line.netAmount),
        vatAmount: Number(line.vatAmount),
        vatCategory: line.vatCategory,
        expenseClassificationType: line.expenseClassificationType ?? 'E3_102_001',
        expenseClassificationCategory: line.expenseClassificationCategory ?? 'category2_4',
        vatClassificationType: line.vatClassificationType,
      })),
    };
  }

  private async getTenantSnapshot(tenant: TenantContext, id: string) {
    const snapshot = await this.prisma.myDataSnapshot.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId },
    });
    if (!snapshot) throw new NotFoundException('myDATA snapshot was not found.');
    return snapshot;
  }

  private assertSnapshotTotals(
    snapshot: {
      netAmount: Prisma.Decimal | null;
      vatAmount: Prisma.Decimal | null;
      totalAmount: Prisma.Decimal | null;
    },
    lines: SnapshotDocumentLine[],
  ) {
    if (!snapshot.netAmount || !snapshot.vatAmount || !snapshot.totalAmount) {
      throw new BadRequestException('AADE summary totals are required before creating a document.');
    }
    const comparisons = [
      ['net', Number(snapshot.netAmount), sumSnapshotLines(lines, 'netAmount')],
      ['VAT', Number(snapshot.vatAmount), sumSnapshotLines(lines, 'vatAmount')],
      ['gross', Number(snapshot.totalAmount), snapshotTotal(lines)],
    ] as const;
    const mismatch = comparisons.find(([, expected, calculated]) =>
      moneyDiffers(expected, calculated),
    );
    if (mismatch) {
      throw new BadRequestException(
        `AADE ${mismatch[0]} total does not equal the imported line aggregation. Manual review is required.`,
      );
    }
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
      classificationMark: response.classificationMark ?? null,
      cancellationMark: response.cancellationMark ?? null,
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

    if (
      aadeDocument.totalAmount &&
      decimalDiffers(document.totalAmount, aadeDocument.totalAmount)
    ) {
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

  private ensureNotAlreadySent(document: {
    myDataStatus: MyDataStatus;
    myDataMark?: string | null;
  }): void {
    if (document.myDataStatus === MyDataStatus.SENT) {
      throw new BadRequestException(
        'Το παραστατικό έχει ήδη διαβιβαστεί στο myDATA και δεν επιτρέπεται διπλή αποστολή. Χρησιμοποίησε ακύρωση ή διορθωτικό παραστατικό.',
      );
    }

    if (document.myDataStatus === MyDataStatus.CANCELLED) {
      throw new BadRequestException('Το παραστατικό έχει ακυρωθεί στο myDATA.');
    }
  }

  private ensureSendAllowed(
    document: { myDataStatus: MyDataStatus; myDataMark?: string | null },
    force = false,
  ): void {
    this.ensureNotAlreadySent(document);

    if (document.myDataStatus === MyDataStatus.FAILED && !force) {
      throw new BadRequestException(
        'Η προηγούμενη αποστολή απέτυχε. Απαιτείται ρητή εντολή retry ώστε να καταγραφεί στο ιστορικό.',
      );
    }

    if (document.myDataStatus !== MyDataStatus.FAILED && force) {
      throw new BadRequestException('Forced retry επιτρέπεται μόνο μετά από αποτυχημένη αποστολή.');
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
      return this.aadeTestProvider.configuredEnvironment();
    }

    return 'unknown';
  }

  private resolveEntityVatNumberForThirdPartyCall(
    clientCompany: ClientCompany,
  ): string | undefined {
    return clientCompany.myDataMode === MyDataTransmissionMode.ACCOUNTING_OFFICE_AUTHORIZED
      ? clientCompany.vatNumber
      : undefined;
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

interface SnapshotDocumentLine {
  lineNumber: number;
  itemCode?: string;
  description?: string;
  quantity?: number;
  measurementUnit?: number;
  unitPrice?: number;
  discountAmount: number;
  netAmount: number;
  vatAmount: number;
  vatCategory: string;
  vatExemptionCategory?: number;
  withheldAmount: number;
  withheldCategory?: number;
  feesAmount: number;
  feesCategory?: number;
  stampDutyAmount: number;
  stampDutyCategory?: number;
  otherTaxesAmount: number;
  otherTaxesCategory?: number;
  deductionsAmount: number;
  expenseClassificationType?: string;
  expenseClassificationCategory?: string;
  vatClassificationType?: string;
}

function snapshotDocumentLines(rawPayload: unknown): SnapshotDocumentLine[] {
  const details = collectNamedPayloads(rawPayload, 'invoiceDetails');
  if (details.length === 0) {
    throw new BadRequestException('AADE invoice details are missing; automatic creation is unsafe.');
  }
  return details.map((detail, index) => {
    const quantity = optionalNumber(detail, ['quantity']);
    const measurementUnit = optionalNumber(detail, ['measurementUnit']);
    const netAmount = requiredNumber(detail, ['netValue'], `line ${index + 1} net value`);
    const vatCategoryCode = requiredNumber(
      detail,
      ['vatCategory'],
      `line ${index + 1} VAT category`,
    );
    const vatCategory = snapshotVatCategory(vatCategoryCode);
    const expenseClassification = findObjectValue(detail, 'expensesClassification');
    const vatClassification = findObjectValue(detail, 'vatClassification');
    return {
      lineNumber: optionalNumber(detail, ['lineNumber']) ?? index + 1,
      itemCode: emptyStringToUndefined(findFirstValue(detail, ['itemCode'])),
      description: emptyStringToUndefined(
        findFirstValue(detail, ['itemDescr', 'description']),
      ),
      quantity: quantity !== undefined && measurementUnit !== undefined ? quantity : undefined,
      measurementUnit:
        quantity !== undefined && measurementUnit !== undefined ? measurementUnit : undefined,
      unitPrice: quantity && quantity > 0 ? roundSnapshot(netAmount / quantity, 4) : undefined,
      discountAmount: optionalNumber(detail, ['discountAmount']) ?? 0,
      netAmount,
      vatAmount: optionalNumber(detail, ['vatAmount']) ?? 0,
      vatCategory,
      vatExemptionCategory:
        vatCategory === 'VAT_0'
          ? optionalNumber(detail, ['vatExemptionCategory'])
          : undefined,
      withheldAmount: optionalNumber(detail, ['withheldAmount']) ?? 0,
      withheldCategory: positiveCategory(
        detail,
        ['withheldAmount'],
        ['withheldPercentCategory'],
      ),
      feesAmount: optionalNumber(detail, ['feesAmount']) ?? 0,
      feesCategory: positiveCategory(detail, ['feesAmount'], ['feesPercentCategory']),
      stampDutyAmount: optionalNumber(detail, ['stampDutyAmount']) ?? 0,
      stampDutyCategory: positiveCategory(
        detail,
        ['stampDutyAmount'],
        ['stampDutyPercentCategory'],
      ),
      otherTaxesAmount: optionalNumber(detail, ['otherTaxesAmount']) ?? 0,
      otherTaxesCategory: positiveCategory(
        detail,
        ['otherTaxesAmount'],
        ['otherTaxesPercentCategory'],
      ),
      deductionsAmount: optionalNumber(detail, ['deductionsAmount']) ?? 0,
      expenseClassificationType: findFirstValue(expenseClassification, ['classificationType']),
      expenseClassificationCategory: findFirstValue(expenseClassification, [
        'classificationCategory',
      ]),
      vatClassificationType: findFirstValue(vatClassification, ['classificationType']),
    };
  });
}

function snapshotPayments(rawPayload: unknown, totalAmount: number) {
  const details = collectNamedPayloads(rawPayload, 'paymentMethodDetails');
  const payments = details.flatMap((detail, index) => {
    const type = optionalNumber(detail, ['type']);
    const amount = optionalNumber(detail, ['amount']);
    if (!type || amount === undefined) return [];
    return [
      {
        paymentNumber: index + 1,
        type,
        amount,
        paymentMethodInfo: emptyStringToUndefined(findFirstValue(detail, ['paymentMethodInfo'])),
        transactionId: emptyStringToUndefined(findFirstValue(detail, ['transactionId'])),
      },
    ];
  });
  const paymentTotal = roundSnapshot(payments.reduce((sum, payment) => sum + payment.amount, 0));
  return payments.length > 0 && !moneyDiffers(paymentTotal, totalAmount)
    ? payments
    : [{ paymentNumber: 1, type: 3, amount: totalAmount }];
}

function snapshotTotal(lines: SnapshotDocumentLine[]) {
  return roundSnapshot(
    sumSnapshotLines(lines, 'netAmount') +
      sumSnapshotLines(lines, 'vatAmount') -
      sumSnapshotLines(lines, 'withheldAmount') +
      sumSnapshotLines(lines, 'feesAmount') +
      sumSnapshotLines(lines, 'stampDutyAmount') +
      sumSnapshotLines(lines, 'otherTaxesAmount') -
      sumSnapshotLines(lines, 'deductionsAmount'),
  );
}

function snapshotVatBreakdown(lines: SnapshotDocumentLine[]) {
  const breakdown = new Map<string, { vatCategory: string; netAmount: number; vatAmount: number }>();
  for (const line of lines) {
    const current = breakdown.get(line.vatCategory) ?? {
      vatCategory: line.vatCategory,
      netAmount: 0,
      vatAmount: 0,
    };
    current.netAmount = roundSnapshot(current.netAmount + line.netAmount);
    current.vatAmount = roundSnapshot(current.vatAmount + line.vatAmount);
    breakdown.set(line.vatCategory, current);
  }
  return [...breakdown.values()];
}

function sumSnapshotLines(lines: SnapshotDocumentLine[], field: keyof SnapshotDocumentLine) {
  return roundSnapshot(lines.reduce((sum, line) => sum + Number(line[field] ?? 0), 0));
}

function snapshotVatCategory(code: number) {
  const categories: Record<number, string> = {
    1: 'VAT_24',
    2: 'VAT_13',
    3: 'VAT_6',
    4: 'VAT_17',
    5: 'VAT_9',
    6: 'VAT_4',
    7: 'VAT_0',
    8: 'NO_VAT',
    9: 'VAT_3',
  };
  const category = categories[code];
  if (!category) throw new BadRequestException(`Unsupported AADE VAT category ${code}.`);
  return category;
}

function positiveCategory(value: unknown, amountKeys: string[], categoryKeys: string[]) {
  return (optionalNumber(value, amountKeys) ?? 0) > 0
    ? optionalNumber(value, categoryKeys)
    : undefined;
}

function requiredNumber(value: unknown, keys: string[], label: string) {
  const number = optionalNumber(value, keys);
  if (number === undefined) throw new BadRequestException(`AADE ${label} is missing or invalid.`);
  return number;
}

function optionalNumber(value: unknown, keys: string[]): number | undefined {
  const raw = findFirstValue(value, keys);
  if (raw === undefined || raw === '') return undefined;
  const number = Number(raw);
  return Number.isFinite(number) ? number : undefined;
}

function roundSnapshot(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function moneyDiffers(first: number, second: number) {
  return Math.abs(roundSnapshot(first) - roundSnapshot(second)) > 0.009;
}

function collectInvoicePayloads(value: unknown): unknown[] {
  return collectNamedPayloads(value, 'invoice');
}

function collectNamedPayloads(value: unknown, elementName: string): unknown[] {
  const payloads: unknown[] = [];
  collectNamedPayloadsInto(value, elementName.toLowerCase(), payloads);
  return payloads;
}

function collectNamedPayloadsInto(value: unknown, elementName: string, payloads: unknown[]): void {
  if (value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectNamedPayloadsInto(entry, elementName, payloads));
    return;
  }

  if (typeof value !== 'object') {
    return;
  }

  for (const [key, entryValue] of Object.entries(value)) {
    if (key.toLowerCase() === elementName) {
      if (Array.isArray(entryValue)) {
        payloads.push(...entryValue);
      } else if (entryValue !== null && entryValue !== undefined) {
        payloads.push(entryValue);
      }
      continue;
    }

    collectNamedPayloadsInto(entryValue, elementName, payloads);
  }
}

function normalizeAadeCancellations(rawResponse: unknown): Array<{
  invoiceMark: string;
  cancellationMark: string;
  cancellationDate?: Date;
}> {
  return collectNamedPayloads(rawResponse, 'cancelledInvoice').flatMap((payload) => {
    const invoiceMark = findFirstValue(payload, ['invoiceMark']);
    const cancellationMark = findFirstValue(payload, ['cancellationMark']);
    if (!invoiceMark || !cancellationMark) {
      return [];
    }

    return [
      {
        invoiceMark,
        cancellationMark,
        cancellationDate: parseAadeDate(findFirstValue(payload, ['cancellationDate'])),
      },
    ];
  });
}

function normalizeAadeExpenseClassifications(rawResponse: unknown): Array<{
  invoiceMark: string;
  classificationMark?: string;
}> {
  return collectNamedPayloads(rawResponse, 'expensesInvoiceClassification').flatMap((payload) => {
    const invoiceMark = findFirstValue(payload, ['invoiceMark']);
    if (!invoiceMark) {
      return [];
    }

    return [
      {
        invoiceMark,
        classificationMark: findFirstValue(payload, ['classificationMark']),
      },
    ];
  });
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

function compareNumericStrings(left: string, right: string): number {
  const normalizedLeft = left.replace(/^0+/, '') || '0';
  const normalizedRight = right.replace(/^0+/, '') || '0';
  if (normalizedLeft.length !== normalizedRight.length) {
    return normalizedLeft.length - normalizedRight.length;
  }
  return normalizedLeft.localeCompare(normalizedRight);
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
