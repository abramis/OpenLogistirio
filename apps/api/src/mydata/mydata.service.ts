import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClientCompany,
  DocumentType,
  MyDataStatus,
  MyDataTransmissionMode,
  Prisma,
  TransmissionStatus,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { AadeMyDataTestProvider } from './aade-mydata-test.provider';
import { MockMyDataProvider } from './mydata-mock.service';
import { MyDataMappingService } from './mydata-mapping.service';
import { MyDataProvider, MyDataTransmissionResponse } from './mydata-provider.interface';

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

  async sendMock(tenant: TenantContext, documentId: string) {
    return this.sendWithProvider(tenant, documentId, this.mockProvider);
  }

  async sendTest(tenant: TenantContext, documentId: string) {
    return this.sendWithProvider(tenant, documentId, this.aadeTestProvider);
  }

  async prepareExpense(tenant: TenantContext, documentId: string) {
    const document = await this.getTenantDocument(tenant, documentId);
    this.ensurePurchaseInvoice(document.documentType);
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
  ) {
    const document = await this.getTenantDocument(tenant, documentId);
    const xml = document.myDataXmlPreview ?? this.mappingService.mapDocumentToXml(document);

    try {
      const response = await provider.transmitInvoice({
        documentId: document.id,
        payloadXml: xml,
        credentialEnvPrefix: this.resolveCredentialEnvPrefix(provider, document.clientCompany),
      });

      if (response.status === 'failed') {
        return this.recordFailedTransmission(
          document.id,
          xml,
          provider.providerName,
          response.errorMessage,
          response.errorCode ?? 'MYDATA_FAILED',
          response.rawResponse,
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

  private async recordFailedTransmission(
    documentId: string,
    xml: string,
    providerName: string,
    message = 'myDATA transmission failed.',
    code = 'MYDATA_FAILED',
    rawResponse?: unknown,
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
}
