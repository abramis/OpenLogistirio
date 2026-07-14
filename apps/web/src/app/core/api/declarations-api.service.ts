import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DeclarationWorkpaper {
  id: string;
  clientCompanyId: string;
  type: string;
  title: string;
  periodYear: number;
  periodMonth?: number | null;
  periodKind: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  periodStartMonth: number;
  periodEndMonth: number;
  periodCloseReviewId?: string | null;
  status: string;
  notes?: string | null;
  submittedAt?: string | null;
  submissionReference?: string | null;
  submissionDate?: string | null;
  submissionAttachments?: DeclarationAttachment[] | null;
  totals: {
    salesNet?: number;
    salesVat?: number;
    purchasesNet?: number;
    purchasesVat?: number;
    payableVat?: number;
    documentCount?: number;
    failedMyData?: number;
    vatBreakdown?: Array<{
      vatCategory: string;
      salesNet: number;
      salesVat: number;
      purchasesNet: number;
      purchasesVat: number;
      payableVat: number;
      documents: number;
    }>;
    documentTypeBreakdown?: Array<{
      documentType: string;
      net: number;
      vat: number;
      total: number;
      documents: number;
    }>;
    myDataReconciliation?: {
      snapshotCount: number;
      mismatches: number;
      erpSalesNet: number;
      erpSalesVat: number;
      erpPurchasesNet: number;
      erpPurchasesVat: number;
      aadeSalesNet: number;
      aadeSalesVat: number;
      aadePurchasesNet: number;
      aadePurchasesVat: number;
      salesNetDelta: number;
      salesVatDelta: number;
      purchasesNetDelta: number;
      purchasesVatDelta: number;
    };
  };
  generatedAt: string;
  clientCompany?: {
    id: string;
    legalName: string;
    vatNumber: string;
  };
}

export interface DeclarationAttachment {
  name: string;
  url: string;
}

@Injectable({ providedIn: 'root' })
export class DeclarationsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/declarations`;

  findWorkpapers(clientCompanyId = ''): Observable<DeclarationWorkpaper[]> {
    const params = clientCompanyId ? { clientCompanyId } : undefined;
    return this.http.get<DeclarationWorkpaper[]>(`${this.baseUrl}/workpapers`, {
      params,
    });
  }

  generateVatWorkpaper(payload: {
    clientCompanyId: string;
    year: number;
    month?: number;
    periodKind?: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  }): Observable<DeclarationWorkpaper> {
    return this.http.post<DeclarationWorkpaper>(
      `${this.baseUrl}/vat-workpaper/generate`,
      payload,
      {},
    );
  }

  markReady(id: string): Observable<DeclarationWorkpaper> {
    return this.http.post<DeclarationWorkpaper>(`${this.baseUrl}/workpapers/${id}/ready`, {}, {});
  }

  approve(id: string): Observable<DeclarationWorkpaper> {
    return this.http.post<DeclarationWorkpaper>(`${this.baseUrl}/workpapers/${id}/approve`, {}, {});
  }

  submit(
    id: string,
    payload: {
      submissionReference: string;
      submissionDate: string;
      attachments?: DeclarationAttachment[];
      notes?: string;
    },
  ): Observable<DeclarationWorkpaper> {
    return this.http.post<DeclarationWorkpaper>(
      `${this.baseUrl}/workpapers/${id}/submit`,
      payload,
      {},
    );
  }

  archive(id: string): Observable<DeclarationWorkpaper> {
    return this.http.post<DeclarationWorkpaper>(`${this.baseUrl}/workpapers/${id}/archive`, {}, {});
  }
}
