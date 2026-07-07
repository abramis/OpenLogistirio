import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AccountingPeriodStatus,
  ChartAccountType,
  DocumentType,
  JournalEntrySource,
  JournalEntryStatus,
  NormalBalance,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { BulkPostDocumentsDto } from './dto/bulk-post-documents.dto';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  async findAccounts(tenant: TenantContext, clientCompanyId?: string) {
    return this.prisma.chartAccount.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId,
      },
      orderBy: [{ clientCompanyId: 'asc' }, { code: 'asc' }],
    });
  }

  async findPostingRules(tenant: TenantContext, clientCompanyId?: string) {
    return this.prisma.documentPostingRule.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId,
      },
      orderBy: [{ clientCompanyId: 'asc' }, { code: 'asc' }],
    });
  }

  async coverage(
    tenant: TenantContext,
    clientCompanyId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const documentWhere = this.documentCoverageWhere(tenant, clientCompanyId, dateFrom, dateTo);
    const [documents, postedDocuments, journalEntries, unpostedDocuments] = await Promise.all([
      this.prisma.document.count({ where: documentWhere }),
      this.prisma.document.count({
        where: {
          ...documentWhere,
          accountingLinks: { some: {} },
        },
      }),
      this.prisma.journalEntry.count({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId,
          entryDate: toDateFilter(dateFrom, dateTo),
          status: JournalEntryStatus.POSTED,
        },
      }),
      this.prisma.document.count({
        where: {
          ...documentWhere,
          accountingLinks: { none: {} },
        },
      }),
    ]);

    return {
      documents,
      postedDocuments,
      unpostedDocuments,
      journalEntries,
      postedRatio: documents > 0 ? roundMoney((postedDocuments / documents) * 100) : 0,
    };
  }

  async findJournalEntries(
    tenant: TenantContext,
    query: {
      clientCompanyId?: string;
      dateFrom?: string;
      dateTo?: string;
      source?: string;
    },
  ) {
    return this.prisma.journalEntry.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: query.clientCompanyId,
        source: parseJournalEntrySource(query.source),
        entryDate: toDateFilter(query.dateFrom, query.dateTo),
      },
      include: {
        clientCompany: {
          select: {
            id: true,
            legalName: true,
            vatNumber: true,
          },
        },
        ...journalEntryInclude,
      },
      orderBy: [{ entryDate: 'desc' }, { entryNumber: 'desc' }],
      take: 100,
    });
  }

  async findUnpostedDocuments(
    tenant: TenantContext,
    clientCompanyId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    return this.prisma.document.findMany({
      where: {
        ...this.documentCoverageWhere(tenant, clientCompanyId, dateFrom, dateTo),
        accountingLinks: { none: {} },
      },
      include: {
        clientCompany: {
          select: {
            id: true,
            legalName: true,
            vatNumber: true,
          },
        },
      },
      orderBy: [{ issueDate: 'asc' }, { documentNumber: 'asc' }],
      take: 100,
    });
  }

  async findPeriods(tenant: TenantContext, clientCompanyId: string, fiscalYear: number) {
    await this.ensureTenantCompany(tenant, clientCompanyId);

    return this.prisma.accountingPeriod.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId,
        fiscalYear,
      },
      orderBy: { periodMonth: 'asc' },
    });
  }

  async seedDefaultChart(tenant: TenantContext, clientCompanyId: string, fiscalYear?: number) {
    await this.ensureTenantCompany(tenant, clientCompanyId);
    const year = fiscalYear ?? new Date().getFullYear();

    return this.prisma.$transaction(async (tx) => {
      const accounts = await this.seedDefaultAccounts(tx, tenant, clientCompanyId);
      const postingRules = await this.seedDefaultPostingRules(tx, tenant, clientCompanyId);
      const periods = await this.seedFiscalPeriods(tx, tenant, clientCompanyId, year);

      return {
        clientCompanyId,
        fiscalYear: year,
        accountCount: accounts.length,
        postingRuleCount: postingRules.length,
        periodCount: periods.length,
        accounts,
        postingRules,
        periods,
      };
    });
  }

  async createManualEntry(tenant: TenantContext, dto: CreateJournalEntryDto) {
    this.validateLineTotals(dto.lines);
    await this.ensureTenantCompany(tenant, dto.clientCompanyId);
    const entryDate = new Date(dto.entryDate);
    const fiscal = toFiscalInfo(entryDate);

    return this.prisma.$transaction(async (tx) => {
      await this.seedDefaultAccounts(tx, tenant, dto.clientCompanyId);
      await this.ensurePeriodOpen(tx, tenant, dto.clientCompanyId, fiscal, entryDate);
      const accountMap = await this.accountMap(tx, tenant, dto.clientCompanyId);

      return tx.journalEntry.create({
        data: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: dto.clientCompanyId,
          entryNumber: await this.nextEntryNumber(tx, dto.clientCompanyId, 'MAN', entryDate),
          entryDate,
          fiscalYear: fiscal.year,
          periodMonth: fiscal.month,
          source: JournalEntrySource.MANUAL,
          status: JournalEntryStatus.POSTED,
          description: dto.description,
          reference: dto.reference,
          postedAt: new Date(),
          lines: {
            create: dto.lines.map((line, index) => ({
              accountId: this.requireAccount(accountMap, line.accountCode).id,
              lineNumber: index + 1,
              description: line.description,
              debit: toMoney(line.debit ?? 0),
              credit: toMoney(line.credit ?? 0),
              taxCode: line.taxCode,
            })),
          },
        },
        include: journalEntryInclude,
      });
    });
  }

  async bulkPostDocuments(tenant: TenantContext, dto: BulkPostDocumentsDto) {
    await this.ensureTenantCompany(tenant, dto.clientCompanyId);
    const documents = await this.findUnpostedDocuments(
      tenant,
      dto.clientCompanyId,
      dto.dateFrom,
      dto.dateTo,
    );
    const posted = [];
    const failed = [];

    for (const document of documents) {
      try {
        const journalEntry = await this.postDocument(tenant, document.id);
        posted.push({
          documentId: document.id,
          journalEntryId: journalEntry.id,
          entryNumber: journalEntry.entryNumber,
        });
      } catch (error) {
        failed.push({
          documentId: document.id,
          documentNumber: document.documentNumber,
          error: error instanceof Error ? error.message : 'Unknown posting error.',
        });
      }
    }

    return {
      requested: documents.length,
      postedCount: posted.length,
      failedCount: failed.length,
      posted,
      failed,
    };
  }

  async postDocument(tenant: TenantContext, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        accountingOfficeId: tenant.accountingOfficeId,
        deletedAt: null,
      },
      include: {
        clientCompany: { select: { id: true, legalName: true } },
        accountingLinks: {
          include: {
            journalEntry: { include: journalEntryInclude },
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document was not found.');
    }

    const existingLink = document.accountingLinks[0];
    if (existingLink) {
      return existingLink.journalEntry;
    }

    const fiscal = toFiscalInfo(document.issueDate);

    return this.prisma.$transaction(async (tx) => {
      await this.seedDefaultAccounts(tx, tenant, document.clientCompanyId);
      await this.seedDefaultPostingRules(tx, tenant, document.clientCompanyId);
      await this.ensurePeriodOpen(tx, tenant, document.clientCompanyId, fiscal, document.issueDate);
      const accountMap = await this.accountMap(tx, tenant, document.clientCompanyId);
      const postingRule = await this.resolveDocumentPostingRule(tx, tenant, document);
      const lines = this.documentPostingLines(document, postingRule, accountMap);

      return tx.journalEntry.create({
        data: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: document.clientCompanyId,
          entryNumber: await this.nextEntryNumber(
            tx,
            document.clientCompanyId,
            'DOC',
            document.issueDate,
          ),
          entryDate: document.issueDate,
          fiscalYear: fiscal.year,
          periodMonth: fiscal.month,
          source: JournalEntrySource.DOCUMENT,
          status: JournalEntryStatus.POSTED,
          description: documentDescription(document),
          reference: documentReference(document),
          postedAt: new Date(),
          lines: {
            create: lines.map((line, index) => ({
              accountId: line.account.id,
              lineNumber: index + 1,
              description: line.description,
              debit: toMoney(line.debit),
              credit: toMoney(line.credit),
              taxCode: line.taxCode,
            })),
          },
          documentLinks: {
            create: {
              documentId: document.id,
            },
          },
        },
        include: journalEntryInclude,
      });
    });
  }

  async postFixedAssetDepreciation(tenant: TenantContext, entryId: string) {
    const entry = await this.prisma.fixedAssetDepreciationEntry.findFirst({
      where: {
        id: entryId,
        fixedAsset: {
          accountingOfficeId: tenant.accountingOfficeId,
        },
      },
      include: {
        fixedAsset: {
          include: {
            clientCompany: { select: { id: true, legalName: true } },
          },
        },
        accountingLinks: {
          include: {
            journalEntry: { include: journalEntryInclude },
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException('Fixed asset depreciation entry was not found.');
    }

    const existingLink = entry.accountingLinks[0];
    if (existingLink) {
      return existingLink.journalEntry;
    }

    const entryDate = new Date(Date.UTC(entry.fiscalYear, 11, 31));
    const fiscal = toFiscalInfo(entryDate);
    const amount = Number(entry.amount);

    if (amount <= 0) {
      throw new BadRequestException('Only positive depreciation amounts can be posted.');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.seedDefaultAccounts(tx, tenant, entry.fixedAsset.clientCompanyId);
      await this.ensurePeriodOpen(tx, tenant, entry.fixedAsset.clientCompanyId, fiscal, entryDate);
      const accountMap = await this.accountMap(tx, tenant, entry.fixedAsset.clientCompanyId);
      const expenseAccount = this.requireAccount(accountMap, '66.00');
      const accumulatedAccount = this.requireAccount(accountMap, '12.99');

      const journalEntry = await tx.journalEntry.create({
        data: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: entry.fixedAsset.clientCompanyId,
          entryNumber: await this.nextEntryNumber(
            tx,
            entry.fixedAsset.clientCompanyId,
            'DEP',
            entryDate,
          ),
          entryDate,
          fiscalYear: fiscal.year,
          periodMonth: fiscal.month,
          source: JournalEntrySource.FIXED_ASSET,
          status: JournalEntryStatus.POSTED,
          description: `Απόσβεση παγίου ${entry.fixedAsset.code} ${entry.fiscalYear}`,
          reference: `${entry.fixedAsset.code}/${entry.fiscalYear}`,
          postedAt: new Date(),
          lines: {
            create: [
              {
                accountId: expenseAccount.id,
                lineNumber: 1,
                description: entry.fixedAsset.description,
                debit: toMoney(amount),
                credit: toMoney(0),
              },
              {
                accountId: accumulatedAccount.id,
                lineNumber: 2,
                description: entry.fixedAsset.description,
                debit: toMoney(0),
                credit: toMoney(amount),
              },
            ],
          },
          depreciationLinks: {
            create: {
              depreciationEntryId: entry.id,
            },
          },
        },
        include: journalEntryInclude,
      });

      await tx.fixedAssetDepreciationEntry.update({
        where: { id: entry.id },
        data: { posted: true },
      });

      return journalEntry;
    });
  }

  async closePeriod(tenant: TenantContext, periodId: string) {
    const period = await this.findTenantPeriod(tenant, periodId);
    if (period.status === AccountingPeriodStatus.LOCKED) {
      throw new BadRequestException('Locked accounting periods cannot be closed again.');
    }

    const totals = await this.periodTotals(
      tenant,
      period.clientCompanyId,
      period.fiscalYear,
      period.periodMonth,
    );
    if (totals.difference !== 0) {
      throw new BadRequestException(
        'Accounting period cannot close while debit and credit differ.',
      );
    }

    return this.prisma.accountingPeriod.update({
      where: { id: period.id },
      data: {
        status: AccountingPeriodStatus.CLOSED,
        closedAt: new Date(),
      },
    });
  }

  async lockPeriod(tenant: TenantContext, periodId: string) {
    const period = await this.findTenantPeriod(tenant, periodId);
    if (period.status === AccountingPeriodStatus.OPEN) {
      throw new BadRequestException('Close the accounting period before locking it.');
    }

    return this.prisma.accountingPeriod.update({
      where: { id: period.id },
      data: {
        status: AccountingPeriodStatus.LOCKED,
        lockedAt: new Date(),
      },
    });
  }

  async reopenPeriod(tenant: TenantContext, periodId: string) {
    const period = await this.findTenantPeriod(tenant, periodId);
    if (period.status === AccountingPeriodStatus.LOCKED) {
      throw new BadRequestException('Locked accounting periods cannot be reopened.');
    }

    return this.prisma.accountingPeriod.update({
      where: { id: period.id },
      data: {
        status: AccountingPeriodStatus.OPEN,
        closedAt: null,
      },
    });
  }

  async trialBalance(
    tenant: TenantContext,
    clientCompanyId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    await this.ensureTenantCompany(tenant, clientCompanyId);
    const rows = await this.prisma.journalEntryLine.findMany({
      where: {
        account: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId,
        },
        journalEntry: {
          status: JournalEntryStatus.POSTED,
          entryDate: toDateFilter(dateFrom, dateTo),
        },
      },
      include: {
        account: true,
      },
      orderBy: [{ account: { code: 'asc' } }],
    });

    const accounts = new Map<string, TrialBalanceAccumulator>();
    for (const line of rows) {
      const key = line.account.code;
      const row =
        accounts.get(key) ??
        ({
          accountId: line.account.id,
          code: line.account.code,
          name: line.account.name,
          type: line.account.type,
          normalBalance: line.account.normalBalance,
          debit: 0,
          credit: 0,
          balance: 0,
        } satisfies TrialBalanceAccumulator);

      row.debit = roundMoney(row.debit + Number(line.debit));
      row.credit = roundMoney(row.credit + Number(line.credit));
      row.balance = roundMoney(row.debit - row.credit);
      accounts.set(key, row);
    }

    return [...accounts.values()].map((row) => ({
      ...row,
      normalBalanceAmount:
        row.normalBalance === NormalBalance.DEBIT ? row.balance : roundMoney(row.balance * -1),
    }));
  }

  async ledger(
    tenant: TenantContext,
    clientCompanyId: string,
    accountCode?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    await this.ensureTenantCompany(tenant, clientCompanyId);
    const rows = await this.prisma.journalEntryLine.findMany({
      where: {
        account: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId,
          code: accountCode,
        },
        journalEntry: {
          status: JournalEntryStatus.POSTED,
          entryDate: toDateFilter(dateFrom, dateTo),
        },
      },
      include: {
        account: true,
        journalEntry: true,
      },
      orderBy: [
        { account: { code: 'asc' } },
        { journalEntry: { entryDate: 'asc' } },
        { journalEntry: { entryNumber: 'asc' } },
        { lineNumber: 'asc' },
      ],
    });

    const balances = new Map<string, number>();
    return rows.map((line) => {
      const debit = Number(line.debit);
      const credit = Number(line.credit);
      const current = balances.get(line.account.code) ?? 0;
      const runningBalance = roundMoney(current + debit - credit);
      balances.set(line.account.code, runningBalance);

      return {
        id: line.id,
        entryId: line.journalEntryId,
        entryNumber: line.journalEntry.entryNumber,
        entryDate: line.journalEntry.entryDate,
        source: line.journalEntry.source,
        reference: line.journalEntry.reference,
        accountCode: line.account.code,
        accountName: line.account.name,
        description: line.description ?? line.journalEntry.description,
        debit,
        credit,
        runningBalance,
      };
    });
  }

  async financialStatements(
    tenant: TenantContext,
    clientCompanyId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const trialBalance = await this.trialBalance(tenant, clientCompanyId, dateFrom, dateTo);
    const incomeRows = trialBalance.filter(
      (row) => row.type === ChartAccountType.REVENUE || row.type === ChartAccountType.EXPENSE,
    );
    const balanceRows = trialBalance.filter(
      (row) =>
        row.type === ChartAccountType.ASSET ||
        row.type === ChartAccountType.LIABILITY ||
        row.type === ChartAccountType.EQUITY,
    );
    const revenue = roundMoney(
      incomeRows
        .filter((row) => row.type === ChartAccountType.REVENUE)
        .reduce((sum, row) => sum + statementAmount(row), 0),
    );
    const expenses = roundMoney(
      incomeRows
        .filter((row) => row.type === ChartAccountType.EXPENSE)
        .reduce((sum, row) => sum + statementAmount(row), 0),
    );
    const assets = roundMoney(
      balanceRows
        .filter((row) => row.type === ChartAccountType.ASSET)
        .reduce((sum, row) => sum + statementAmount(row), 0),
    );
    const liabilities = roundMoney(
      balanceRows
        .filter((row) => row.type === ChartAccountType.LIABILITY)
        .reduce((sum, row) => sum + statementAmount(row), 0),
    );
    const equity = roundMoney(
      balanceRows
        .filter((row) => row.type === ChartAccountType.EQUITY)
        .reduce((sum, row) => sum + statementAmount(row), 0),
    );
    const netIncome = roundMoney(revenue - expenses);

    return {
      period: { dateFrom, dateTo },
      incomeStatement: {
        revenue,
        expenses,
        netIncome,
        rows: incomeRows,
      },
      balanceSheet: {
        assets,
        liabilities,
        equity,
        netIncome,
        liabilitiesEquityAndCurrentResult: roundMoney(liabilities + equity + netIncome),
        difference: roundMoney(assets - liabilities - equity - netIncome),
        rows: balanceRows,
      },
    };
  }

  async vatReconciliation(tenant: TenantContext, clientCompanyId: string, year: number) {
    await this.ensureTenantCompany(tenant, clientCompanyId);
    const rows = new Map<string, VatReconciliationRow>();
    for (let month = 1; month <= 12; month += 1) {
      rows.set(periodKey(year, month), createVatReconciliationRow(year, month));
    }

    const [documents, journalLines] = await Promise.all([
      this.prisma.document.findMany({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId,
          deletedAt: null,
          issueDate: {
            gte: new Date(Date.UTC(year, 0, 1)),
            lt: new Date(Date.UTC(year + 1, 0, 1)),
          },
        },
      }),
      this.prisma.journalEntryLine.findMany({
        where: {
          account: {
            accountingOfficeId: tenant.accountingOfficeId,
            clientCompanyId,
            code: { in: ['70.00', '20.00', '54.00', '54.01'] },
          },
          journalEntry: {
            status: JournalEntryStatus.POSTED,
            entryDate: {
              gte: new Date(Date.UTC(year, 0, 1)),
              lt: new Date(Date.UTC(year + 1, 0, 1)),
            },
          },
        },
        include: {
          account: true,
          journalEntry: true,
        },
      }),
    ]);

    for (const document of documents) {
      const row = rows.get(periodKey(year, document.issueDate.getUTCMonth() + 1));
      if (!row) {
        continue;
      }

      const sign = document.documentType === DocumentType.CREDIT_NOTE ? -1 : 1;
      const net = roundMoney(Number(document.netAmount) * sign);
      const vat = roundMoney(Number(document.vatAmount) * sign);

      if (document.documentType === DocumentType.PURCHASE_INVOICE) {
        row.documents.purchasesNet = roundMoney(row.documents.purchasesNet + net);
        row.documents.inputVat = roundMoney(row.documents.inputVat + vat);
      } else {
        row.documents.salesNet = roundMoney(row.documents.salesNet + net);
        row.documents.outputVat = roundMoney(row.documents.outputVat + vat);
      }

      row.documents.count += 1;
    }

    for (const line of journalLines) {
      const row = rows.get(periodKey(year, line.journalEntry.periodMonth));
      if (!row) {
        continue;
      }

      const debit = Number(line.debit);
      const credit = Number(line.credit);
      if (line.account.code === '70.00') {
        row.ledger.salesNet = roundMoney(row.ledger.salesNet + credit - debit);
      } else if (line.account.code === '20.00') {
        row.ledger.purchasesNet = roundMoney(row.ledger.purchasesNet + debit - credit);
      } else if (line.account.code === '54.00') {
        row.ledger.outputVat = roundMoney(row.ledger.outputVat + credit - debit);
      } else if (line.account.code === '54.01') {
        row.ledger.inputVat = roundMoney(row.ledger.inputVat + debit - credit);
      }
    }

    return [...rows.values()].map((row) => {
      const differences = {
        salesNet: roundMoney(row.documents.salesNet - row.ledger.salesNet),
        outputVat: roundMoney(row.documents.outputVat - row.ledger.outputVat),
        purchasesNet: roundMoney(row.documents.purchasesNet - row.ledger.purchasesNet),
        inputVat: roundMoney(row.documents.inputVat - row.ledger.inputVat),
      };

      return {
        ...row,
        differences,
        balanced:
          differences.salesNet === 0 &&
          differences.outputVat === 0 &&
          differences.purchasesNet === 0 &&
          differences.inputVat === 0,
      };
    });
  }

  private async ensureTenantCompany(tenant: TenantContext, clientCompanyId: string) {
    const company = await this.prisma.clientCompany.findFirst({
      where: {
        id: clientCompanyId,
        accountingOfficeId: tenant.accountingOfficeId,
        deletedAt: null,
      },
    });

    if (!company) {
      throw new NotFoundException('Client company was not found.');
    }
  }

  private documentCoverageWhere(
    tenant: TenantContext,
    clientCompanyId?: string,
    dateFrom?: string,
    dateTo?: string,
  ): Prisma.DocumentWhereInput {
    return {
      accountingOfficeId: tenant.accountingOfficeId,
      clientCompanyId,
      deletedAt: null,
      issueDate: toDateFilter(dateFrom, dateTo),
    };
  }

  private async findTenantPeriod(tenant: TenantContext, periodId: string) {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        id: periodId,
        accountingOfficeId: tenant.accountingOfficeId,
      },
    });

    if (!period) {
      throw new NotFoundException('Accounting period was not found.');
    }

    return period;
  }

  private async periodTotals(
    tenant: TenantContext,
    clientCompanyId: string,
    fiscalYear: number,
    periodMonth: number,
  ) {
    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        journalEntry: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId,
          fiscalYear,
          periodMonth,
          status: JournalEntryStatus.POSTED,
        },
      },
    });
    const debit = roundMoney(lines.reduce((sum, line) => sum + Number(line.debit), 0));
    const credit = roundMoney(lines.reduce((sum, line) => sum + Number(line.credit), 0));

    return {
      debit,
      credit,
      difference: roundMoney(debit - credit),
    };
  }

  private async seedDefaultAccounts(
    tx: Prisma.TransactionClient,
    tenant: TenantContext,
    clientCompanyId: string,
  ) {
    const accounts = [];
    for (const account of DEFAULT_CHART_ACCOUNTS) {
      accounts.push(
        await tx.chartAccount.upsert({
          where: {
            clientCompanyId_code: {
              clientCompanyId,
              code: account.code,
            },
          },
          update: {
            name: account.name,
            type: account.type,
            normalBalance: account.normalBalance,
            isControl: account.isControl ?? false,
            isActive: true,
            taxCategory: account.taxCategory,
            myDataCategory: account.myDataCategory,
          },
          create: {
            accountingOfficeId: tenant.accountingOfficeId,
            clientCompanyId,
            code: account.code,
            name: account.name,
            type: account.type,
            normalBalance: account.normalBalance,
            isControl: account.isControl ?? false,
            taxCategory: account.taxCategory,
            myDataCategory: account.myDataCategory,
          },
        }),
      );
    }

    return accounts;
  }

  private async seedDefaultPostingRules(
    tx: Prisma.TransactionClient,
    tenant: TenantContext,
    clientCompanyId: string,
  ) {
    const rules = [];
    for (const rule of DEFAULT_DOCUMENT_POSTING_RULES) {
      rules.push(
        await tx.documentPostingRule.upsert({
          where: {
            clientCompanyId_code: {
              clientCompanyId,
              code: rule.code,
            },
          },
          update: {
            name: rule.name,
            documentType: rule.documentType,
            movementCode: rule.movementCode,
            journalCode: rule.journalCode,
            counterpartyAccountCode: rule.counterpartyAccountCode,
            counterpartySide: rule.counterpartySide,
            netAccountCode: rule.netAccountCode,
            netSide: rule.netSide,
            vatAccountCode: rule.vatAccountCode,
            vatSide: rule.vatSide,
            isActive: true,
          },
          create: {
            accountingOfficeId: tenant.accountingOfficeId,
            clientCompanyId,
            ...rule,
          },
        }),
      );
    }

    return rules;
  }

  private async seedFiscalPeriods(
    tx: Prisma.TransactionClient,
    tenant: TenantContext,
    clientCompanyId: string,
    fiscalYear: number,
  ) {
    const periods = [];
    for (let month = 1; month <= 12; month += 1) {
      periods.push(
        await tx.accountingPeriod.upsert({
          where: {
            clientCompanyId_fiscalYear_periodMonth: {
              clientCompanyId,
              fiscalYear,
              periodMonth: month,
            },
          },
          update: {},
          create: {
            accountingOfficeId: tenant.accountingOfficeId,
            clientCompanyId,
            fiscalYear,
            periodMonth: month,
            startsAt: new Date(Date.UTC(fiscalYear, month - 1, 1)),
            endsAt: new Date(Date.UTC(fiscalYear, month, 0, 23, 59, 59, 999)),
            status: AccountingPeriodStatus.OPEN,
          },
        }),
      );
    }

    return periods;
  }

  private async ensurePeriodOpen(
    tx: Prisma.TransactionClient,
    tenant: TenantContext,
    clientCompanyId: string,
    fiscal: FiscalInfo,
    entryDate: Date,
  ) {
    const period = await tx.accountingPeriod.upsert({
      where: {
        clientCompanyId_fiscalYear_periodMonth: {
          clientCompanyId,
          fiscalYear: fiscal.year,
          periodMonth: fiscal.month,
        },
      },
      update: {},
      create: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId,
        fiscalYear: fiscal.year,
        periodMonth: fiscal.month,
        startsAt: new Date(Date.UTC(fiscal.year, fiscal.month - 1, 1)),
        endsAt: new Date(Date.UTC(fiscal.year, fiscal.month, 0, 23, 59, 59, 999)),
        status: AccountingPeriodStatus.OPEN,
      },
    });

    if (period.status !== AccountingPeriodStatus.OPEN) {
      throw new BadRequestException(
        `Accounting period ${fiscal.year}-${String(fiscal.month).padStart(2, '0')} is ${period.status}.`,
      );
    }

    if (entryDate < period.startsAt || entryDate > period.endsAt) {
      throw new BadRequestException('Entry date is outside the accounting period.');
    }
  }

  private async accountMap(
    tx: Prisma.TransactionClient,
    tenant: TenantContext,
    clientCompanyId: string,
  ) {
    const accounts = await tx.chartAccount.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId,
        isActive: true,
      },
    });

    return new Map(accounts.map((account) => [account.code, account]));
  }

  private async resolveDocumentPostingRule(
    tx: Prisma.TransactionClient,
    tenant: TenantContext,
    document: PostingDocument,
  ) {
    const rule =
      (document.movementCode
        ? await tx.documentPostingRule.findFirst({
            where: {
              accountingOfficeId: tenant.accountingOfficeId,
              clientCompanyId: document.clientCompanyId,
              isActive: true,
              movementCode: document.movementCode,
            },
          })
        : null) ??
      (await tx.documentPostingRule.findFirst({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: document.clientCompanyId,
          isActive: true,
          documentType: document.documentType,
        },
        orderBy: { code: 'asc' },
      }));

    if (!rule) {
      throw new BadRequestException('No active accounting posting rule matched this document.');
    }

    return rule;
  }

  private documentPostingLines(
    document: PostingDocument,
    rule: DocumentPostingRuleLike,
    accounts: AccountMap,
  ): PostingLine[] {
    const net = Number(document.netAmount);
    const vat = Number(document.vatAmount);
    const total = Number(document.totalAmount);
    const counterparty = document.counterpartyName ?? document.clientCompany.legalName;

    const lines = [
      this.toPostingLine(
        this.requireAccount(accounts, rule.counterpartyAccountCode),
        rule.counterpartySide,
        total,
        counterparty,
      ),
      this.toPostingLine(
        this.requireAccount(accounts, rule.netAccountCode),
        rule.netSide,
        net,
        `${rule.name} ${documentReference(document)}`,
      ),
    ];

    if (vat > 0 && rule.vatAccountCode && rule.vatSide) {
      lines.push(
        this.toPostingLine(
          this.requireAccount(accounts, rule.vatAccountCode),
          rule.vatSide,
          vat,
          `ΦΠΑ ${documentReference(document)}`,
          document.vatCategory,
        ),
      );
    }

    this.validatePostingLines(lines);
    return lines;
  }

  private toPostingLine(
    account: PostingLine['account'],
    side: NormalBalance,
    amount: number,
    description: string,
    taxCode?: string,
  ): PostingLine {
    return {
      account,
      description,
      debit: side === NormalBalance.DEBIT ? amount : 0,
      credit: side === NormalBalance.CREDIT ? amount : 0,
      taxCode,
    };
  }

  private requireAccount(accounts: AccountMap, code: string) {
    const account = accounts.get(code);
    if (!account) {
      throw new BadRequestException(`Chart account ${code} is missing for this client.`);
    }
    return account;
  }

  private validateLineTotals(lines: CreateJournalEntryDto['lines']) {
    if (lines.length < 2) {
      throw new BadRequestException('A journal entry needs at least two lines.');
    }

    let debit = 0;
    let credit = 0;
    for (const line of lines) {
      const lineDebit = roundMoney(line.debit ?? 0);
      const lineCredit = roundMoney(line.credit ?? 0);
      if ((lineDebit === 0 && lineCredit === 0) || (lineDebit > 0 && lineCredit > 0)) {
        throw new BadRequestException('Each journal line must have either debit or credit.');
      }
      debit = roundMoney(debit + lineDebit);
      credit = roundMoney(credit + lineCredit);
    }

    if (debit !== credit) {
      throw new BadRequestException('Journal entry is not balanced.');
    }
  }

  private validatePostingLines(lines: PostingLine[]) {
    const debit = roundMoney(lines.reduce((sum, line) => sum + line.debit, 0));
    const credit = roundMoney(lines.reduce((sum, line) => sum + line.credit, 0));

    if (debit !== credit) {
      throw new BadRequestException('Posting rule produced an unbalanced journal entry.');
    }
  }

  private async nextEntryNumber(
    tx: Prisma.TransactionClient,
    clientCompanyId: string,
    prefix: string,
    entryDate: Date,
  ) {
    const fiscal = toFiscalInfo(entryDate);
    const count = await tx.journalEntry.count({
      where: {
        clientCompanyId,
        fiscalYear: fiscal.year,
        source: sourceForPrefix(prefix),
      },
    });

    return `${prefix}-${fiscal.year}-${String(count + 1).padStart(5, '0')}`;
  }
}

