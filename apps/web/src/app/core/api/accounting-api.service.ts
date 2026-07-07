import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ChartAccount {
  id: string;
  clientCompanyId: string;
  code: string;
  name: string;
  type: string;
  normalBalance: string;
  isControl: boolean;
  isActive: boolean;
  taxCategory?: string | null;
}

export interface SeedDefaultChartResult {
  clientCompanyId: string;
  fiscalYear: number;
  accountCount: number;
  postingRuleCount: number;
  periodCount: number;
  accounts: ChartAccount[];
  postingRules: DocumentPostingRule[];
}

export interface DocumentPostingRule {
  id: string;
  clientCompanyId: string;
  code: string;
  name: string;
  documentType?: string | null;
  movementCode?: string | null;
  journalCode?: string | null;
  counterpartyAccountCode: string;
  counterpartySide: string;
  netAccountCode: string;
  netSide: string;
  vatAccountCode?: string | null;
  vatSide?: string | null;
  isActive: boolean;
}

export interface JournalEntryLine {
  id: string;
  lineNumber: number;
  debit: string | number;
  credit: string | number;
  description?: string | null;
  taxCode?: string | null;
  account: ChartAccount;
}

export interface JournalEntry {
  id: string;
  clientCompanyId: string;
  entryNumber: string;
  entryDate: string;
  source: string;
  status: string;
  description: string;
  reference?: string | null;
  lines: JournalEntryLine[];
  clientCompany?: {
    id: string;
    legalName: string;
    vatNumber: string;
  };
}

export interface ManualJournalEntryPayload {
  clientCompanyId: string;
  entryDate: string;
  description: string;
  reference?: string;
  lines: Array<{
    accountCode: string;
    description?: string;
    debit?: number;
    credit?: number;
  }>;
}

export interface AccountingPeriod {
  id: string;
  clientCompanyId: string;
  fiscalYear: number;
  periodMonth: number;
  startsAt: string;
  endsAt: string;
  status: string;
  closedAt?: string | null;
  lockedAt?: string | null;
}

export interface AccountingCoverage {
  documents: number;
  postedDocuments: number;
  unpostedDocuments: number;
  journalEntries: number;
  postedRatio: number;
}

export interface UnpostedAccountingDocument {
  id: string;
  documentType: string;
  series?: string | null;
  documentNumber: string;
  issueDate: string;
  counterpartyName?: string | null;
  movementCode?: string | null;
  journalCode?: string | null;
  netAmount: string | number;
  vatAmount: string | number;
  totalAmount: string | number;
  clientCompany: {
    id: string;
    legalName: string;
    vatNumber: string;
  };
}

export interface BulkPostDocumentsResult {
  requested: number;
  postedCount: number;
  failedCount: number;
  posted: Array<{
    documentId: string;
    journalEntryId: string;
    entryNumber: string;
  }>;
  failed: Array<{
    documentId: string;
    documentNumber: string;
    error: string;
  }>;
}

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  type: string;
  normalBalance: string;
  debit: number;
  credit: number;
  balance: number;
  normalBalanceAmount: number;
}

export interface FinancialStatements {
  period: {
    dateFrom?: string;
    dateTo?: string;
  };
  incomeStatement: {
    revenue: number;
    expenses: number;
    netIncome: number;
    rows: TrialBalanceRow[];
  };
  balanceSheet: {
    assets: number;
    liabilities: number;
    equity: number;
    netIncome: number;
    liabilitiesEquityAndCurrentResult: number;
    difference: number;
    rows: TrialBalanceRow[];
  };
}

export interface VatReconciliationRow {
  period: string;
  year: number;
  month: number;
  documents: {
    salesNet: number;
    outputVat: number;
    purchasesNet: number;
    inputVat: number;
    count: number;
  };
  ledger: {
    salesNet: number;
    outputVat: number;
    purchasesNet: number;
    inputVat: number;
  };
  differences: {
    salesNet: number;
    outputVat: number;
    purchasesNet: number;
    inputVat: number;
  };
  balanced: boolean;
}

