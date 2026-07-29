import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AnnualTaxChecklist {
  booksReconciled: boolean;
  myDataReviewed: boolean;
  depreciationsReviewed: boolean;
  inventoryReviewed: boolean;
  taxAdjustmentsReviewed: boolean;
  formsReviewed: boolean;
}

export interface AnnualTaxInstallment {
  id: string;
  installmentNumber: number;
  dueDate: string;
  amount: string | number;
  paidAt?: string | null;
  paymentReference?: string | null;
  latePayment?: boolean | null;
  notes?: string | null;
}

export interface AnnualTaxReturn {
  id: string;
  clientCompanyId: string;
  fiscalYear: number;
  kind: 'INDIVIDUAL_E1' | 'LEGAL_ENTITY_N';
  returnType: 'INITIAL' | 'AMENDING';
  revision: number;
  status: 'DRAFT' | 'READY' | 'APPROVED' | 'SUBMITTED';
  includesE2: boolean;
  includesE3: boolean;
  submissionDeadline: string;
  bookRevenue: string | number;
  bookExpenses: string | number;
  accountingResult: string | number;
  myDataRevenue: string | number;
  myDataExpenses: string | number;
  nonDeductibleExpenses: string | number;
  taxExemptIncome: string | number;
  otherTaxAdditions: string | number;
  otherTaxDeductions: string | number;
  priorTaxLosses: string | number;
  taxableResult: string | number;
  unpostedDocumentCount: number;
  unresolvedMyDataCount: number;
  openPeriodCount: number;
  missingPeriodCount: number;
  unpostedDepreciationCount: number;
  checklist: AnnualTaxChecklist;
  adjustmentNotes?: string | null;
  approvedAt?: string | null;
  submittedAt?: string | null;
  submissionReference?: string | null;
  lateSubmission?: boolean | null;
  assessmentReference?: string | null;
  debtId?: string | null;
  assessedIncomeTax: string | number;
  taxPrepayment: string | number;
  otherAssessedAmounts: string | number;
  totalPayable: string | number;
  refundAmount: string | number;
  submissionNotes?: string | null;
  installments: AnnualTaxInstallment[];
  clientCompany: {
    id: string;
    legalName: string;
    vatNumber: string;
    entityType: string;
  };
  approvedBy?: { id: string; fullName: string } | null;
}

export interface AnnualTaxUpdatePayload {
  includesE2: boolean;
  includesE3: boolean;
  submissionDeadline: string;
  nonDeductibleExpenses: number;
  taxExemptIncome: number;
  otherTaxAdditions: number;
  otherTaxDeductions: number;
  priorTaxLosses: number;
  checklist: AnnualTaxChecklist;
  adjustmentNotes?: string;
}

export interface AnnualTaxSubmissionPayload {
  submissionReference: string;
  submittedAt: string;
  assessmentReference: string;
  debtId?: string;
  assessedIncomeTax: number;
  taxPrepayment: number;
  otherAssessedAmounts: number;
  totalPayable: number;
  refundAmount: number;
  installments: Array<{
    installmentNumber: number;
    dueDate: string;
    amount: number;
  }>;
  submissionNotes?: string;
}

@Injectable({ providedIn: 'root' })
export class AnnualTaxApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/annual-tax`;

  findAll(clientCompanyId = '', fiscalYear?: number): Observable<AnnualTaxReturn[]> {
    const params: Record<string, string> = {};
    if (clientCompanyId) params['clientCompanyId'] = clientCompanyId;
    if (fiscalYear) params['fiscalYear'] = String(fiscalYear);
    return this.http.get<AnnualTaxReturn[]>(this.baseUrl, { params });
  }

  generate(
    clientCompanyId: string,
    fiscalYear: number,
    createAmending = false,
  ): Observable<AnnualTaxReturn> {
    return this.http.post<AnnualTaxReturn>(`${this.baseUrl}/generate`, {
      clientCompanyId,
      fiscalYear,
      createAmending,
    });
  }

  update(id: string, payload: AnnualTaxUpdatePayload): Observable<AnnualTaxReturn> {
    return this.http.patch<AnnualTaxReturn>(`${this.baseUrl}/${id}`, payload, {});
  }

  markReady(id: string): Observable<AnnualTaxReturn> {
    return this.http.post<AnnualTaxReturn>(`${this.baseUrl}/${id}/ready`, {}, {});
  }

  approve(id: string): Observable<AnnualTaxReturn> {
    return this.http.post<AnnualTaxReturn>(`${this.baseUrl}/${id}/approve`, {}, {});
  }

  reopen(id: string): Observable<AnnualTaxReturn> {
    return this.http.post<AnnualTaxReturn>(`${this.baseUrl}/${id}/reopen`, {}, {});
  }

  submit(id: string, payload: AnnualTaxSubmissionPayload): Observable<AnnualTaxReturn> {
    return this.http.post<AnnualTaxReturn>(`${this.baseUrl}/${id}/submit`, payload, {});
  }

  payInstallment(
    installmentId: string,
    paidAt: string,
    paymentReference: string,
  ): Observable<AnnualTaxInstallment> {
    return this.http.post<AnnualTaxInstallment>(
      `${this.baseUrl}/installments/${installmentId}/pay`,
      { paidAt, paymentReference },
      {},
    );
  }
}
