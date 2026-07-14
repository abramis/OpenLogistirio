import { DeclarationWorkpaperStatus, DocumentType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
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
    const service = new DeclarationsService(
      prisma as unknown as PrismaService,
      { record: jest.fn() } as unknown as AuditService,
    );

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

  it('generates a quarterly workpaper over all three months with its own period key', async () => {
    const prisma = {
      clientCompany: {
        findFirst: jest.fn().mockResolvedValue({ id: 'company-1', vatNumber: '123456789' }),
      },
      document: { findMany: jest.fn().mockResolvedValue([]) },
      myDataSnapshot: { findMany: jest.fn().mockResolvedValue([]) },
      declarationWorkpaper: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: 'quarter-1', ...data })),
      },
    };
    const service = new DeclarationsService(
      prisma as unknown as PrismaService,
      { record: jest.fn() } as unknown as AuditService,
    );

    const result = await service.generateVatWorkpaper(tenant, {
      clientCompanyId: 'company-1',
      year: 2026,
      month: 6,
      periodKind: 'QUARTERLY',
    });

    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          issueDate: {
            gte: new Date(Date.UTC(2026, 3, 1)),
            lt: new Date(Date.UTC(2026, 6, 1)),
          },
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        title: 'Workpaper ΦΠΑ τριμήνου 04-06/2026',
        periodKind: 'QUARTERLY',
        periodStartMonth: 4,
        periodEndMonth: 6,
      }),
    );
  });

  it('records an approved workpaper as submitted with its filing evidence', async () => {
    const update = jest.fn().mockImplementation(({ data }) => Promise.resolve(data));
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const prisma = {
      declarationWorkpaper: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'workpaper-1',
          status: DeclarationWorkpaperStatus.APPROVED,
        }),
        update,
      },
    };
    const service = new DeclarationsService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );

    await service.submit(tenant, 'workpaper-1', {
      submissionReference: '123456789012',
      submissionDate: '2026-07-31',
      attachments: [{ name: 'Αποδεικτικό', url: 'https://files.example/proof.pdf' }],
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DeclarationWorkpaperStatus.SUBMITTED,
          submissionReference: '123456789012',
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'DeclarationWorkpaper',
        newValue: expect.objectContaining({ event: 'DECLARATION_WORKPAPER_SUBMITTED' }),
      }),
    );
  });
});
