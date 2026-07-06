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
    const prisma = {
      clientCompany: {
        findFirst: jest.fn().mockResolvedValue({ id: 'company-1' }),
      },
      document: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      counterparty: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn(),
      },
      importBatch: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: 'batch-1', ...data })),
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

    expect(prisma.document.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          documentType: DocumentType.SALES_INVOICE,
          movementCode: 'SALE_INVOICE',
          journalCode: 'SALES',
        }),
        expect.objectContaining({
          documentType: DocumentType.PURCHASE_INVOICE,
          movementCode: 'PURCHASE_INVOICE',
          journalCode: 'PURCHASES',
        }),
      ],
      skipDuplicates: false,
    });
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
});
