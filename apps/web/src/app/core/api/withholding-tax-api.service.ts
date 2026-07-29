import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type WithholdingTaxCategory =
  | 'BUSINESS_ACTIVITY'
  | 'DIVIDENDS'
  | 'INTEREST'
  | 'ROYALTIES';

export interface WithholdingTaxLine {
  id: string;
  beneficiaryVatNumber?: string | null;
  beneficiaryLastName: string;
  beneficiaryFirstName?: string | null;
  beneficiaryFatherName?: string | null;
  beneficiarySocialSecurity?: string | null;
  foreignWithoutGreekVat: boolean;
  countryCode?: string | null;
  incomeCode: string;
  paymentDate: string;
  grossAmount: string | number;
  deductionsAmount: string | number;
  netAmount: string | number;
  withholdingRate: string | number;
  assessedTaxAmount: string | number;
  withheldTaxAmount: string | number;
  digitalFeeRate: string | number;
  digitalFeeAmount: string | number;
  digitalFeeOgaAmount: string | number;
  exemptionLawArticle?: string | null;
  exemptionLawNumber?: string | null;
  exemptionLawYear?: string | null;
  notes?: string | null;
}

export interface WithholdingTaxReturn {
  id: string;
  clientCompanyId: string;
  periodYear: number;
  periodMonth: number;
  category: WithholdingTaxCategory;
  returnType: 'INITIAL' | 'AMENDING';
  revision: number;
  status: 'DRAFT' | 'READY' | 'APPROVED' | 'SUBMITTED';
  submissionDeadline: string;
  declarantName: string;
  declarantFirstName?: string | null;
  declarantFatherName?: string | null;
  declarantIsLegalEntity: boolean;
  declarantVatNumber: string;
  businessActivity: string;
  city: string;
  street: string;
  streetNumber: string;
  postalCode: string;
  grossAmount: string | number;
  deductionsAmount: string | number;
  netAmount: string | number;
  assessedTaxAmount: string | number;
  withheldTaxAmount: string | number;
  digitalFeeAmount: string | number;
  digitalFeeOgaAmount: string | number;
  payableAmount: string | number;
  approvedAt?: string | null;
  fileGeneratedAt?: string | null;
  fileProtocol?: string | null;
  submittedAt?: string | null;
  submissionReference?: string | null;
  debtId?: string | null;
  lateSubmission?: boolean | null;
  paidAt?: string | null;
  paymentReference?: string | null;
  latePayment?: boolean | null;
  notes?: string | null;
  lines: WithholdingTaxLine[];
  clientCompany: { id: string; legalName: string; vatNumber: string };
  approvedBy?: { id: string; fullName: string } | null;
}

export interface WithholdingTaxLinePayload {
  beneficiaryVatNumber?: string;
  beneficiaryLastName: string;
  beneficiaryFirstName?: string;
  beneficiaryFatherName?: string;
  beneficiarySocialSecurity?: string;
  foreignWithoutGreekVat?: boolean;
  countryCode?: string;
  incomeCode: string;
  paymentDate: string;
  grossAmount: number;
  deductionsAmount?: number;
  withholdingRate?: number;
  withheldTaxAmount?: number;
  digitalFeeRate?: number;
  digitalFeeOgaAmount?: number;
  exemptionLawArticle?: string;
  exemptionLawNumber?: string;
  exemptionLawYear?: string;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class WithholdingTaxApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/withholding-tax`;

  findAll(
    clientCompanyId = '',
    periodYear?: number,
    periodMonth?: number,
  ): Observable<WithholdingTaxReturn[]> {
    const params: Record<string, string> = {};
    if (clientCompanyId) params['clientCompanyId'] = clientCompanyId;
    if (periodYear) params['periodYear'] = String(periodYear);
    if (periodMonth) params['periodMonth'] = String(periodMonth);
    return this.http.get<WithholdingTaxReturn[]>(this.baseUrl, { params });
  }

  generate(payload: Record<string, unknown>): Observable<WithholdingTaxReturn> {
    return this.http.post<WithholdingTaxReturn>(`${this.baseUrl}/generate`, payload);
  }

  update(id: string, payload: Record<string, unknown>): Observable<WithholdingTaxReturn> {
    return this.http.patch<WithholdingTaxReturn>(`${this.baseUrl}/${id}`, payload);
  }

  addLine(id: string, payload: WithholdingTaxLinePayload): Observable<WithholdingTaxReturn> {
    return this.http.post<WithholdingTaxReturn>(`${this.baseUrl}/${id}/lines`, payload);
  }

  updateLine(
    id: string,
    lineId: string,
    payload: WithholdingTaxLinePayload,
  ): Observable<WithholdingTaxReturn> {
    return this.http.patch<WithholdingTaxReturn>(
      `${this.baseUrl}/${id}/lines/${lineId}`,
      payload,
    );
  }

  deleteLine(id: string, lineId: string): Observable<WithholdingTaxReturn> {
    return this.http.delete<WithholdingTaxReturn>(`${this.baseUrl}/${id}/lines/${lineId}`);
  }

  transition(
    id: string,
    action: 'ready' | 'approve' | 'reopen',
  ): Observable<WithholdingTaxReturn> {
    return this.http.post<WithholdingTaxReturn>(`${this.baseUrl}/${id}/${action}`, {});
  }

  downloadAadeFile(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/aade-file`, { responseType: 'blob' });
  }

  submit(
    id: string,
    payload: {
      fileProtocol: string;
      submissionReference: string;
      submittedAt: string;
      payableAmount: number;
      debtId?: string;
    },
  ): Observable<WithholdingTaxReturn> {
    return this.http.post<WithholdingTaxReturn>(`${this.baseUrl}/${id}/submit`, payload);
  }

  pay(
    id: string,
    paidAt: string,
    paymentReference: string,
  ): Observable<WithholdingTaxReturn> {
    return this.http.post<WithholdingTaxReturn>(`${this.baseUrl}/${id}/pay`, {
      paidAt,
      paymentReference,
    });
  }
}
