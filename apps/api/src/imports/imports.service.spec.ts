import { CounterpartyType, DocumentType, ImportBatchStatus, ImportBatchType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { ImportsService } from './imports.service';

const tenant: TenantContext = {
  accountingOfficeId: 'office-1',
  userId: 'user-1',
};

describe('ImportsService', () => {
  it('imports documents with movement/journal codes and syncs counterparties', async () => {
    const transactionDocument = { create: jest.fn().mockResolvedValue({ id: 'document-1' }) };
    const prisma = {
      clientCompany: {
        findFirst: jest.fn().mockResolvedValue({ id: 'company-1' }),
      },
      document: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((callback) => callback({ document: transactionDocument })),
      counterparty: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn(),
      },
      importBatch: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: 'batch-1', ...data })),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new ImportsService(prisma as unknown as PrismaService);

    const result = await service.importDocumentsCsv(tenant, {
      clientCompanyId: 'company-1',
      dryRun: false,
      csvText: [
        'documentType,series,documentNumber,issueDate,counterpartyName,counterpartyVatNumber,movementCode,journalCode,netAmount,vatAmount,totalAmount,vatCategory',
        'SALES_INVOICE,A,1,2026-07-01,Customer,111222333,SALE_INVOICE,SALES,100,24,124,VAT_24',
        'PURCHASE_INVOICE,B,2,2026-07-02,Supplier,444555666,PURCHASE_INVOICE,PURCHASES,50,12,62,VAT_24',
      ].join('\n'),
    });

    expect(transactionDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentType: DocumentType.SALES_INVOICE,
          movementCode: 'SALE_INVOICE',
          journalCode: 'SALES',
        }),
      }),
    );
    expect(transactionDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentType: DocumentType.PURCHASE_INVOICE,
          movementCode: 'PURCHASE_INVOICE',
          journalCode: 'PURCHASES',
        }),
      }),
    );
    expect(prisma.counterparty.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Customer',
          vatNumber: '111222333',
          type: CounterpartyType.CUSTOMER,
        }),
      }),
    );
    expect(prisma.counterparty.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Supplier',
          vatNumber: '444555666',
          type: CounterpartyType.SUPPLIER,
        }),
      }),
    );
    expect(result.batch).toEqual(
      expect.objectContaining({
        type: ImportBatchType.DOCUMENTS_CSV,
        status: ImportBatchStatus.COMPLETED,
      }),
    );
  });

  it('groups line rows into one document and persists their individual VAT mappings', async () => {
    const transactionDocument = { create: jest.fn().mockResolvedValue({ id: 'document-1' }) };
    const prisma = {
      clientCompany: {
        findFirst: jest.fn().mockResolvedValue({ id: 'company-1' }),
      },
      document: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((callback) => callback({ document: transactionDocument })),
      counterparty: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn(),
      },
      importBatch: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: 'batch-1', ...data })),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new ImportsService(prisma as unknown as PrismaService);

    const result = await service.importDocumentsCsv(tenant, {
      clientCompanyId: 'company-1',
      dryRun: false,
      csvText: [
        'documentType,series,documentNumber,issueDate,counterpartyName,counterpartyVatNumber,movementCode,journalCode,netAmount,vatAmount,totalAmount,lineItemCode,lineDescription,lineQuantity,lineMeasurementUnit,lineNetAmount,lineVatAmount,lineVatCategory,lineIncomeClassificationType,lineIncomeClassificationCategory',
        'SALES_INVOICE,A,100,2026-07-06,Customer,111222333,SALE_INVOICE,SALES,150,30,180,SERV-1,Υπηρεσία,1,7,100,24,VAT_24,E3_561_001,category1_1',
        'SALES_INVOICE,A,100,2026-07-06,Customer,111222333,SALE_INVOICE,SALES,150,30,180,BOOK-1,Έντυπο,2,1,50,6,VAT_6,E3_561_001,category1_1',
      ].join('\n'),
    });

    expect(transactionDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vatCategory: 'MULTIPLE',
          netAmount: 150,
          vatAmount: 30,
          totalAmount: 180,
          lines: {
            create: [
              expect.objectContaining({
                lineNumber: 1,
                itemCode: 'SERV-1',
                vatCategory: 'VAT_24',
              }),
              expect.objectContaining({
                lineNumber: 2,
                itemCode: 'BOOK-1',
                vatCategory: 'VAT_6',
              }),
            ],
          },
        }),
      }),
    );
    expect(result).toEqual(expect.objectContaining({ totalRows: 2, validRows: 2, failedRows: 0 }));
  });

  it('detects a duplicate document before an import is persisted', async () => {
    const prisma = {
      clientCompany: { findFirst: jest.fn().mockResolvedValue({ id: 'company-1' }) },
      document: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { documentType: DocumentType.SALES_INVOICE, series: 'A', documentNumber: '100' },
          ]),
      },
      importBatch: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: 'batch-1', ...data })),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new ImportsService(prisma as unknown as PrismaService);

    const result = await service.importDocumentsCsv(tenant, {
      clientCompanyId: 'company-1',
      dryRun: true,
      csvText: [
        'documentType,series,documentNumber,issueDate,netAmount,vatAmount,totalAmount,vatCategory',
        'SALES_INVOICE,A,100,2026-07-06,100,24,124,VAT_24',
      ].join('\n'),
    });

    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'DUPLICATE', field: 'documentNumber', rowNumber: 2 }),
    ]);
  });

  it('reports the exact source row for a malformed document line', async () => {
    const prisma = {
      clientCompany: { findFirst: jest.fn().mockResolvedValue({ id: 'company-1' }) },
      importBatch: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: 'batch-1', ...data })),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new ImportsService(prisma as unknown as PrismaService);

    const result = await service.importDocumentsCsv(tenant, {
      clientCompanyId: 'company-1',
      dryRun: true,
      csvText: [
        'documentType,series,documentNumber,issueDate,lineNetAmount,lineVatAmount,lineVatCategory',
        'SALES_INVOICE,A,100,2026-07-06,100,24,VAT_24',
        'SALES_INVOICE,A,100,2026-07-06,50,0,VAT_0',
      ].join('\n'),
    });

    expect(result.errors).toEqual([
      expect.objectContaining({
        code: 'VALIDATION',
        field: 'lineVatExemptionCategory',
        rowNumber: 3,
      }),
    ]);
  });
});
