import { DocumentType, MyDataStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { ReportsService } from './reports.service';

const tenant: TenantContext = {
  accountingOfficeId: 'office-1',
  userId: 'user-1',
};

describe('ReportsService', () => {
  it('summarizes VAT by month with purchases, credit notes, and failed myDATA', async () => {
    const prisma = {
      document: {
        findMany: jest.fn().mockResolvedValue([
          {
            documentType: DocumentType.SALES_INVOICE,
            movementCode: 'SALE_INVOICE',
            issueDate: new Date('2026-07-02T00:00:00.000Z'),
            netAmount: 100,
            vatAmount: 24,
            myDataStatus: MyDataStatus.SENT,
          },
          {
            documentType: DocumentType.PURCHASE_INVOICE,
            movementCode: 'PURCHASE_INVOICE',
            issueDate: new Date('2026-07-10T00:00:00.000Z'),
            netAmount: 50,
            vatAmount: 12,
            myDataStatus: MyDataStatus.FAILED,
          },
          {
            documentType: DocumentType.CREDIT_NOTE,
            movementCode: 'CREDIT_NOTE',
            issueDate: new Date('2026-07-15T00:00:00.000Z'),
            netAmount: 20,
            vatAmount: 4.8,
            myDataStatus: MyDataStatus.SENT,
          },
        ]),
      },
    };
    const service = new ReportsService(prisma as unknown as PrismaService);

    const result = await service.vatSummary(tenant, 2026, 'company-1');

    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountingOfficeId: 'office-1',
          clientCompanyId: 'company-1',
        }),
      }),
    );
    expect(result).toEqual([
      {
        period: '2026-07',
        salesNet: 80,
        salesVat: 19.2,
        purchasesNet: 50,
        purchasesVat: 12,
        payableVat: 7.2,
        documents: 3,
        failedMyData: 1,
      },
    ]);
  });
});
