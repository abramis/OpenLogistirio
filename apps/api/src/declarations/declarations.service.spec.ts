import {
  DeclarationReturnType,
  DeclarationWorkpaperStatus,
  DeclarationWorkpaperType,
  DocumentType,
} from '@prisma/client';
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
          {
            documentType: DocumentType.PURCHASE_CREDIT_NOTE,
            movementCode: 'PURCHASE_CREDIT_NOTE',
            vatCategory: 'VAT_24',
            netAmount: 10,
            vatAmount: 2.4,
            totalAmount: 12.4,
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
          {
            mark: '3',
            issuerVatNumber: '987654321',
            invoiceType: '5.1',
            netAmount: 10,
            vatAmount: 2.4,
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
        purchasesNet: 40,
        purchasesVat: 9.6,
        payableVat: 9.6,
        documentCount: 4,
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
            purchasesNet: 40,
            purchasesVat: 9.6,
            payableVat: 9.6,
            documents: 4,
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
          expect.objectContaining({
            documentType: DocumentType.PURCHASE_CREDIT_NOTE,
            net: -10,
            vat: -2.4,
            total: -12.4,
            documents: 1,
          }),
        ]),
      }),
    );
    expect(result.totals).toEqual(
      expect.objectContaining({
        myDataReconciliation: expect.objectContaining({
          snapshotCount: 3,
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

  it('creates a revisioned VAT amendment without overwriting the submitted initial return', async () => {
    const prisma = {
      clientCompany: {
        findFirst: jest.fn().mockResolvedValue({ id: 'company-1', vatNumber: '123456789' }),
      },
      document: { findMany: jest.fn().mockResolvedValue([]) },
      myDataSnapshot: { findMany: jest.fn().mockResolvedValue([]) },
      declarationWorkpaper: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'initial-1',
          status: DeclarationWorkpaperStatus.SUBMITTED,
          revision: 0,
        }),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: 'amending-1', ...data })),
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
      createAmending: true,
    });

    expect(result).toEqual(
      expect.objectContaining({
        revision: 1,
        returnType: DeclarationReturnType.AMENDING,
      }),
    );
  });

  it('records the payable VAT result and its two official installments', async () => {
    const totals = {
      salesNet: 0,
      salesVat: 0,
      purchasesNet: 0,
      purchasesVat: 0,
      payableVat: 0,
      documentCount: 0,
      failedMyData: 0,
      myDataReconciliation: { mismatches: 0 },
    };
    const transactionClient = {
      declarationTaxPayment: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      declarationWorkpaper: {
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'vat-1',
            ...data,
            submissionDate: new Date('2026-08-31'),
            taxPayments: data.taxPayments.create,
          }),
        ),
      },
      officeObligation: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const prisma = {
      declarationWorkpaper: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'vat-1',
          accountingOfficeId: 'office-1',
          clientCompanyId: 'company-1',
          type: DeclarationWorkpaperType.VAT_RETURN,
          status: DeclarationWorkpaperStatus.APPROVED,
          periodYear: 2026,
          periodKind: 'MONTHLY',
          periodStartMonth: 7,
          periodEndMonth: 7,
          submissionDeadline: new Date('2026-08-31T20:59:59.999Z'),
          totals,
        }),
      },
      document: { findMany: jest.fn().mockResolvedValue([]) },
      myDataSnapshot: { findMany: jest.fn().mockResolvedValue([]) },
      clientCompany: {
        findFirst: jest.fn().mockResolvedValue({ vatNumber: '123456789' }),
      },
      $transaction: jest.fn().mockImplementation((callback) => callback(transactionClient)),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new DeclarationsService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );

    const result = await service.submit(tenant, 'vat-1', {
      submissionReference: 'VAT-2026-07',
      submissionDate: '2026-08-31',
      vatResult: {
        payableAmount: 201.01,
        creditCarryForward: 0,
        refundClaim: 0,
        debtId: 'RF123',
        payments: [
          { installmentNumber: 1, dueDate: '2026-08-31', amount: 100.5 },
          { installmentNumber: 2, dueDate: '2026-09-30', amount: 100.51 },
        ],
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: DeclarationWorkpaperStatus.SUBMITTED,
        vatPayableAmount: 201.01,
        vatDebtId: 'RF123',
        lateSubmission: false,
      }),
    );
    expect((result as unknown as { taxPayments: unknown[] }).taxPayments).toHaveLength(2);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        newValue: expect.objectContaining({ event: 'VAT_RETURN_SUBMITTED' }),
      }),
    );
  });

  it('rejects two VAT installments for an amount that does not exceed 100 euros', async () => {
    const prisma = {
      declarationWorkpaper: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'vat-1',
          type: DeclarationWorkpaperType.VAT_RETURN,
          status: DeclarationWorkpaperStatus.APPROVED,
          submissionDeadline: new Date('2026-08-31T20:59:59.999Z'),
        }),
      },
    };
    const service = new DeclarationsService(
      prisma as unknown as PrismaService,
      { record: jest.fn() } as unknown as AuditService,
    );

    await expect(
      service.submit(tenant, 'vat-1', {
        submissionReference: 'VAT-LOW',
        submissionDate: '2026-08-31',
        vatResult: {
          payableAmount: 100,
          creditCarryForward: 0,
          refundClaim: 0,
          debtId: 'RF100',
          payments: [
            { installmentNumber: 1, dueDate: '2026-08-31', amount: 50 },
            { installmentNumber: 2, dueDate: '2026-09-30', amount: 50 },
          ],
        },
      }),
    ).rejects.toThrow('Two VAT installments');
  });
});
