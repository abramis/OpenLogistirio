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
  salesVat: number;
  purchasesVat: number;
  payableVat: number;
  documents: number;
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

  vatSummary(year: number): Observable<VatSummaryRow[]> {
    return this.http.get<VatSummaryRow[]>(`${this.baseUrl}/vat-summary`, {
      headers: this.headers,
      params: { year },
    });
  }

  private get headers(): HttpHeaders {
    return new HttpHeaders({ 'x-office-id': 'office-athens-demo' });
  }
}