const journalEntryInclude = {
  lines: {
    include: {
      account: true,
    },
    orderBy: {
      lineNumber: 'asc',
    },
  },
  documentLinks: true,
} satisfies Prisma.JournalEntryInclude;

const DEFAULT_CHART_ACCOUNTS: DefaultAccount[] = [
  {
    code: '10.00',
    name: 'Ταμείο',
    type: ChartAccountType.ASSET,
    normalBalance: NormalBalance.DEBIT,
    isControl: true,
  },
  {
    code: '12.00',
    name: 'Πάγια στοιχεία',
    type: ChartAccountType.ASSET,
    normalBalance: NormalBalance.DEBIT,
    taxCategory: 'FIXED_ASSETS',
  },
  {
    code: '12.99',
    name: 'Συσσωρευμένες αποσβέσεις παγίων',
    type: ChartAccountType.ASSET,
    normalBalance: NormalBalance.CREDIT,
    taxCategory: 'ACCUMULATED_DEPRECIATION',
  },
  {
    code: '20.00',
    name: 'Αγορές και έξοδα',
    type: ChartAccountType.EXPENSE,
    normalBalance: NormalBalance.DEBIT,
    taxCategory: 'PURCHASES',
  },
  {
    code: '30.00',
    name: 'Πελάτες',
    type: ChartAccountType.ASSET,
    normalBalance: NormalBalance.DEBIT,
    isControl: true,
  },
  {
    code: '40.00',
    name: 'Κεφάλαιο / καθαρή θέση',
    type: ChartAccountType.EQUITY,
    normalBalance: NormalBalance.CREDIT,
  },
  {
    code: '50.00',
    name: 'Προμηθευτές',
    type: ChartAccountType.LIABILITY,
    normalBalance: NormalBalance.CREDIT,
    isControl: true,
  },
  {
    code: '54.00',
    name: 'ΦΠΑ εκροών',
    type: ChartAccountType.LIABILITY,
    normalBalance: NormalBalance.CREDIT,
    taxCategory: 'VAT_OUTPUT',
  },
  {
    code: '54.01',
    name: 'ΦΠΑ εισροών',
    type: ChartAccountType.ASSET,
    normalBalance: NormalBalance.DEBIT,
    taxCategory: 'VAT_INPUT',
  },
  {
    code: '66.00',
    name: 'Αποσβέσεις χρήσης',
    type: ChartAccountType.EXPENSE,
    normalBalance: NormalBalance.DEBIT,
    taxCategory: 'DEPRECIATION',
  },
  {
    code: '70.00',
    name: 'Έσοδα πωλήσεων',
    type: ChartAccountType.REVENUE,
    normalBalance: NormalBalance.CREDIT,
    taxCategory: 'SALES',
  },
];

