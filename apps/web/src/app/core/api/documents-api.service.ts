import { HttpClient } from '@angular/common/http';
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
  paymentMethodType?: number;
  vatExemptionCategory?: number | null;
  correlatedInvoiceMark?: string | null;
  withheldAmount?: string | number;
  withheldCategory?: number | null;
  feesAmount?: string | number;
  feesCategory?: number | null;
  stampDutyAmount?: string | number;
  stampDutyCategory?: number | null;
  otherTaxesAmount?: string | number;
  otherTaxesCategory?: number | null;
  deductionsAmount?: string | number;
  myDataStatus: string;
  myDataMark?: string | null;
  myDataUid?: string | null;
  myDataQrUrl?: string | null;
  myDataClassificationMark?: string | null;
  myDataCancellationMark?: string | null;
  myDataCancelledAt?: string | null;
  classificationStatus?: string | null;
  clientCompany: {
    id: string;
    legalName: string;
    vatNumber: string;
    entityType?: string;
    myDataMode?: string;
    myDataAuthorized?: boolean;
    myDataCredentialRef?: string | null;
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
  paymentMethodType?: number;
  vatExemptionCategory?: number;
  correlatedInvoiceMark?: string;
  withheldAmount?: number;
  withheldCategory?: number;
  feesAmount?: number;
  feesCategory?: number;
  stampDutyAmount?: number;
  stampDutyCategory?: number;
  otherTaxesAmount?: number;
  otherTaxesCategory?: number;
  deductionsAmount?: number;
}

export interface MyDataSendResponse {
  documentId: string;
  status: string;
  mark?: string;
  classificationMark?: string;
  cancellationMark?: string;
  uid?: string;
  qrUrl?: string;
  environment?: string;
}

export interface TransmissionAttempt {
  id: string;
  documentId: string;
  provider: string;
  environment?: string | null;
  endpoint?: string | null;
  correlationId?: string | null;
  forcedRetry?: boolean;
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

    return this.http.get<DocumentListItem[]>(this.baseUrl, { params });
  }

  create(payload: DocumentPayload): Observable<DocumentListItem> {
    return this.http.post<DocumentListItem>(this.baseUrl, payload, {});
  }

  prepareMyData(documentId: string): Observable<MyDataPrepareResponse> {
    return this.http.post<MyDataPrepareResponse>(
      `${this.baseUrl}/${documentId}/mydata/prepare`,
      {},
      {},
    );
  }

  sendMockMyData(documentId: string, force = false): Observable<MyDataSendResponse> {
    return this.http.post<MyDataSendResponse>(
      `${this.baseUrl}/${documentId}/mydata/send-mock`,
      { force },
      {},
    );
  }

  sendTestMyData(documentId: string, force = false): Observable<MyDataSendResponse> {
    return this.http.post<MyDataSendResponse>(
      `${this.baseUrl}/${documentId}/mydata/send-test`,
      { force },
      {},
    );
  }

  cancelTestMyData(documentId: string): Observable<MyDataSendResponse> {
    return this.http.post<MyDataSendResponse>(
      `${this.baseUrl}/${documentId}/mydata/cancel-test`,
      {},
      {},
    );
  }

  prepareExpenseMyData(documentId: string): Observable<MyDataPrepareResponse> {
    return this.http.post<MyDataPrepareResponse>(
      `${this.baseUrl}/${documentId}/mydata/prepare-expense`,
      {},
      {},
    );
  }

  sendExpenseMockMyData(documentId: string): Observable<MyDataSendResponse> {
    return this.http.post<MyDataSendResponse>(
      `${this.baseUrl}/${documentId}/mydata/send-expense-mock`,
      {},
      {},
    );
  }

  sendExpenseTestMyData(documentId: string, force = false): Observable<MyDataSendResponse> {
    return this.http.post<MyDataSendResponse>(
      `${this.baseUrl}/${documentId}/mydata/send-expense-test`,
      { force },
      {},
    );
  }

  getMyDataHistory(documentId: string): Observable<TransmissionAttempt[]> {
    return this.http.get<TransmissionAttempt[]>(`${this.baseUrl}/${documentId}/mydata/history`, {});
  }
}
