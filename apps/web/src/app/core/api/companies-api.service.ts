import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ClientCompany {
  id: string;
  legalName: string;
  tradeName?: string | null;
  entityType: string;
  professionLabel?: string | null;
  vatNumber: string;
  taxOffice?: string | null;
  activityCodes?: string[] | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  vatRegime?: string | null;
  accountingCategory?: string | null;
  myDataMode: string;
  myDataAuthorized: boolean;
  myDataCredentialRef?: string | null;
  fiscalYearStart: number;
  fiscalYearEnd: number;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyPayload {
  legalName: string;
  tradeName?: string;
  entityType?: string;
  professionLabel?: string;
  vatNumber: string;
  taxOffice?: string;
  activityCodes?: string[];
  address?: string;
  email?: string;
  phone?: string;
  vatRegime?: string;
  accountingCategory?: string;
  myDataMode?: string;
  myDataAuthorized?: boolean;
  myDataCredentialRef?: string;
  fiscalYearStart?: number;
  fiscalYearEnd?: number;
}

@Injectable({
  providedIn: 'root',
})
export class CompaniesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/companies`;

  findAll(): Observable<ClientCompany[]> {
    return this.http.get<ClientCompany[]>(this.baseUrl, { headers: this.headers });
  }

  findOne(id: string): Observable<ClientCompany> {
    return this.http.get<ClientCompany>(`${this.baseUrl}/${id}`, { headers: this.headers });
  }

  create(payload: CompanyPayload): Observable<ClientCompany> {
    return this.http.post<ClientCompany>(this.baseUrl, payload, { headers: this.headers });
  }

  update(id: string, payload: CompanyPayload): Observable<ClientCompany> {
    return this.http.patch<ClientCompany>(`${this.baseUrl}/${id}`, payload, {
      headers: this.headers,
    });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { headers: this.headers });
  }

  private get headers(): HttpHeaders {
    return new HttpHeaders({
      'x-office-id': 'office-athens-demo',
    });
  }
}
