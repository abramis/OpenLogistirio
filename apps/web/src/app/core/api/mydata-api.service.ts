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

export interface MyDataReconciliationItem {
  id: string;
  source: string;
  reconciliationStatus: string;
  reconciliationIssues?: { fields?: string[]; missing?: string[] } | null;
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

@Injectable({
  providedIn: 'root',
})
export class MyDataApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/mydata`;

  sync(payload: SyncMyDataDocsPayload): Observable<SyncMyDataDocsResult> {
    return this.http.post<SyncMyDataDocsResult>(`${this.baseUrl}/sync`, payload, {});
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
