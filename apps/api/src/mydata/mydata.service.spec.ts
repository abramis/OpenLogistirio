import { BadGatewayException, BadRequestException } from '@nestjs/common';
import {
  ClientEntityType,
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
import { MyDataService } from './mydata.service';

const tenant: TenantContext = {
  accountingOfficeId: 'office-1',
  userId: 'user-1',
};

const document = {
  id: 'document-1',
  accountingOfficeId: 'office-1',
  clientCompanyId: 'company-1',
  documentType: DocumentType.SALES_INVOICE,
  series: 'A',
  documentNumber: '12',
  issueDate: new Date('2026-07-01T00:00:00.000Z'),
  counterpartyName: 'Customer & Co',
  counterpartyVatNumber: '123456789',
  netAmount: new Prisma.Decimal('100.00'),
  vatAmount: new Prisma.Decimal('24.00'),
  totalAmount: new Prisma.Decimal('124.00'),
  vatCategory: 'VAT_24',
  myDataStatus: MyDataStatus.DRAFT,
  myDataMark: null,
  myDataUid: null,
  myDataQrUrl: null,
  myDataXmlPreview: null,
  classificationStatus: null,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  deletedAt: null,
  clientCompany: {
    id: 'company-1',
    accountingOfficeId: 'office-1',
    legalName: 'Demo <Company>',
    tradeName: null,
    entityType: ClientEntityType.COMPANY,
    professionLabel: null,
    vatNumber: '999888777',
    taxOffice: null,
    activityCodes: null,
    address: null,
    email: null,
    phone: null,
    vatRegime: null,
    accountingCategory: null,
    myDataMode: MyDataTransmissionMode.ACCOUNTING_OFFICE_AUTHORIZED,
    myDataAuthorized: true,
    myDataCredentialRef: null,
    fiscalYearStart: 1,
    fiscalYearEnd: 12,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    deletedAt: null,
  },
};

describe('MyDataMappingService', () => {
  it('maps an internal document to escaped AADE InvoicesDoc XML', () => {
    const xml = new MyDataMappingService().mapDocumentToXml(document);

    expect(xml).toContain('<InvoicesDoc');
    expect(xml).toContain('<vatNumber>999888777</vatNumber>');
    expect(xml).toContain('<name>Demo &lt;Company&gt;</name>');
    expect(xml).toContain('<name>Customer &amp; Co</name>');
    expect(xml).toContain('<invoiceType>1.1</invoiceType>');
    expect(xml).toContain('<totalGrossValue>124.00</totalGrossValue>');
  });

  it('rejects purchase invoices because they need the expenses flow', () => {
    const purchaseDocument = {
      ...document,
      documentType: DocumentType.PURCHASE_INVOICE,
    };

    expect(() => new MyDataMappingService().mapDocumentToXml(purchaseDocument)).toThrow(
      BadRequestException,
    );
  });
});

describe('MyDataService', () => {
  let prisma: {
    document: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    transmissionAttempt: {
      create: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let provider: jest.Mocked<Pick<MockMyDataProvider, 'providerName' | 'transmitInvoice'>>;
  let aadeTestProvider: jest.Mocked<
    Pick<AadeMyDataTestProvider, 'providerName' | 'transmitInvoice'>
  >;
  let service: MyDataService;

  beforeEach(() => {
    prisma = {
      document: {
        findFirst: jest.fn().mockResolvedValue(document),
        update: jest.fn().mockResolvedValue(document),
      },
      transmissionAttempt: {
        create: jest.fn().mockResolvedValue({ id: 'attempt-1' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'attempt-1' }]),
      },
    };

    provider = {
      providerName: 'mock-mydata',
      transmitInvoice: jest.fn().mockResolvedValue({
        status: 'sent',
        mark: 'MOCK-MARK-document-1',
        uid: 'MOCK-UID-document-1',
        qrUrl: 'https://mydata.example.invalid/mock/document-1',
      }),
    };
    aadeTestProvider = {
      providerName: 'aade-mydata-test',
      transmitInvoice: jest.fn(),
    };

    service = new MyDataService(
      prisma as unknown as PrismaService,
      new MyDataMappingService(),
      provider as MockMyDataProvider,
      aadeTestProvider as unknown as AadeMyDataTestProvider,
    );
  });

  it('prepares and stores an XML preview', async () => {
    const result = await service.prepare(tenant, 'document-1');

    expect(result.status).toBe(MyDataStatus.READY_TO_SEND);
    expect(result.xml).toContain('<aa>12</aa>');
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'document-1' },
      data: {
        myDataStatus: MyDataStatus.READY_TO_SEND,
        myDataXmlPreview: expect.stringContaining('<InvoicesDoc'),
      },
    });
    expect(prisma.transmissionAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        documentId: 'document-1',
        provider: 'mock-mydata',
        status: TransmissionStatus.PREPARED,
      }),
    });
  });

  it('sends through the mock provider and stores fake identifiers', async () => {
    const result = await service.sendMock(tenant, 'document-1');

    expect(result.status).toBe(MyDataStatus.SENT);
    expect(result.mark).toBe('MOCK-MARK-document-1');
    expect(provider.transmitInvoice).toHaveBeenCalledWith({
      documentId: 'document-1',
      payloadXml: expect.stringContaining('<InvoicesDoc'),
      credentialEnvPrefix: undefined,
    });
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'document-1' },
      data: expect.objectContaining({
        myDataStatus: MyDataStatus.SENT,
        myDataMark: 'MOCK-MARK-document-1',
        myDataUid: 'MOCK-UID-document-1',
        myDataQrUrl: 'https://mydata.example.invalid/mock/document-1',
      }),
    });
  });

  it('stores failed mock transmissions', async () => {
    provider.transmitInvoice.mockRejectedValue(new Error('mock provider unavailable'));

    await expect(service.sendMock(tenant, 'document-1')).rejects.toBeInstanceOf(
      BadGatewayException,
    );

    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'document-1' },
      data: {
        myDataStatus: MyDataStatus.FAILED,
        myDataXmlPreview: expect.stringContaining('<InvoicesDoc'),
      },
    });
    expect(prisma.transmissionAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        documentId: 'document-1',
        provider: 'mock-mydata',
        status: TransmissionStatus.FAILED,
        errorCode: 'MYDATA_EXCEPTION',
        errorMessage: 'mock provider unavailable',
      }),
    });
  });

  it('sends through the AADE test provider', async () => {
    aadeTestProvider.transmitInvoice.mockResolvedValue({
      status: 'sent',
      mark: 'AADE-TEST-MARK',
      uid: 'AADE-TEST-UID',
      qrUrl: 'https://mydata.aade.gr/qr/test',
    });

    const result = await service.sendTest(tenant, 'document-1');

    expect(result.status).toBe(MyDataStatus.SENT);
    expect(aadeTestProvider.transmitInvoice).toHaveBeenCalledWith({
      documentId: 'document-1',
      payloadXml: expect.stringContaining('<InvoicesDoc'),
      credentialEnvPrefix: 'AADE_MYDATA',
    });
    expect(prisma.transmissionAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        documentId: 'document-1',
        provider: 'aade-mydata-test',
        status: TransmissionStatus.SENT,
      }),
    });
  });

  it('returns transmission history for a tenant-scoped document', async () => {
    const result = await service.history(tenant, 'document-1');

    expect(result).toEqual([{ id: 'attempt-1' }]);
    expect(prisma.transmissionAttempt.findMany).toHaveBeenCalledWith({
      where: { documentId: 'document-1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('requires per-client AADE authorization before real test send', async () => {
    prisma.document.findFirst.mockResolvedValue({
      ...document,
      clientCompany: {
        ...document.clientCompany,
        myDataAuthorized: false,
      },
    });

    await expect(service.sendTest(tenant, 'document-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(aadeTestProvider.transmitInvoice).not.toHaveBeenCalled();
  });
});
