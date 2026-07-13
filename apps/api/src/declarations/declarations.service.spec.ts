import { DocumentType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { DeclarationsService } from './declarations.service';

const tenant: TenantContext = {
  accountingOfficeId: 'office-1',
  userId: 'user-1',
};

describe('DeclarationsService', () => {
  it('generates VAT totals with breakdowns and negative credit notes', async () => {
    const prisma = {
      clientCompany: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'company-1',
          accountingOfficeId: 'office-1',
          legalName: 'Demo Company',
          vatNumber: '123456789',
        }),
      },
      document: {
        findMany: jest.fn().mockResolvedValue([
          {
            documentType: DocumentType.SALES_INVOICE,
            movementCode: 'SALE_INVOICE',
            vatCategory: 'VAT_24',
            netAmount: 100,
            vatAmount: 24,
            totalAmount: 124,
            myDataStatus: 'SENT',
          },
          {
            documentType: DocumentType.PURCHASE_INVOICE,
            movementCode: 'PURCHASE_INVOICE',
            vatCategory: 'VAT_24',
            netAmount: 50,
            vatAmount: 12,
            totalAmount: 62,
            myDataStatus: 'FAILED',
          },
          {
            documentType: DocumentType.CREDIT_NOTE,
            movementCode: 'CREDIT_NOTE',
            vatCategory: 'VAT_24',
            netAmount: 20,
            vatAmount: 4.8,
            totalAmount: 24.8,
            myDataStatus: 'SENT',
          },
        ]),
      },
      myDataSnapshot: {
        findMany: jest.fn().mockResolvedValue([
          {
            mark: '1',
            issuerVatNumber: '123456789',
            invoiceType: '1.1',
            netAmount: 80,
            vatAmount: 19.2,
            reconciliationStatus: 'MATCHED',
          },
          {
            mark: '2',
            issuerVatNumber: '987654321',
            invoiceType: '1.1',
            netAmount: 50,
            vatAmount: 12,
            reconciliationStatus: 'MATCHED',
          },
        ]),
      },
      declarationWorkpaper: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: 'workpaper-1', ...data })),
      },
    };
    const service = new DeclarationsService(prisma as unknown as PrismaService);

    const result = await service.generateVatWorkpaper(tenant, {
      clientCompanyId: 'company-1',
      year: 2026,
      month: 7,
    });

    expect(result.totals).toEqual(
      expect.objectContaining({
        salesNet: 80,
        salesVat: 19.2,
        purchasesNet: 50,
        purchasesVat: 12,
        payableVat: 7.2,
        documentCount: 3,
        failedMyData: 1,
      }),
    );
    expect(result.totals).toEqual(
      expect.objectContaining({
        vatBreakdown: [
          expect.objectContaining({
            vatCategory: 'VAT_24',
            salesNet: 80,
            salesVat: 19.2,
            purchasesNet: 50,
            purchasesVat: 12,
            payableVat: 7.2,
            documents: 3,
          }),
        ],
        documentTypeBreakdown: expect.arrayContaining([
          expect.objectContaining({
            documentType: DocumentType.CREDIT_NOTE,
            net: -20,
            vat: -4.8,
            total: -24.8,
            documents: 1,
          }),
        ]),
      }),
    );
    expect(result.totals).toEqual(
      expect.objectContaining({
        myDataReconciliation: expect.objectContaining({
          snapshotCount: 2,
          mismatches: 0,
          salesNetDelta: 0,
          salesVatDelta: 0,
          purchasesNetDelta: 0,
          purchasesVatDelta: 0,
        }),
      }),
    );
  });
});