export interface LedgerRow {
  id: string;
  entryId: string;
  entryNumber: string;
  entryDate: string;
  source: string;
  reference?: string | null;
  accountCode: string;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

@Injectable({
  providedIn: 'root',
})
export class AccountingApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/accounting`;

  findAccounts(clientCompanyId = ''): Observable<ChartAccount[]> {
    const params = clientCompanyId ? { clientCompanyId } : undefined;
    return this.http.get<ChartAccount[]>(`${this.baseUrl}/accounts`, {
      params,
    });
  }

  findPostingRules(clientCompanyId = ''): Observable<DocumentPostingRule[]> {
    const params = clientCompanyId ? { clientCompanyId } : undefined;
    return this.http.get<DocumentPostingRule[]>(`${this.baseUrl}/posting-rules`, {
      params,
    });
  }

  coverage(clientCompanyId = '', dateFrom = '', dateTo = ''): Observable<AccountingCoverage> {
    const params = removeEmpty({ clientCompanyId, dateFrom, dateTo });
    return this.http.get<AccountingCoverage>(`${this.baseUrl}/coverage`, {
      params,
    });
  }

  findJournalEntries(
    clientCompanyId = '',
    dateFrom = '',
    dateTo = '',
    source = '',
  ): Observable<JournalEntry[]> {
    const params = removeEmpty({ clientCompanyId, dateFrom, dateTo, source });
    return this.http.get<JournalEntry[]>(`${this.baseUrl}/journal-entries`, {
      params,
    });
  }

  findUnpostedDocuments(
    clientCompanyId = '',
    dateFrom = '',
    dateTo = '',
  ): Observable<UnpostedAccountingDocument[]> {
    const params = removeEmpty({ clientCompanyId, dateFrom, dateTo });
    return this.http.get<UnpostedAccountingDocument[]>(`${this.baseUrl}/documents/unposted`, {
      params,
    });
  }

  findPeriods(clientCompanyId: string, fiscalYear: number): Observable<AccountingPeriod[]> {
    return this.http.get<AccountingPeriod[]>(`${this.baseUrl}/periods`, {
      params: { clientCompanyId, fiscalYear },
    });
  }

  seedDefaultChart(
    clientCompanyId: string,
    fiscalYear: number,
  ): Observable<SeedDefaultChartResult> {
    return this.http.post<SeedDefaultChartResult>(
      `${this.baseUrl}/accounts/seed-defaults`,
      { clientCompanyId, fiscalYear },
      {},
    );
  }

  postDocument(documentId: string): Observable<JournalEntry> {
    return this.http.post<JournalEntry>(`${this.baseUrl}/documents/${documentId}/post`, {}, {});
  }

  bulkPostDocuments(
    clientCompanyId: string,
    dateFrom = '',
    dateTo = '',
  ): Observable<BulkPostDocumentsResult> {
    return this.http.post<BulkPostDocumentsResult>(
      `${this.baseUrl}/documents/bulk-post`,
      removeEmpty({ clientCompanyId, dateFrom, dateTo }),
      {},
    );
  }

  createManualEntry(payload: ManualJournalEntryPayload): Observable<JournalEntry> {
    return this.http.post<JournalEntry>(`${this.baseUrl}/entries`, payload, {});
  }

  postFixedAssetDepreciation(entryId: string): Observable<JournalEntry> {
    return this.http.post<JournalEntry>(
      `${this.baseUrl}/fixed-asset-depreciation/${entryId}/post`,
      {},
      {},
    );
  }

  closePeriod(periodId: string): Observable<AccountingPeriod> {
    return this.http.post<AccountingPeriod>(`${this.baseUrl}/periods/${periodId}/close`, {}, {});
  }

  lockPeriod(periodId: string): Observable<AccountingPeriod> {
    return this.http.post<AccountingPeriod>(`${this.baseUrl}/periods/${periodId}/lock`, {}, {});
  }

  reopenPeriod(periodId: string): Observable<AccountingPeriod> {
    return this.http.post<AccountingPeriod>(`${this.baseUrl}/periods/${periodId}/reopen`, {}, {});
  }

  trialBalance(clientCompanyId: string, dateFrom = '', dateTo = ''): Observable<TrialBalanceRow[]> {
    const params = removeEmpty({ clientCompanyId, dateFrom, dateTo });
    return this.http.get<TrialBalanceRow[]>(`${this.baseUrl}/trial-balance`, {
      params,
    });
  }

  financialStatements(
    clientCompanyId: string,
    dateFrom = '',
    dateTo = '',
  ): Observable<FinancialStatements> {
    const params = removeEmpty({ clientCompanyId, dateFrom, dateTo });
    return this.http.get<FinancialStatements>(`${this.baseUrl}/financial-statements`, {
      params,
    });
  }

  vatReconciliation(clientCompanyId: string, year: number): Observable<VatReconciliationRow[]> {
    return this.http.get<VatReconciliationRow[]>(`${this.baseUrl}/vat-reconciliation`, {
      params: { clientCompanyId, year },
    });
  }

  ledger(
    clientCompanyId: string,
    accountCode = '',
    dateFrom = '',
    dateTo = '',
  ): Observable<LedgerRow[]> {
    const params = removeEmpty({ clientCompanyId, accountCode, dateFrom, dateTo });
    return this.http.get<LedgerRow[]>(`${this.baseUrl}/ledger`, {
      params,
    });
  }
}

function removeEmpty(params: Record<string, string>) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== ''));
}
