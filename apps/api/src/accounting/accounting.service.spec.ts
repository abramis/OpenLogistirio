import {
  AccountingPeriodStatus,
  ChartAccountType,
  DocumentType,
  NormalBalance,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { AccountingService } from './accounting.service';

const tenant: TenantContext = {
  accountingOfficeId: 'office-1',
  userId: 'user-1',
};

const accounts = [
  account('30.00', 'Πελάτες', ChartAccountType.ASSET, NormalBalance.DEBIT),
  account('70.00', 'Έσοδα πωλήσεων', ChartAccountType.REVENUE, NormalBalance.CREDIT),
  account('54.00', 'ΦΠΑ εκροών', ChartAccountType.LIABILITY, NormalBalance.CREDIT),
  account('20.00', 'Αγορές και έξοδα', ChartAccountType.EXPENSE, NormalBalance.DEBIT),
  account('54.01', 'ΦΠΑ εισροών', ChartAccountType.ASSET, NormalBalance.DEBIT),
  account('50.00', 'Προμηθευτές', ChartAccountType.LIABILITY, NormalBalance.CREDIT),
  account('66.00', 'Αποσβέσεις χρήσης', ChartAccountType.EXPENSE, NormalBalance.DEBIT),
  account('12.99', 'Συσσωρευμένες αποσβέσεις', ChartAccountType.ASSET, NormalBalance.CREDIT),
];

describe('AccountingService', () => {
  it('posts a sales document as a balanced journal entry', async () => {
    const tx = {
      chartAccount: {
        upsert: jest.fn(({ create }) => Promise.resolve(create)),
        findMany: jest.fn().mockResolvedValue(accounts),
      },
      documentPostingRule: {
        upsert: jest.fn(({ create }) => Promise.resolve(create)),
        findFirst: jest.fn().mockResolvedValue({
          name: 'Τιμολόγιο πώλησης',
          counterpartyAccountCode: '30.00',
          counterpartySide: NormalBalance.DEBIT,
          netAccountCode: '70.00',
          netSide: NormalBalance.CREDIT,
          vatAccountCode: '54.00',
          vatSide: NormalBalance.CREDIT,
        }),
      },
      accountingPeriod: {
        upsert: jest.fn().mockResolvedValue({
          status: AccountingPeriodStatus.OPEN,
          startsAt: new Date('2026-07-01T00:00:00.000Z'),
          endsAt: new Date('2026-07-31T23:59:59.999Z'),
        }),
      },
      journalEntry: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(({ data }) =>
          Promise.resolve({
            id: 'entry-1',
            ...data,
          }),
        ),
      },
    };
    const prisma = {
      document: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'document-1',
          accountingOfficeId: 'office-1',
          clientCompanyId: 'company-1',
          documentType: DocumentType.SALES_INVOICE,
          series: 'A',
          documentNumber: '12',
          movementCode: 'SALE_INVOICE',
          issueDate: new Date('2026-07-10T00:00:00.000Z'),
          counterpartyName: 'Customer SA',
          netAmount: new Prisma.Decimal('100.00'),
          vatAmount: new Prisma.Decimal('24.00'),
          totalAmount: new Prisma.Decimal('124.00'),
          vatCategory: 'VAT_24',
          clientCompany: {
            id: 'company-1',
            legalName: 'Demo Company',
          },
          accountingLinks: [],
        }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new AccountingService(prisma as unknown as PrismaService);

    await service.postDocument(tenant, 'document-1');

    const createCall = tx.journalEntry.create.mock.calls[0][0];
    expect(createCall.data.entryNumber).toBe('DOC-2026-00001');
    expect(createCall.data.documentLinks.create.documentId).toBe('document-1');
    expect(createCall.data.lines.create).toEqual([
      expect.objectContaining({ accountId: 'account-30-00', debit: new Prisma.Decimal('124.00') }),
      expect.objectContaining({ accountId: 'account-70-00', credit: new Prisma.Decimal('100.00') }),
      expect.objectContaining({ accountId: 'account-54-00', credit: new Prisma.Decimal('24.00') }),
    ]);
  });

  it('posts a fixed asset depreciation entry once', async () => {
    const tx = {
      chartAccount: {
        upsert: jest.fn(({ create }) => Promise.resolve(create)),
        findMany: jest.fn().mockResolvedValue(accounts),
      },
      accountingPeriod: {
        upsert: jest.fn().mockResolvedValue({
          status: AccountingPeriodStatus.OPEN,
          startsAt: new Date('2026-12-01T00:00:00.000Z'),
          endsAt: new Date('2026-12-31T23:59:59.999Z'),
        }),
      },
      journalEntry: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(({ data }) => Promise.resolve({ id: 'entry-1', ...data })),
      },
      fixedAssetDepreciationEntry: {
        update: jest.fn(),
      },
    };
    const prisma = {
      fixedAssetDepreciationEntry: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'dep-1',
          fiscalYear: 2026,
          amount: new Prisma.Decimal('120.00'),
          fixedAsset: {
            id: 'asset-1',
            code: 'FA-1',
            description: 'Laptop',
            clientCompanyId: 'company-1',
            clientCompany: {
              id: 'company-1',
              legalName: 'Demo Company',
            },
          },
          accountingLinks: [],
        }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new AccountingService(prisma as unknown as PrismaService);

    await service.postFixedAssetDepreciation(tenant, 'dep-1');

    const createCall = tx.journalEntry.create.mock.calls[0][0];
    expect(createCall.data.entryNumber).toBe('DEP-2026-00001');
    expect(createCall.data.depreciationLinks.create.depreciationEntryId).toBe('dep-1');
    expect(createCall.data.lines.create).toEqual([
      expect.objectContaining({ accountId: 'account-66-00', debit: new Prisma.Decimal('120.00') }),
      expect.objectContaining({ accountId: 'account-12-99', credit: new Prisma.Decimal('120.00') }),
    ]);
    expect(tx.fixedAssetDepreciationEntry.update).toHaveBeenCalledWith({
      where: { id: 'dep-1' },
      data: { posted: true },
    });
  });

  it('rejects unbalanced manual entries', async () => {
    const service = new AccountingService({} as PrismaService);

    await expect(
      service.createManualEntry(tenant, {
        clientCompanyId: 'company-1',
        entryDate: '2026-07-10',
        description: 'Bad entry',
        lines: [
          { accountCode: '30.00', debit: 100 },
          { accountCode: '70.00', credit: 90 },
        ],
      }),
    ).rejects.toThrow('Journal entry is not balanced.');
  });

  it('closes a balanced accounting period', async () => {
    const prisma = {
      accountingPeriod: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'period-1',
          accountingOfficeId: 'office-1',
          clientCompanyId: 'company-1',
          fiscalYear: 2026,
          periodMonth: 7,
          status: AccountingPeriodStatus.OPEN,
        }),
        update: jest
          .fn()
          .mockResolvedValue({ id: 'period-1', status: AccountingPeriodStatus.CLOSED }),
      },
      journalEntryLine: {
        findMany: jest.fn().mockResolvedValue([
          { debit: new Prisma.Decimal('100.00'), credit: new Prisma.Decimal('0.00') },
          { debit: new Prisma.Decimal('0.00'), credit: new Prisma.Decimal('100.00') },
        ]),
      },
    };
    const service = new AccountingService(prisma as unknown as PrismaService);

    await service.closePeriod(tenant, 'period-1');

    expect(prisma.accountingPeriod.update).toHaveBeenCalledWith({
      where: { id: 'period-1' },
      data: expect.objectContaining({ status: AccountingPeriodStatus.CLOSED }),
    });
  });

  it('requires an approved close review before locking a period', async () => {
    const prisma = {
      accountingPeriod: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'period-1',
          accountingOfficeId: 'office-1',
          clientCompanyId: 'company-1',
          fiscalYear: 2026,
          periodMonth: 7,
          status: AccountingPeriodStatus.CLOSED,
        }),
        update: jest.fn(),
      },
      periodCloseReview: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new AccountingService(prisma as unknown as PrismaService);

    await expect(service.lockPeriod(tenant, 'period-1')).rejects.toThrow(
      'Approve the monthly or quarterly close review',
    );
    expect(prisma.accountingPeriod.update).not.toHaveBeenCalled();
  });

  it('builds income statement and balance sheet totals from posted lines', async () => {
    const prisma = {
      clientCompany: {
        findFirst: jest.fn().mockResolvedValue({ id: 'company-1' }),
      },
      journalEntryLine: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            line('70.00', 'Έσοδα', ChartAccountType.REVENUE, NormalBalance.CREDIT, 0, 300),
            line('20.00', 'Έξοδα', ChartAccountType.EXPENSE, NormalBalance.DEBIT, 100, 0),
            line('10.00', 'Ταμείο', ChartAccountType.ASSET, NormalBalance.DEBIT, 200, 0),
            line('40.00', 'Κεφάλαιο', ChartAccountType.EQUITY, NormalBalance.CREDIT, 0, 0),
          ]),
      },
    };
    const service = new AccountingService(prisma as unknown as PrismaService);

    const result = await service.financialStatements(
      tenant,
      'company-1',
      '2026-01-01',
      '2026-12-31',
    );

    expect(result.incomeStatement).toEqual(
      expect.objectContaining({
        revenue: 300,
        expenses: 100,
        netIncome: 200,
      }),
    );
    expect(result.balanceSheet).toEqual(
      expect.objectContaining({
        assets: 200,
        liabilitiesEquityAndCurrentResult: 200,
        difference: 0,
      }),
    );
  });

  it('summarizes accounting coverage for documents and entries', async () => {
    const prisma = {
      document: {
        count: jest.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(3).mockResolvedValueOnce(2),
      },
      journalEntry: {
        count: jest.fn().mockResolvedValue(4),
      },
    };
    const service = new AccountingService(prisma as unknown as PrismaService);

    const result = await service.coverage(tenant, 'company-1', '2026-01-01', '2026-12-31');

    expect(result).toEqual({
      documents: 5,
      postedDocuments: 3,
      unpostedDocuments: 2,
      journalEntries: 4,
      postedRatio: 60,
    });
  });

  it('bulk posts currently unposted documents', async () => {
    const prisma = {
      clientCompany: {
        findFirst: jest.fn().mockResolvedValue({ id: 'company-1' }),
      },
      document: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'document-1', documentNumber: '1' },
          { id: 'document-2', documentNumber: '2' },
        ]),
      },
    };
    const service = new AccountingService(prisma as unknown as PrismaService);
    jest
      .spyOn(service, 'postDocument')
      .mockResolvedValueOnce({ id: 'entry-1', entryNumber: 'DOC-2026-00001' } as never)
      .mockRejectedValueOnce(new Error('Missing account'));

    const result = await service.bulkPostDocuments(tenant, {
      clientCompanyId: 'company-1',
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
    });

    expect(result).toEqual({
      requested: 2,
      postedCount: 1,
      failedCount: 1,
      posted: [
        {
          documentId: 'document-1',
          journalEntryId: 'entry-1',
          entryNumber: 'DOC-2026-00001',
        },
      ],
      failed: [
        {
          documentId: 'document-2',
          documentNumber: '2',
          error: 'Missing account',
        },
      ],
    });
  });

  it('reconciles VAT document totals against GL VAT and net accounts', async () => {
    const prisma = {
      clientCompany: {
        findFirst: jest.fn().mockResolvedValue({ id: 'company-1' }),
      },
      document: {
        findMany: jest.fn().mockResolvedValue([
          {
            documentType: DocumentType.SALES_INVOICE,
            issueDate: new Date('2026-07-01T00:00:00.000Z'),
            netAmount: new Prisma.Decimal('100.00'),
            vatAmount: new Prisma.Decimal('24.00'),
          },
          {
            documentType: DocumentType.PURCHASE_INVOICE,
            issueDate: new Date('2026-07-02T00:00:00.000Z'),
            netAmount: new Prisma.Decimal('50.00'),
            vatAmount: new Prisma.Decimal('12.00'),
          },
          {
            documentType: DocumentType.CREDIT_NOTE,
            issueDate: new Date('2026-07-03T00:00:00.000Z'),
            netAmount: new Prisma.Decimal('20.00'),
            vatAmount: new Prisma.Decimal('4.80'),
          },
        ]),
      },
      journalEntryLine: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            vatLine('70.00', 7, 0, 80),
            vatLine('54.00', 7, 0, 19.2),
            vatLine('20.00', 7, 50, 0),
            vatLine('54.01', 7, 12, 0),
          ]),
      },
    };
    const service = new AccountingService(prisma as unknown as PrismaService);

    const result = await service.vatReconciliation(tenant, 'company-1', 2026);
    const july = result.find((row) => row.period === '2026-07');

    expect(july).toEqual(
      expect.objectContaining({
        balanced: true,
        documents: expect.objectContaining({
          salesNet: 80,
          outputVat: 19.2,
          purchasesNet: 50,
          inputVat: 12,
          count: 3,
        }),
        ledger: {
          salesNet: 80,
          outputVat: 19.2,
          purchasesNet: 50,
          inputVat: 12,
        },
      }),
    );
  });

  it('previews balanced year-end closing and retained-result entries', async () => {
    const prisma = {
      clientCompany: { findFirst: jest.fn().mockResolvedValue({ id: 'company-1' }) },
      journalEntryLine: {
        findMany: jest.fn().mockResolvedValue([
          line('70.00', 'Έσοδα πωλήσεων', ChartAccountType.REVENUE, NormalBalance.CREDIT, 0, 150),
          line('20.00', 'Αγορές και έξοδα', ChartAccountType.EXPENSE, NormalBalance.DEBIT, 50, 0),
        ]),
      },
      chartAccount: {
        findMany: jest.fn().mockResolvedValue([
          account('82.00', 'Αποτελέσματα χρήσης', ChartAccountType.EQUITY, NormalBalance.CREDIT),
          account('40.00', 'Κεφάλαιο', ChartAccountType.EQUITY, NormalBalance.CREDIT),
        ]),
      },
      journalEntry: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new AccountingService(prisma as unknown as PrismaService);

    const preview = await service.yearEndPreview(tenant, {
      clientCompanyId: 'company-1',
      fiscalYear: 2026,
      resultAccountCode: '82.00',
      retainedEarningsAccountCode: '40.00',
    });

    expect(preview.result).toEqual({ revenue: 150, expenses: 50, netResult: 100 });
    expect(preview.closingEntry).toEqual(expect.objectContaining({ debit: 50, credit: 150 }));
    expect(preview.transferEntry).toEqual(
      expect.objectContaining({ resultDebit: 100, retainedEarningsCredit: 100 }),
    );
  });
});

function account(code: string, name: string, type: ChartAccountType, normalBalance: NormalBalance) {
  return {
    id: `account-${code.replace('.', '-')}`,
    accountingOfficeId: 'office-1',
    clientCompanyId: 'company-1',
    code,
    name,
    type,
    normalBalance,
    parentId: null,
    isControl: false,
    isActive: true,
    taxCategory: null,
    myDataCategory: null,
    notes: null,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };
}

function line(
  code: string,
  name: string,
  type: ChartAccountType,
  normalBalance: NormalBalance,
  debit: number,
  credit: number,
) {
  return {
    debit: new Prisma.Decimal(debit),
    credit: new Prisma.Decimal(credit),
    account: account(code, name, type, normalBalance),
  };
}

function vatLine(accountCode: string, periodMonth: number, debit: number, credit: number) {
  return {
    debit: new Prisma.Decimal(debit),
    credit: new Prisma.Decimal(credit),
    account: account(accountCode, accountCode, ChartAccountType.ASSET, NormalBalance.DEBIT),
    journalEntry: {
      periodMonth,
    },
  };
}