const DEFAULT_DOCUMENT_POSTING_RULES: DefaultDocumentPostingRule[] = [
  {
    code: 'SALE_INVOICE',
    name: 'Τιμολόγιο πώλησης',
    documentType: DocumentType.SALES_INVOICE,
    movementCode: 'SALE_INVOICE',
    journalCode: 'SALES',
    counterpartyAccountCode: '30.00',
    counterpartySide: NormalBalance.DEBIT,
    netAccountCode: '70.00',
    netSide: NormalBalance.CREDIT,
    vatAccountCode: '54.00',
    vatSide: NormalBalance.CREDIT,
  },
  {
    code: 'RETAIL_RECEIPT',
    name: 'Απόδειξη λιανικής',
    documentType: DocumentType.RETAIL_RECEIPT,
    movementCode: 'SALE_INVOICE',
    journalCode: 'SALES',
    counterpartyAccountCode: '10.00',
    counterpartySide: NormalBalance.DEBIT,
    netAccountCode: '70.00',
    netSide: NormalBalance.CREDIT,
    vatAccountCode: '54.00',
    vatSide: NormalBalance.CREDIT,
  },
  {
    code: 'PURCHASE_INVOICE',
    name: 'Τιμολόγιο αγοράς/δαπάνης',
    documentType: DocumentType.PURCHASE_INVOICE,
    movementCode: 'PURCHASE_INVOICE',
    journalCode: 'PURCHASES',
    counterpartyAccountCode: '50.00',
    counterpartySide: NormalBalance.CREDIT,
    netAccountCode: '20.00',
    netSide: NormalBalance.DEBIT,
    vatAccountCode: '54.01',
    vatSide: NormalBalance.DEBIT,
  },
  {
    code: 'CREDIT_NOTE',
    name: 'Πιστωτικό πώλησης',
    documentType: DocumentType.CREDIT_NOTE,
    movementCode: 'CREDIT_NOTE',
    journalCode: 'SALES',
    counterpartyAccountCode: '30.00',
    counterpartySide: NormalBalance.CREDIT,
    netAccountCode: '70.00',
    netSide: NormalBalance.DEBIT,
    vatAccountCode: '54.00',
    vatSide: NormalBalance.DEBIT,
  },
];

