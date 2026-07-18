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
  replacesDocumentId?: string | null;
  correctsDocumentId?: string | null;
  lines?: DocumentLine[];
  payments?: DocumentPayment[];
  myDataStatus: string;
  myDataMark?: string | null;
  myDataUid?: string | null;
  myDataQrUrl?: string | null;
  myDataClassificationMark?: string | null;
  myDataCancellationMark?: string | null;
  myDataCancelledAt?: string | null;
  classificationStatus?: string | null;
  expenseClassificationApprovalStatus?:
    | 'NOT_REQUESTED'
    | 'PENDING'
    | 'APPROVED'
    | 'REJECTED'
    | 'CONSUMED';
  expenseClassificationApprovedAt?: string | null;
  expenseClassificationApprovalNotes?: string | null;
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

export interface DocumentLine {
  id?: string;
  lineNumber?: number;
  itemCode?: string;
  description?: string;
  quantity?: number;
  measurementUnit?: number;
  unitPrice?: number;
  discountAmount?: number;
  discountOption?: boolean;
  netAmount: number;
  vatAmount: number;
  vatCategory: string;
  vatExemptionCategory?: number;
  withheldAmount?: number;
  withheldCategory?: number;
  feesAmount?: number;
  feesCategory?: number;
  stampDutyAmount?: number;
  stampDutyCategory?: number;
  otherTaxesAmount?: number;
  otherTaxesCategory?: number;
  deductionsAmount?: number;
  incomeClassificationType?: string;
  incomeClassificationCategory?: string;
  expenseClassificationType?: string;
  expenseClassificationCategory?: string;
  vatClassificationType?: string;
}

export interface DocumentPayment {
  id?: string;
  paymentNumber?: number;
  type: number;
  amount: number;
  paymentMethodInfo?: string;
  transactionId?: string;
  tid?: string;
  providerSigningAuthor?: string;
  providerSignature?: string;
  ecrSigningAuthor?: string;
  ecrSessionNumber?: string;
}

export interface MyDataPrepareResponse {
  documentId: string;
  status: string;
  xml: string;
  preview?: ExpenseClassificationPreview;
}

export interface ExpenseClassificationPreview {
  documentId: string;
  invoiceMark?: string | null;
  totals: { netAmount: number; vatAmount: number; totalAmount: number };
  lines: Array<{
    lineNumber: number;
    description?: string | null;
    netAmount: number;
    vatAmount: number;
    vatCategory: string;
    expenseClassificationType: string;
    expenseClassificationCategory: string;
    vatClassificationType?: string | null;
  }>;
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
  lines?: DocumentLine[];
  payments?: DocumentPayment[];
  replacesDocumentId?: string;
  correctsDocumentId?: string;
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

  updateCounterparty(
    documentId: string,
    payload: { counterpartyName?: string; counterpartyVatNumber: string },
  ): Observable<DocumentListItem> {
    return this.http.patch<DocumentListItem>(
      `${this.baseUrl}/${documentId}/counterparty`,
      payload,
      {},
    );
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

  approveExpenseClassification(
    documentId: string,
    action: 'APPROVE' | 'REJECT',
    notes?: string,
  ): Observable<DocumentListItem> {
    return this.http.post<DocumentListItem>(
      this.baseUrl + '/' + documentId + '/mydata/expense-approval',
      { action, notes },
    );
  }

  approveExpenseClassificationBatch(
    documentIds: string[],
    action: 'APPROVE' | 'REJECT',
    notes?: string,
  ): Observable<{ count: number; status: string; documents: DocumentListItem[] }> {
    return this.http.post<{ count: number; status: string; documents: DocumentListItem[] }>(
      this.baseUrl + '/mydata/expense-approval/batch',
      { documentIds, action, notes },
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

  getCorrectionChain(documentId: string): Observable<DocumentCorrectionChainItem[]> {
    return this.http.get<DocumentCorrectionChainItem[]>(
      `${this.baseUrl}/${documentId}/correction-chain`,
      {},
    );
  }
}

export interface DocumentCorrectionChainItem {
  id: string;
  documentType: string;
  series?: string | null;
  documentNumber: string;
  issueDate: string;
  totalAmount: string | number;
  myDataStatus: string;
  myDataMark?: string | null;
  myDataCancellationMark?: string | null;
  replacesDocumentId?: string | null;
  correctsDocumentId?: string | null;
}
