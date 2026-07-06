import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DocumentListItem {
  id: string;
  documentType: string;
  series?: string | null;
  documentNumber: string;
  issueDate: string;
  counterpartyName?: string | null;
  counterpartyVatNumber?: string | null;
  movementCode?: string | null;
  journalCode?: string | null;
  netAmount: string | number;
  vatAmount: string | number;
  totalAmount: string | number;
  vatCategory: string;
  myDataStatus: string;
  myDataMark?: string | null;
  myDataUid?: string | null;
  myDataQrUrl?: string | null;
  clientCompany: {
    id: string;
    legalName: string;
    vatNumber: string;
    entityType?: string;
    myDataMode?: string;
    myDataAuthorized?: boolean;
  };
}

export interface MyDataPrepareResponse {
  documentId: string;
  status: string;
  xml: string;
}

export interface DocumentPayload {
  clientCompanyId: string;
  documentType: string;
  series?: string;
  documentNumber: string;
  issueDate: string;
  counterpartyName?: string;
  counterpartyVatNumber?: string;
  movementCode?: string;
  journalCode?: string;
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
  vatCategory: string;
}

export interface MyDataSendResponse {
  documentId: string;
  status: string;
  mark?: string;
  uid?: string;
  qrUrl?: string;
}

export interface TransmissionAttempt {
  id: string;
  documentId: string;
  provider: string;
  status: string;
  requestPayload: string;
  responsePayload?: unknown;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

export interface DocumentFilters {
  search?: string;
  documentType?: string;
  myDataStatus?: string;
  clientCompanyId?: string;
  movementCode?: string;
  journalCode?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable({
  providedIn: 'root',
})
export class DocumentsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/documents`;

  findAll(filters: DocumentFilters = {}): Observable<DocumentListItem[]> {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
    );

    return this.http.get<DocumentListItem[]>(this.baseUrl, { headers: this.headers, params });
  }

  create(payload: DocumentPayload): Observable<DocumentListItem> {
    return this.http.post<DocumentListItem>(this.baseUrl, payload, { headers: this.headers });
  }

  prepareMyData(documentId: string): Observable<MyDataPrepareResponse> {
    return this.http.post<MyDataPrepareResponse>(
      `${this.baseUrl}/${documentId}/mydata/prepare`,
      {},
      { headers: this.headers },
    );
  }

  sendMockMyData(documentId: string): Observable<MyDataSendResponse> {
    return this.http.post<MyDataSendResponse>(
      `${this.baseUrl}/${documentId}/mydata/send-mock`,
      {},
      { headers: this.headers },
    );
  }

  sendTestMyData(documentId: string): Observable<MyDataSendResponse> {
    return this.http.post<MyDataSendResponse>(
      `${this.baseUrl}/${documentId}/mydata/send-test`,
      {},
      { headers: this.headers },
    );
  }

  prepareExpenseMyData(documentId: string): Observable<MyDataPrepareResponse> {
    return this.http.post<MyDataPrepareResponse>(
      `${this.baseUrl}/${documentId}/mydata/prepare-expense`,
      {},
      { headers: this.headers },
    );
  }

  sendExpenseMockMyData(documentId: string): Observable<MyDataSendResponse> {
    return this.http.post<MyDataSendResponse>(
      `${this.baseUrl}/${documentId}/mydata/send-expense-mock`,
      {},
      { headers: this.headers },
    );
  }

  getMyDataHistory(documentId: string): Observable<TransmissionAttempt[]> {
    return this.http.get<TransmissionAttempt[]>(`${this.baseUrl}/${documentId}/mydata/history`, {
      headers: this.headers,
    });
  }

  private get headers(): HttpHeaders {
    return new HttpHeaders({
      'x-office-id': 'office-athens-demo',
    });
  }
}
