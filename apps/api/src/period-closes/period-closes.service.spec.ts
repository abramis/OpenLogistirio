import { BadRequestException } from '@nestjs/common';
import {
  DocumentType,
  MyDataReconciliationStatus,
  MyDataStatus,
  PeriodCloseKind,
  PeriodCloseReviewStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { PeriodClosesService } from './period-closes.service';

const tenant: TenantContext = { accountingOfficeId: 'office-1', userId: 'user-1' };

describe('PeriodClosesService', () => {
  it('generates automatic accounting, myDATA and VAT reconciliation checks', async () => {
    const prisma = {
      clientCompany: {
        findFirst: jest.fn().mockResolvedValue({ id: 'company-1', vatNumber: '123456789' }),
      },
      document: {
        findMany: jest.fn().mockResolvedValue([
          {
            documentType: DocumentType.SALES_INVOICE,
            movementCode: 'SALE_INVOICE',
            netAmount: new Prisma.Decimal(100),
            vatAmount: new Prisma.Decimal(24),
            myDataStatus: MyDataStatus.SENT,
            myDataMark: '1',
            accountingLinks: [{ id: 'link-1' }],
          },
        ]),
      },
      journalEntry: {
        findMany: jest.fn().mockResolvedValue([
          {
            lines: [
              { debit: new Prisma.Decimal(124), credit: new Prisma.Decimal(0) },
              { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(124) },
            ],
          },
        ]),
      },
      myDataSnapshot: {
        findMany: jest.fn().mockResolvedValue([
          {
            mark: '1',
            issuerVatNumber: '123456789',
            invoiceType: '1.1',
            netAmount: new Prisma.Decimal(100),
            vatAmount: new Prisma.Decimal(24),
            reconciliationStatus: MyDataReconciliationStatus.MATCHED,
          },
        ]),
      },
      declarationWorkpaper: { findFirst: jest.fn().mockResolvedValue({ id: 'vat-1' }) },
      periodCloseReview: {
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'close-1', ...create })),
      },
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    };
    const service = new PeriodClosesService(prisma as unknown as PrismaService);

    const result = await service.generate(tenant, {
      clientCompanyId: 'company-1',
      year: 2026,
      kind: PeriodCloseKind.MONTHLY,
      endMonth: 7,
    });

    const checklist = result.checklist as unknown as Array<{
      code: string;
      completed: boolean;
      automatic: boolean;
    }>;
    expect(checklist.filter((item) => item.automatic).every((item) => item.completed)).toBe(true);
    expect(checklist.find((item) => item.code === 'SUPPORTING_DOCUMENTS_REVIEWED')).toEqual(
      expect.objectContaining({ completed: false, automatic: false }),
    );
    expect(result.reviewSummary).toEqual(
      expect.objectContaining({
        unpostedDocuments: 0,
        journalDifference: 0,
        reconciliationMismatches: 0,
        vatDelta: { salesNet: 0, salesVat: 0, purchasesNet: 0, purchasesVat: 0 },
      }),
    );
  });

  it('requires every blocking checklist item before submission', async () => {
    const prisma = {
      periodCloseReview: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'close-1',
          status: PeriodCloseReviewStatus.DRAFT,
          checklist: [
            {
              code: 'SUPPORTING_DOCUMENTS_REVIEWED',
              label: 'Δικαιολογητικά',
              completed: false,
              automatic: false,
              blocking: true,
              details: '',
            },
          ],
        }),
      },
    };
    const service = new PeriodClosesService(prisma as unknown as PrismaService);

    await expect(service.submit(tenant, 'close-1')).rejects.toThrow(BadRequestException);
  });

  it('approves only a review already submitted for accountant review', async () => {
    const update = jest.fn().mockResolvedValue({ status: PeriodCloseReviewStatus.APPROVED });
    const prisma = {
      periodCloseReview: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'close-1',
          status: PeriodCloseReviewStatus.READY_FOR_REVIEW,
        }),
        update,
      },
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    };
    const service = new PeriodClosesService(prisma as unknown as PrismaService);

    await service.approve(tenant, 'close-1');

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PeriodCloseReviewStatus.APPROVED,
          approvedById: 'user-1',
        }),
      }),
    );
  });
});