interface DefaultAccount {
  code: string;
  name: string;
  type: ChartAccountType;
  normalBalance: NormalBalance;
  isControl?: boolean;
  taxCategory?: string;
  myDataCategory?: string;
}

interface DefaultDocumentPostingRule {
  code: string;
  name: string;
  documentType: DocumentType;
  movementCode: string;
  journalCode: string;
  counterpartyAccountCode: string;
  counterpartySide: NormalBalance;
  netAccountCode: string;
  netSide: NormalBalance;
  vatAccountCode?: string;
  vatSide?: NormalBalance;
}

interface FiscalInfo {
  year: number;
  month: number;
}

type AccountMap = Map<
  string,
  Awaited<ReturnType<Prisma.TransactionClient['chartAccount']['findFirstOrThrow']>>
>;

interface PostingDocument {
  id: string;
  clientCompanyId: string;
  documentType: DocumentType;
  series: string | null;
  documentNumber: string;
  movementCode: string | null;
  issueDate: Date;
  counterpartyName: string | null;
  netAmount: Prisma.Decimal | number | string;
  vatAmount: Prisma.Decimal | number | string;
  totalAmount: Prisma.Decimal | number | string;
  vatCategory: string;
  clientCompany: {
    legalName: string;
  };
}

interface DocumentPostingRuleLike {
  name: string;
  counterpartyAccountCode: string;
  counterpartySide: NormalBalance;
  netAccountCode: string;
  netSide: NormalBalance;
  vatAccountCode: string | null;
  vatSide: NormalBalance | null;
}

