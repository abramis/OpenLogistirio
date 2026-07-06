import { HttpClient, HttpHeaders } from '@angular/common/http';
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
  status: string;
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
  };
  generatedAt: string;
  clientCompany?: {
    id: string;
    legalName: string;
    vatNumber: string;
  };
}

@Injectable({ providedIn: 'root' })
export class DeclarationsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/declarations`;

  findWorkpapers(clientCompanyId = ''): Observable<DeclarationWorkpaper[]> {
    const params = clientCompanyId ? { clientCompanyId } : undefined;
    return this.http.get<DeclarationWorkpaper[]>(`${this.baseUrl}/workpapers`, {
      headers: this.headers,
      params,
    });
  }

  generateVatWorkpaper(payload: {
    clientCompanyId: string;
    year: number;
    month?: number;
  }): Observable<DeclarationWorkpaper> {
    return this.http.post<DeclarationWorkpaper>(`${this.baseUrl}/vat-workpaper/generate`, payload, {
      headers: this.headers,
    });
  }

  private get headers(): HttpHeaders {
    return new HttpHeaders({ 'x-office-id': 'office-athens-demo' });
  }
}
