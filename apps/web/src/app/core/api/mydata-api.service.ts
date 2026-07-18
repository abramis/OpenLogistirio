import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SyncMyDataDocsPayload {
  clientCompanyId: string;
  source: 'REQUEST_DOCS' | 'REQUEST_TRANSMITTED_DOCS';
  mark?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface MyDataSyncRun {
  id: string;
  source: string;
  status: string;
  environment?: string | null;
  endpoint?: string | null;
  fetchedCount: number;
  matchedCount: number;
  mismatchCount: number;
  createdAt: string;
}

export interface SyncMyDataDocsResult {
  syncRun: MyDataSyncRun;
  fetchedCount: number;
  matchedCount: number;
  mismatchCount: number;
  nextPartitionKey?: string;
  nextRowKey?: string;
}

export interface MyDataEnvironmentInfo {
  environment: 'test' | 'production';
  productionReadEnabled: boolean;
  productionWriteEnabled: boolean;
}

export interface OfficeMyDataCompanySummary {
  id: string;
  legalName: string;
  vatNumber: string;
  myDataAuthorized: boolean;
  myDataMode: string;
  apiReady: boolean;
  totalCount: number;
  matchedCount: number;
  missingInternalCount: number;
  mismatchCount: number;
  totalAmount: number;
  lastReceivedSync?: MyDataSyncRun | null;
  lastTransmittedSync?: MyDataSyncRun | null;
}

export interface OfficeMyDataDashboard {
  overview: {
    companyCount: number;
    authorizedCompanyCount: number;
    totalCount: number;
    matchedCount: number;
    missingInternalCount: number;
    mismatchCount: number;
    companiesNeedingReviewCount: number;
    failedSyncCountLast24Hours: number;
  };
  companies: OfficeMyDataCompanySummary[];
  exceptions: Array<
    MyDataReconciliationItem & {
      clientCompany: { id: string; legalName: string; vatNumber: string };
    }
  >;
}

export interface OfficeMyDataSyncResult {
  companyCount: number;
  flowCount: number;
  completedCount: number;
  failedCount: number;
  fetchedCount: number;
  matchedCount: number;
  mismatchCount: number;
  results: Array<{
    clientCompanyId: string;
    legalName: string;
    source: 'REQUEST_DOCS' | 'REQUEST_TRANSMITTED_DOCS';
    status: 'COMPLETED' | 'FAILED';
    pages: number;
    fetchedCount: number;
    matchedCount: number;
    mismatchCount: number;
    error?: string;
  }>;
}

export interface MyDataReconciliationItem {
  id: string;
  source: string;
  reconciliationStatus: string;
  reconciliationIssues?: { fields?: string[]; missing?: string[] } | null;
  reviewStatus: 'PENDING' | 'RESOLVED' | 'IGNORED';
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  mark: string;
  uid?: string | null;
  issuerVatNumber?: string | null;
  counterpartyVatNumber?: string | null;
  invoiceType?: string | null;
  series?: string | null;
  documentNumber: string;
  issueDate?: string | null;
  netAmount?: string | number | null;
  vatAmount?: string | number | null;
  totalAmount?: string | number | null;
  fetchedAt: string;
  matchedDocument?: {
    id: string;
    documentType: string;
    series?: string | null;
    documentNumber: string;
    issueDate: string;
    counterpartyName?: string | null;
    counterpartyVatNumber?: string | null;
    totalAmount: string | number;
    myDataStatus: string;
    myDataMark?: string | null;
  } | null;
  syncRun?: {
    id: string;
    createdAt: string;
    environment?: string | null;
  };
}

export interface MyDataSnapshotCandidate {
  id: string;
  documentType: string;
  series?: string | null;
  documentNumber: string;
  issueDate: string;
  counterpartyName?: string | null;
  counterpartyVatNumber?: string | null;
  totalAmount: string | number;
  myDataMark?: string | null;
}

export interface MyDataPurchasePreview {
  snapshotId: string;
  clientCompanyId: string;
  mark: string;
  uid?: string | null;
  invoiceType?: string | null;
  series?: string | null;
  documentNumber: string;
  issueDate?: string | null;
  supplier: { vatNumber?: string | null; name: string };
  totals: { netAmount: number; vatAmount: number; totalAmount: number };
  vatBreakdown: Array<{
    vatCategory: string;
    netAmount: number;
    vatAmount: number;
    totalAmount: number;
  }>;
  lines: Array<{
    lineNumber: number;
    description: string;
    quantity: number;
    unitPrice: number;
    netAmount: number;
    vatCategory: string;
    vatRate: number;
    vatAmount: number;
    totalAmount: number;
    expenseClassificationType?: string | null;
    expenseClassificationCategory?: string | null;
  }>;
  possibleDuplicate?: { id: string; series?: string | null; documentNumber: string } | null;
  canCreate: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class MyDataApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/mydata`;

  sync(payload: SyncMyDataDocsPayload): Observable<SyncMyDataDocsResult> {
    return this.http.post<SyncMyDataDocsResult>(`${this.baseUrl}/sync`, payload, {});
  }

  syncOffice(payload: {
    sources?: Array<'REQUEST_DOCS' | 'REQUEST_TRANSMITTED_DOCS'>;
    dateFrom?: string;
    dateTo?: string;
    maxPages?: number;
  }): Observable<OfficeMyDataSyncResult> {
    return this.http.post<OfficeMyDataSyncResult>(`${this.baseUrl}/sync/office`, payload);
  }

  officeDashboard(params: {
    dateFrom?: string;
    dateTo?: string;
    source?: string;
    status?: string;
    take?: number;
  }): Observable<OfficeMyDataDashboard> {
    return this.http.get<OfficeMyDataDashboard>(`${this.baseUrl}/office-dashboard`, {
      params: Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
      ) as Record<string, string | number>,
    });
  }

  environment(): Observable<MyDataEnvironmentInfo> {
    return this.http.get<MyDataEnvironmentInfo>(`${this.baseUrl}/environment`);
  }

  createPurchaseFromSnapshot(snapshotId: string): Observable<{ document: { id: string } }> {
    return this.http.post<{ document: { id: string } }>(
      `${this.baseUrl}/snapshots/${snapshotId}/create-purchase`,
      {},
    );
  }

  previewPurchaseFromSnapshot(snapshotId: string): Observable<MyDataPurchasePreview> {
    return this.http.get<MyDataPurchasePreview>(
      `${this.baseUrl}/snapshots/${snapshotId}/purchase-preview`,
    );
  }

  snapshotCandidates(snapshotId: string): Observable<MyDataSnapshotCandidate[]> {
    return this.http.get<MyDataSnapshotCandidate[]>(
      `${this.baseUrl}/snapshots/${snapshotId}/candidates`,
    );
  }

  matchSnapshot(snapshotId: string, documentId: string, notes?: string) {
    return this.http.post(`${this.baseUrl}/snapshots/${snapshotId}/match`, {
      documentId,
      notes,
    });
  }

  reviewSnapshot(snapshotId: string, action: 'IGNORE' | 'REOPEN', notes?: string) {
    return this.http.post(`${this.baseUrl}/snapshots/${snapshotId}/review`, { action, notes });
  }

  findReconciliation(clientCompanyId: string): Observable<MyDataReconciliationItem[]> {
    return this.http.get<MyDataReconciliationItem[]>(`${this.baseUrl}/reconciliation`, {
      params: {
        clientCompanyId,
        take: 100,
      },
    });
  }
}
