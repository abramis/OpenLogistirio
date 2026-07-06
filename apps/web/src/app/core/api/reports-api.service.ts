import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface OfficeSummaryReport {
  clients: number;
  documents: number;
  openObligations: number;
  activeFixedAssets: number;
  failedMyData: number;
}

export interface VatSummaryRow {
  period: string;
  salesNet: number;
  salesVat: number;
  purchasesNet: number;
  purchasesVat: number;
  payableVat: number;
  documents: number;
  failedMyData: number;
}

@Injectable({ providedIn: 'root' })
export class ReportsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/reports`;

  officeSummary(): Observable<OfficeSummaryReport> {
    return this.http.get<OfficeSummaryReport>(`${this.baseUrl}/office-summary`, {
      headers: this.headers,
    });
  }

  vatSummary(year: number, clientCompanyId = ''): Observable<VatSummaryRow[]> {
    const params: Record<string, string | number> = { year };
    if (clientCompanyId) {
      params['clientCompanyId'] = clientCompanyId;
    }

    return this.http.get<VatSummaryRow[]>(`${this.baseUrl}/vat-summary`, {
      headers: this.headers,
      params,
    });
  }

  private get headers(): HttpHeaders {
    return new HttpHeaders({ 'x-office-id': 'office-athens-demo' });
  }
}