interface PostingLine {
  account: AccountMap extends Map<string, infer T> ? T : never;
  description: string;
  debit: number;
  credit: number;
  taxCode?: string;
}

interface TrialBalanceAccumulator {
  accountId: string;
  code: string;
  name: string;
  type: ChartAccountType;
  normalBalance: NormalBalance;
  debit: number;
  credit: number;
  balance: number;
}

interface VatReconciliationAmounts {
  salesNet: number;
  outputVat: number;
  purchasesNet: number;
  inputVat: number;
}

interface VatReconciliationRow {
  period: string;
  year: number;
  month: number;
  documents: VatReconciliationAmounts & { count: number };
  ledger: VatReconciliationAmounts;
}

function toFiscalInfo(date: Date): FiscalInfo {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  };
}

function periodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function createVatReconciliationRow(year: number, month: number): VatReconciliationRow {
  return {
    period: periodKey(year, month),
    year,
    month,
    documents: {
      salesNet: 0,
      outputVat: 0,
      purchasesNet: 0,
      inputVat: 0,
      count: 0,
    },
    ledger: {
      salesNet: 0,
      outputVat: 0,
      purchasesNet: 0,
      inputVat: 0,
    },
  };
}

function toDateFilter(dateFrom?: string, dateTo?: string) {
  if (!dateFrom && !dateTo) {
    return undefined;
  }

  return {
    gte: dateFrom ? new Date(dateFrom) : undefined,
    lte: dateTo ? endOfDay(dateTo) : undefined,
  };
}

