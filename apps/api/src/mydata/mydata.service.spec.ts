import { BadGatewayException, BadRequestException } from '@nestjs/common';
import {
  ClientEntityType,
  DocumentType,
  ExpenseClassificationApprovalStatus,
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
import { SyncMyDataDocsSourceDto } from './dto/sync-mydata-docs.dto';
import { ExpenseClassificationApprovalActionDto } from './dto/approve-expense-classification.dto';
import { MockMyDataProvider } from './mydata-mock.service';
import { MyDataMappingService } from './mydata-mapping.service';
import { MyDataService } from './mydata.service';
import { MyDataXmlValidationService } from './mydata-xml-validation.service';

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
  movementCode: 'SALE_INVOICE',
  journalCode: 'SALES',
  netAmount: new Prisma.Decimal('100.00'),
  vatAmount: new Prisma.Decimal('24.00'),
  totalAmount: new Prisma.Decimal('124.00'),
  vatCategory: 'VAT_24',
  paymentMethodType: 3,
  vatExemptionCategory: null,
  correlatedInvoiceMark: null,
  withheldAmount: new Prisma.Decimal('0.00'),
  withheldCategory: null,
  feesAmount: new Prisma.Decimal('0.00'),
  feesCategory: null,
  stampDutyAmount: new Prisma.Decimal('0.00'),
  stampDutyCategory: null,
  otherTaxesAmount: new Prisma.Decimal('0.00'),
  otherTaxesCategory: null,
  deductionsAmount: new Prisma.Decimal('0.00'),
  myDataStatus: MyDataStatus.DRAFT,
  myDataMark: null,
  myDataUid: null,
  myDataQrUrl: null,
  myDataClassificationMark: null,
  myDataCancellationMark: null,
  myDataCancelledAt: null,
  myDataXmlPreview: null,
  classificationStatus: null,
  expenseClassificationApprovalStatus: ExpenseClassificationApprovalStatus.NOT_REQUESTED,
  expenseClassificationApprovedById: null,
  expenseClassificationApprovedAt: null,
  expenseClassificationApprovalNotes: null,
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
    expect(xml).not.toContain('<name>Demo &lt;Company&gt;</name>');
    expect(xml).not.toContain('<name>Customer &amp; Co</name>');
    expect(xml).toContain('<invoiceType>1.1</invoiceType>');
    expect(xml).toContain('<icls:classificationType>E3_561_001</icls:classificationType>');
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

  it('maps payment, invoice-level taxes and correlated credit note fields', () => {
    const creditDocument = {
      ...document,
      documentType: DocumentType.CREDIT_NOTE,
      paymentMethodType: 5,
      correlatedInvoiceMark: '4000012345',
      withheldAmount: new Prisma.Decimal('20.00'),
      withheldCategory: 3,
      feesAmount: new Prisma.Decimal('1.00'),
      feesCategory: 10,
      stampDutyAmount: new Prisma.Decimal('1.20'),
      stampDutyCategory: 1,
      otherTaxesAmount: new Prisma.Decimal('2.00'),
      otherTaxesCategory: 17,
      deductionsAmount: new Prisma.Decimal('0.20'),
      totalAmount: new Prisma.Decimal('108.00'),
    };

    const xml = new MyDataMappingService().mapDocumentToXml(creditDocument);

    expect(xml).toContain('<invoiceType>5.1</invoiceType>');
    expect(xml).toContain('<correlatedInvoices>4000012345</correlatedInvoices>');
    expect(xml).not.toContain('<itemDescr>');
    expect(xml).toContain('<type>5</type>');
    expect(xml).toContain('<taxType>1</taxType>');
    expect(xml).toContain('<taxCategory>3</taxCategory>');
    expect(xml).toContain('<taxType>5</taxType>');
    expect(xml).toContain('<totalWithheldAmount>20.00</totalWithheldAmount>');
    expect(xml).toContain('<totalGrossValue>108.00</totalGrossValue>');
    expect(() => new MyDataXmlValidationService().validateInvoices(xml)).not.toThrow();
  });

  it('maps multiple payment methods including POS, provider and ECR fields', () => {
    const xml = new MyDataMappingService().mapDocumentToXml({
      ...document,
      payments: [
        {
          paymentNumber: 1,
          type: 3,
          amount: new Prisma.Decimal('24.00'),
        },
        {
          paymentNumber: 2,
          type: 7,
          amount: new Prisma.Decimal('100.00'),
          paymentMethodInfo: 'POS front desk',
          transactionId: 'txn-1',
          tid: 'POS-1',
          providerSigningAuthor: 'provider-1',
          providerSignature: 'signature-1',
          ecrSigningAuthor: 'ECR-1',
          ecrSessionNumber: '123456',
        },
      ],
    });

    expect(xml.match(/<paymentMethodDetails>/g)).toHaveLength(2);
    expect(xml).toContain('<transactionId>txn-1</transactionId>');
    expect(xml).toContain('<tid>POS-1</tid>');
    expect(xml).toContain('<ProvidersSignature>');
    expect(xml).toContain('<ECRToken>');
    expect(() => new MyDataXmlValidationService().validateInvoices(xml)).not.toThrow();
  });

  it('maps an uncorrelated credit note to AADE type 5.2', () => {
    const xml = new MyDataMappingService().mapDocumentToXml({
      ...document,
      documentType: DocumentType.CREDIT_NOTE,
    });

    expect(xml).toContain('<invoiceType>5.2</invoiceType>');
    expect(xml).not.toContain('<correlatedInvoices>');
  });

  it('maps a matched purchase invoice to AADE expenses classification XML', () => {
    const purchaseDocument = {
      ...document,
      documentType: DocumentType.PURCHASE_INVOICE,
      myDataMark: '4000012345',
    };

    const xml = new MyDataMappingService().mapPurchaseDocumentToExpenseClassificationXml(
      purchaseDocument,
    );

    expect(xml).toContain('<ExpensesClassificationsDoc');
    expect(xml).toContain('<invoiceMark>4000012345</invoiceMark>');
    expect(xml).toContain('<entityVatNumber>999888777</entityVatNumber>');
    expect(xml).toContain('<classificationType>E3_102_001</classificationType>');
    expect(xml).toContain('<classificationCategory>category2_4</classificationCategory>');
    expect(xml).toContain('<classificationType>VAT_361</classificationType>');
    expect(xml).toContain('<vatCategory>1</vatCategory>');
    expect(xml).toContain('<classificationPostMode>1</classificationPostMode>');
    expect(() =>
      new MyDataXmlValidationService().validateExpenseClassifications(xml),
    ).not.toThrow();
  });

  it('validates generated invoices against the official AADE v2.0.1 XSD', () => {
    const xml = new MyDataMappingService().mapDocumentToXml(document);

    expect(() => new MyDataXmlValidationService().validateInvoices(xml)).not.toThrow();
  });

  it('maps each document line with its own VAT, quantity and classification', () => {
    const xml = new MyDataMappingService().mapDocumentToXml({
      ...document,
      netAmount: new Prisma.Decimal('150.00'),
      vatAmount: new Prisma.Decimal('30.00'),
      totalAmount: new Prisma.Decimal('180.00'),
      vatCategory: 'MULTIPLE',
      lines: [
        {
          lineNumber: 1,
          itemCode: 'SERV-1',
          description: 'Υπηρεσία 24%',
          quantity: new Prisma.Decimal('1.000'),
          measurementUnit: 7,
          discountOption: null,
          netAmount: new Prisma.Decimal('100.00'),
          vatAmount: new Prisma.Decimal('24.00'),
          vatCategory: 'VAT_24',
          vatExemptionCategory: null,
          withheldAmount: new Prisma.Decimal('0'),
          withheldCategory: null,
          feesAmount: new Prisma.Decimal('0'),
          feesCategory: null,
          stampDutyAmount: new Prisma.Decimal('0'),
          stampDutyCategory: null,
          otherTaxesAmount: new Prisma.Decimal('0'),
          otherTaxesCategory: null,
          deductionsAmount: new Prisma.Decimal('0'),
          incomeClassificationType: 'E3_561_001',
          incomeClassificationCategory: 'category1_1',
          expenseClassificationType: null,
          expenseClassificationCategory: null,
          vatClassificationType: null,
        },
        {
          lineNumber: 2,
          itemCode: null,
          description: 'Έντυπο 6%',
          quantity: new Prisma.Decimal('2.000'),
          measurementUnit: 1,
          discountOption: null,
          netAmount: new Prisma.Decimal('50.00'),
          vatAmount: new Prisma.Decimal('6.00'),
          vatCategory: 'VAT_6',
          vatExemptionCategory: null,
          withheldAmount: new Prisma.Decimal('0'),
          withheldCategory: null,
          feesAmount: new Prisma.Decimal('0'),
          feesCategory: null,
          stampDutyAmount: new Prisma.Decimal('0'),
          stampDutyCategory: null,
          otherTaxesAmount: new Prisma.Decimal('0'),
          otherTaxesCategory: null,
          deductionsAmount: new Prisma.Decimal('0'),
          incomeClassificationType: 'E3_561_001',
          incomeClassificationCategory: 'category1_1',
          expenseClassificationType: null,
          expenseClassificationCategory: null,
          vatClassificationType: null,
        },
      ],
    });

    expect(xml).toContain('<lineNumber>1</lineNumber>');
    expect(xml).toContain('<lineNumber>2</lineNumber>');
    expect(xml).toContain('<itemCode>SERV-1</itemCode>');
    expect(xml).toContain('<quantity>2</quantity>');
    expect(xml).toContain('<vatCategory>1</vatCategory>');
    expect(xml).toContain('<vatCategory>3</vatCategory>');
    expect(xml).toContain('<totalNetValue>150.00</totalNetValue>');
    expect(() => new MyDataXmlValidationService().validateInvoices(xml)).not.toThrow();
  });

  it('rejects expense XML that violates the official AADE v2.0.1 XSD', () => {
    const purchaseDocument = {
      ...document,
      documentType: DocumentType.PURCHASE_INVOICE,
      myDataMark: '4000012345',
    };
    const xml = new MyDataMappingService()
      .mapPurchaseDocumentToExpenseClassificationXml(purchaseDocument)
      .replace(
        '<classificationPostMode>1</classificationPostMode>',
        '<classificationPostMode>2</classificationPostMode>',
      );

    expect(() => new MyDataXmlValidationService().validateExpenseClassifications(xml)).toThrow(
      BadRequestException,
    );
  });

  it('requires an AADE MARK before preparing expense classification XML', () => {
    const purchaseDocument = {
      ...document,
      documentType: DocumentType.PURCHASE_INVOICE,
    };

    expect(() =>
      new MyDataMappingService().mapPurchaseDocumentToExpenseClassificationXml(purchaseDocument),
    ).toThrow(BadRequestException);
  });
});

