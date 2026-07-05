import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface OfficeObligation {
  id: string;
  clientCompanyId: string;
  assignedUserId?: string | null;
  type: string;
  title: string;
  periodYear: number;
  periodMonth?: number | null;
  dueDate: string;
  status: string;
  recurrence: string;
  notes?: string | null;
  completedAt?: string | null;
  createdAt: string;
  clientCompany?: {
    id: string;
    legalName: string;
    vatNumber: string;
    accountingCategory?: string | null;
    vatRegime?: string | null;
  };
  assignedUser?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface ObligationPayload {
  clientCompanyId: string;
  type: string;
  title: string;
  periodYear: number;
  periodMonth?: number;
  dueDate: string;
  status?: string;
  recurrence?: string;
  notes?: string;
}

export interface ObligationFilters {
  clientCompanyId?: string;
  type?: string;
  status?: string;
  dueFrom?: string;
  dueTo?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ObligationsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/obligations`;

  findAll(filters: ObligationFilters = {}): Observable<OfficeObligation[]> {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
    );

    return this.http.get<OfficeObligation[]>(this.baseUrl, { headers: this.headers, params });
  }

  create(payload: ObligationPayload): Observable<OfficeObligation> {
    return this.http.post<OfficeObligation>(this.baseUrl, payload, { headers: this.headers });
  }

  update(id: string, payload: Partial<ObligationPayload>): Observable<OfficeObligation> {
    return this.http.patch<OfficeObligation>(`${this.baseUrl}/${id}`, payload, {
      headers: this.headers,
    });
  }

  complete(id: string): Observable<OfficeObligation> {
    return this.http.post<OfficeObligation>(
      `${this.baseUrl}/${id}/complete`,
      {},
      { headers: this.headers },
    );
  }

  generateMonthly(
    year: number,
    month: number,
  ): Observable<{ generated: number; obligations: OfficeObligation[] }> {
    return this.http.post<{ generated: number; obligations: OfficeObligation[] }>(
      `${this.baseUrl}/generate-monthly`,
      { year, month },
      { headers: this.headers },
    );
  }

  private get headers(): HttpHeaders {
    return new HttpHeaders({
      'x-office-id': 'office-athens-demo',
    });
  }
}