function sourceForPrefix(prefix: string): JournalEntrySource {
  if (prefix === 'DOC') {
    return JournalEntrySource.DOCUMENT;
  }

  if (prefix === 'DEP') {
    return JournalEntrySource.FIXED_ASSET;
  }

  return JournalEntrySource.MANUAL;
}

function parseJournalEntrySource(source?: string): JournalEntrySource | undefined {
  if (!source) {
    return undefined;
  }

  return Object.values(JournalEntrySource).includes(source as JournalEntrySource)
    ? (source as JournalEntrySource)
    : undefined;
}

function endOfDay(date: string): Date {
  const value = new Date(date);
  value.setUTCHours(23, 59, 59, 999);
  return value;
}

function toMoney(value: number): Prisma.Decimal {
  return new Prisma.Decimal(roundMoney(value).toFixed(2));
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function statementAmount(row: { type: ChartAccountType; balance: number }): number {
  if (
    row.type === ChartAccountType.LIABILITY ||
    row.type === ChartAccountType.EQUITY ||
    row.type === ChartAccountType.REVENUE
  ) {
    return roundMoney(row.balance * -1);
  }

  return roundMoney(row.balance);
}

function documentReference(document: { series: string | null; documentNumber: string }): string {
  return [document.series, document.documentNumber].filter(Boolean).join('-');
}

function documentDescription(document: PostingDocument): string {
  const typeLabel: Record<DocumentType, string> = {
    SALES_INVOICE: 'Τιμολόγιο πώλησης',
    PURCHASE_INVOICE: 'Τιμολόγιο αγοράς',
    CREDIT_NOTE: 'Πιστωτικό',
    RETAIL_RECEIPT: 'Απόδειξη λιανικής',
  };

  return `${typeLabel[document.documentType]} ${documentReference(document)}`;
}