describe('MyDataService', () => {
  let prisma: {
    $transaction: jest.Mock;
    document: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    clientCompany: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    myDataSyncRun: {
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
    myDataSnapshot: {
      upsert: jest.Mock;
      groupBy: jest.Mock;
      findMany: jest.Mock;
    };
    transmissionAttempt: {
      create: jest.Mock;
      findMany: jest.Mock;
    };
    auditLog: {
      create: jest.Mock;
    };
  };
  let provider: jest.Mocked<Pick<MockMyDataProvider, 'providerName' | 'transmitInvoice'>>;
  let aadeTestProvider: jest.Mocked<
    Pick<
      AadeMyDataTestProvider,
      | 'providerName'
      | 'configuredEnvironment'
      | 'transmitInvoice'
      | 'transmitExpenseClassification'
      | 'cancelInvoice'
      | 'requestDocs'
    >
  >;
  let service: MyDataService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      document: {
        findFirst: jest.fn().mockResolvedValue(document),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(document),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      clientCompany: {
        findFirst: jest.fn().mockResolvedValue(document.clientCompany),
        findMany: jest.fn().mockResolvedValue([]),
      },
      myDataSyncRun: {
        create: jest.fn().mockResolvedValue({ id: 'sync-1' }),
        update: jest.fn().mockResolvedValue({ id: 'sync-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      myDataSnapshot: {
        upsert: jest.fn(),
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
      },
      transmissionAttempt: {
        create: jest.fn().mockResolvedValue({ id: 'attempt-1' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'attempt-1' }]),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );

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
      providerName: 'aade-mydata',
      configuredEnvironment: jest.fn().mockReturnValue('test'),
      transmitInvoice: jest.fn(),
      transmitExpenseClassification: jest.fn(),
      cancelInvoice: jest.fn(),
      requestDocs: jest.fn(),
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
      force: undefined,
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
      force: undefined,
    });
    expect(prisma.transmissionAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        documentId: 'document-1',
        provider: 'aade-mydata',
        status: TransmissionStatus.SENT,
      }),
    });
  });

  it('does not overwrite already-sent documents on prepare', async () => {
    prisma.document.findFirst.mockResolvedValue({
      ...document,
      myDataStatus: MyDataStatus.SENT,
      myDataMark: 'EXISTING-MARK',
    });

    await expect(service.prepare(tenant, 'document-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  it('blocks duplicate sends even when force is requested', async () => {
    prisma.document.findFirst.mockResolvedValue({
      ...document,
      myDataStatus: MyDataStatus.SENT,
      myDataMark: 'EXISTING-MARK',
    });

    await expect(service.sendTest(tenant, 'document-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.sendTest(tenant, 'document-1', { force: true })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(aadeTestProvider.transmitInvoice).not.toHaveBeenCalled();
  });

  it('requires an explicit retry after a failed transmission', async () => {
    prisma.document.findFirst.mockResolvedValue({
      ...document,
      myDataStatus: MyDataStatus.FAILED,
    });

    await expect(service.sendTest(tenant, 'document-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(aadeTestProvider.transmitInvoice).not.toHaveBeenCalled();
  });

  it('records forced retries explicitly', async () => {
    prisma.document.findFirst.mockResolvedValue({
      ...document,
      myDataStatus: MyDataStatus.FAILED,
      myDataXmlPreview: '<InvoicesDoc><stale-preview /></InvoicesDoc>',
    });
    aadeTestProvider.transmitInvoice.mockResolvedValue({
      status: 'sent',
      environment: 'test',
      endpoint: 'https://mydataapidev.aade.gr/SendInvoices',
      mark: 'AADE-TEST-MARK-2',
      uid: 'AADE-TEST-UID-2',
    });

    await service.sendTest(tenant, 'document-1', { force: true });

    expect(aadeTestProvider.transmitInvoice).toHaveBeenCalledWith({
      documentId: 'document-1',
      payloadXml: expect.stringContaining('<InvoicesDoc'),
      credentialEnvPrefix: 'AADE_MYDATA',
      force: true,
    });
    expect(aadeTestProvider.transmitInvoice.mock.calls[0][0].payloadXml).not.toContain(
      'stale-preview',
    );
    expect(prisma.transmissionAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        documentId: 'document-1',
        provider: 'aade-mydata',
        environment: 'test',
        endpoint: 'https://mydataapidev.aade.gr/SendInvoices',
        forcedRetry: true,
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

  it('sends expense classification through the AADE test provider', async () => {
    prisma.document.findFirst.mockResolvedValue({
      ...document,
      documentType: DocumentType.PURCHASE_INVOICE,
      myDataMark: '4000012345',
    });
    aadeTestProvider.transmitExpenseClassification.mockResolvedValue({
      status: 'sent',
      environment: 'test',
      endpoint: 'https://mydataapidev.aade.gr/SendExpensesClassification',
      mark: '4000012345',
      classificationMark: '9000012345',
    });

    const result = await service.sendExpenseTest(tenant, 'document-1');

    expect(result.status).toBe(MyDataStatus.SENT);
    expect(result.classificationMark).toBe('9000012345');
    expect(aadeTestProvider.transmitExpenseClassification).toHaveBeenCalledWith({
      documentId: 'document-1',
      payloadXml: expect.stringContaining('<ExpensesClassificationsDoc'),
      postPerInvoice: true,
      force: undefined,
      credentialEnvPrefix: 'AADE_MYDATA',
    });
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'document-1' },
      data: expect.objectContaining({
        myDataStatus: MyDataStatus.SENT,
        myDataMark: '4000012345',
        myDataClassificationMark: '9000012345',
        classificationStatus: 'EXPENSE_CLASSIFIED_AADE',
      }),
    });
    expect(prisma.transmissionAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        documentId: 'document-1',
        provider: 'aade-mydata',
        environment: 'test',
        endpoint: 'https://mydataapidev.aade.gr/SendExpensesClassification',
        status: TransmissionStatus.SENT,
      }),
    });
  });

  it('blocks production expense classification without a fresh explicit approval', async () => {
    aadeTestProvider.configuredEnvironment.mockReturnValue('production');
    prisma.document.findFirst.mockResolvedValue({
      ...document,
      documentType: DocumentType.PURCHASE_INVOICE,
      myDataMark: '4000012345',
      classificationStatus: 'EXPENSE_PREPARED',
      expenseClassificationApprovalStatus: ExpenseClassificationApprovalStatus.PENDING,
    });

    await expect(service.sendExpenseTest(tenant, 'document-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(aadeTestProvider.transmitExpenseClassification).not.toHaveBeenCalled();
  });

  it('records an explicit expense classification approval with audit', async () => {
    const preparedPurchase = {
      ...document,
      documentType: DocumentType.PURCHASE_INVOICE,
      myDataMark: '4000012345',
      classificationStatus: 'EXPENSE_PREPARED',
      expenseClassificationApprovalStatus: ExpenseClassificationApprovalStatus.PENDING,
    };
    prisma.document.findMany.mockResolvedValue([preparedPurchase]);
    prisma.document.update.mockResolvedValue({
      ...preparedPurchase,
      expenseClassificationApprovalStatus: ExpenseClassificationApprovalStatus.APPROVED,
    });

    const result = await service.approveExpenseClassification(tenant, 'document-1', {
      action: ExpenseClassificationApprovalActionDto.APPROVE,
      notes: 'Checked VAT and expense category.',
    });

    expect(result.expenseClassificationApprovalStatus).toBe(
      ExpenseClassificationApprovalStatus.APPROVED,
    );
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'document-1' },
      data: expect.objectContaining({
        expenseClassificationApprovalStatus: ExpenseClassificationApprovalStatus.APPROVED,
        expenseClassificationApprovedById: 'user-1',
        expenseClassificationApprovedAt: expect.any(Date),
      }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'ExpenseClassificationApproval',
        entityId: 'document-1',
      }),
    });
  });

  it('cancels an already-sent issued document through the AADE test provider', async () => {
    prisma.document.findFirst.mockResolvedValue({
      ...document,
      myDataStatus: MyDataStatus.SENT,
      myDataMark: '4000012345',
    });
    aadeTestProvider.cancelInvoice.mockResolvedValue({
      status: 'sent',
      environment: 'test',
      endpoint:
        'https://mydataapidev.aade.gr/CancelInvoice?mark=4000012345&entityVatNumber=999888777',
      mark: '4000012345',
      cancellationMark: '7000012345',
    });

    const result = await service.cancelTest(tenant, 'document-1');

    expect(result.status).toBe(MyDataStatus.CANCELLED);
    expect(result.cancellationMark).toBe('7000012345');
    expect(aadeTestProvider.cancelInvoice).toHaveBeenCalledWith({
      documentId: 'document-1',
      mark: '4000012345',
      entityVatNumber: '999888777',
      credentialEnvPrefix: 'AADE_MYDATA',
    });
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'document-1' },
      data: {
        myDataStatus: MyDataStatus.CANCELLED,
        myDataCancellationMark: '7000012345',
        myDataCancelledAt: expect.any(Date),
      },
    });
    expect(prisma.transmissionAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        documentId: 'document-1',
        provider: 'aade-mydata',
        environment: 'test',
        endpoint:
          'https://mydataapidev.aade.gr/CancelInvoice?mark=4000012345&entityVatNumber=999888777',
        status: TransmissionStatus.SENT,
        requestPayload: 'CancelInvoice mark=4000012345',
      }),
    });
  });

  it('records failed cancellation attempts without changing document status', async () => {
    prisma.document.findFirst.mockResolvedValue({
      ...document,
      myDataStatus: MyDataStatus.SENT,
      myDataMark: '4000012345',
    });
    aadeTestProvider.cancelInvoice.mockResolvedValue({
      status: 'failed',
      environment: 'test',
      endpoint: 'https://mydataapidev.aade.gr/CancelInvoice?mark=4000012345',
      errorCode: 'AADE_CANCEL_REJECTED',
      errorMessage: 'Cancellation rejected',
      rawResponse: { error: 'rejected' },
    });

    await expect(service.cancelTest(tenant, 'document-1')).rejects.toBeInstanceOf(
      BadGatewayException,
    );

    expect(prisma.document.update).not.toHaveBeenCalled();
    expect(prisma.transmissionAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        documentId: 'document-1',
        provider: 'aade-mydata',
        environment: 'test',
        endpoint: 'https://mydataapidev.aade.gr/CancelInvoice?mark=4000012345',
        status: TransmissionStatus.FAILED,
        errorCode: 'AADE_CANCEL_REJECTED',
        errorMessage: 'Cancellation rejected',
      }),
    });
  });

  it('applies cancellation and expense classification MARKs returned by RequestDocs', async () => {
    aadeTestProvider.requestDocs.mockResolvedValue({
      status: 'received',
      environment: 'test',
      endpoint: 'https://mydataapidev.aade.gr/RequestDocs?mark=0',
      rawResponse: {
        RequestedDoc: {
          cancelledInvoicesDoc: {
            cancelledInvoice: {
              invoiceMark: '4000012345',
              cancellationMark: '7000012345',
              cancellationDate: '2026-07-13',
            },
          },
          expensesClassificationsDoc: {
            expensesInvoiceClassification: {
              invoiceMark: '4000012345',
              classificationMark: '9000012345',
            },
          },
        },
      },
    });

    const result = await service.syncRequestDocs(tenant, {
      clientCompanyId: 'company-1',
      source: SyncMyDataDocsSourceDto.REQUEST_DOCS,
    });

    expect(result).toEqual(
      expect.objectContaining({
        cancellationCount: 1,
        cancellationsApplied: 1,
        expenseClassificationCount: 1,
        classificationsApplied: 1,
      }),
    );
    expect(prisma.document.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        accountingOfficeId: 'office-1',
        clientCompanyId: 'company-1',
        myDataMark: '4000012345',
        deletedAt: null,
      },
      data: {
        myDataStatus: MyDataStatus.CANCELLED,
        myDataCancellationMark: '7000012345',
        myDataCancelledAt: new Date('2026-07-13T00:00:00.000Z'),
      },
    });
    expect(prisma.document.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        accountingOfficeId: 'office-1',
        clientCompanyId: 'company-1',
        myDataMark: '4000012345',
        deletedAt: null,
      },
      data: {
        myDataClassificationMark: '9000012345',
        classificationStatus: 'EXPENSE_CLASSIFIED_AADE',
        expenseClassificationApprovalStatus: ExpenseClassificationApprovalStatus.CONSUMED,
      },
    });
  });

  it('synchronizes authorized office clients sequentially and follows AADE pagination', async () => {
    prisma.clientCompany.findMany.mockResolvedValue([
      { id: 'company-1', legalName: 'Alpha' },
      { id: 'company-2', legalName: 'Beta' },
    ]);
    const syncRun = {
      id: 'run-1',
      accountingOfficeId: 'office-1',
      clientCompanyId: 'company-1',
      source: MyDataSyncSource.REQUEST_DOCS,
      status: MyDataSyncRunStatus.COMPLETED,
      environment: 'test',
      endpoint: null,
      markFrom: '0',
      maxMark: null,
      dateFrom: null,
      dateTo: null,
      fetchedCount: 0,
      matchedCount: 0,
      mismatchCount: 0,
      errorMessage: null,
      rawResponse: null,
      createdAt: new Date(),
    };
    const syncSpy = jest
      .spyOn(service, 'syncRequestDocs')
      .mockResolvedValueOnce({
        syncRun,
        fetchedCount: 10,
        matchedCount: 8,
        mismatchCount: 2,
        cancellationCount: 0,
        cancellationsApplied: 0,
        expenseClassificationCount: 0,
        classificationsApplied: 0,
        nextPartitionKey: 'partition-1',
        nextRowKey: 'row-1',
      })
      .mockResolvedValueOnce({
        syncRun: { ...syncRun, id: 'run-2' },
        fetchedCount: 3,
        matchedCount: 3,
        mismatchCount: 0,
        cancellationCount: 0,
        cancellationsApplied: 0,
        expenseClassificationCount: 0,
        classificationsApplied: 0,
        nextPartitionKey: undefined,
        nextRowKey: undefined,
      })
      .mockResolvedValueOnce({
        syncRun: { ...syncRun, id: 'run-3', clientCompanyId: 'company-2' },
        fetchedCount: 5,
        matchedCount: 4,
        mismatchCount: 1,
        cancellationCount: 0,
        cancellationsApplied: 0,
        expenseClassificationCount: 0,
        classificationsApplied: 0,
        nextPartitionKey: undefined,
        nextRowKey: undefined,
      });

    const result = await service.syncOffice(tenant, {
      sources: [SyncMyDataDocsSourceDto.REQUEST_DOCS],
      maxPages: 10,
    });

    expect(syncSpy).toHaveBeenCalledTimes(3);
    expect(syncSpy).toHaveBeenNthCalledWith(
      2,
      tenant,
      expect.objectContaining({
        clientCompanyId: 'company-1',
        nextPartitionKey: 'partition-1',
        nextRowKey: 'row-1',
      }),
    );
    expect(syncSpy).toHaveBeenNthCalledWith(
      3,
      tenant,
      expect.objectContaining({ clientCompanyId: 'company-2' }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        companyCount: 2,
        completedCount: 2,
        failedCount: 0,
        fetchedCount: 18,
        matchedCount: 15,
        mismatchCount: 3,
      }),
    );
  });

  it('starts an incremental office sync from the highest stored MARK', async () => {
    prisma.clientCompany.findMany.mockResolvedValue([{ id: 'company-1', legalName: 'Alpha' }]);
    prisma.myDataSnapshot.findMany.mockResolvedValue([
      { mark: '9' },
      { mark: '100' },
      { mark: '20' },
    ]);
    const syncSpy = jest.spyOn(service, 'syncRequestDocs').mockResolvedValue({
      syncRun: { id: 'run-1' } as never,
      fetchedCount: 0,
      matchedCount: 0,
      mismatchCount: 0,
      cancellationCount: 0,
      cancellationsApplied: 0,
      expenseClassificationCount: 0,
      classificationsApplied: 0,
      nextPartitionKey: undefined,
      nextRowKey: undefined,
    });

    await service.syncOffice(tenant, {
      sources: [SyncMyDataDocsSourceDto.REQUEST_DOCS],
      maxPages: 1,
      incremental: true,
    });

    expect(syncSpy).toHaveBeenCalledWith(
      tenant,
      expect.objectContaining({ clientCompanyId: 'company-1', mark: '100' }),
    );
  });

  it('builds an office-wide exception dashboard without exposing raw AADE payloads', async () => {
    prisma.clientCompany.findMany.mockResolvedValue([
      {
        id: 'company-1',
        legalName: 'Alpha',
        vatNumber: '999888777',
        myDataAuthorized: true,
        myDataMode: MyDataTransmissionMode.ACCOUNTING_OFFICE_AUTHORIZED,
      },
    ]);
    prisma.myDataSnapshot.groupBy.mockResolvedValue([
      {
        clientCompanyId: 'company-1',
        source: MyDataSyncSource.REQUEST_DOCS,
        reconciliationStatus: MyDataReconciliationStatus.MATCHED,
        reviewStatus: MyDataSnapshotReviewStatus.RESOLVED,
        _count: { _all: 12 },
        _sum: { totalAmount: new Prisma.Decimal(1200) },
      },
      {
        clientCompanyId: 'company-1',
        source: MyDataSyncSource.REQUEST_DOCS,
        reconciliationStatus: MyDataReconciliationStatus.MISSING_INTERNAL,
        reviewStatus: MyDataSnapshotReviewStatus.PENDING,
        _count: { _all: 3 },
        _sum: { totalAmount: new Prisma.Decimal(300) },
      },
    ]);
    prisma.myDataSnapshot.findMany.mockResolvedValue([{ id: 'snapshot-1' }]);

    const result = await service.officeDashboard(tenant, {});

    expect(result.overview).toEqual({
      companyCount: 1,
      authorizedCompanyCount: 1,
      totalCount: 15,
      matchedCount: 12,
      missingInternalCount: 3,
      mismatchCount: 0,
      companiesNeedingReviewCount: 1,
      failedSyncCountLast24Hours: 0,
    });
    expect(result.companies[0]).toEqual(
      expect.objectContaining({ totalCount: 15, totalAmount: 1500 }),
    );
    expect(result.exceptions).toEqual([{ id: 'snapshot-1' }]);
  });
});
