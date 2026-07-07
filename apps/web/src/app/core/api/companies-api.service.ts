import { HttpClient } from '@angular/common/http';
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

export interface AadeRegistryCompanyLookup {
  vatNumber: string;
  legalName?: string;
  tradeName?: string;
  entityType?: string;
  professionLabel?: string;
  taxOffice?: string;
  activityCodes: string[];
  address?: string;
  vatRegime?: string;
  status?: string;
  registrationDate?: string;
  stopDate?: string;
}

export interface ClientSetupKindSummary {
  kind: string;
  label: string;
  count: number;
}

export interface ClientSetupTemplate {
  id: string;
  name: string;
  description: string;
  recommendedFor: string[];
  itemCount: number;
  kinds: ClientSetupKindSummary[];
}

export interface ClientSetupItem {
  id: string;
  clientCompanyId: string;
  kind: string;
  code: string;
  name: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  sourceTemplate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplyClientSetupResult {
  templateId: string;
  appliedCount: number;
  items: ClientSetupItem[];
}

@Injectable({
  providedIn: 'root',
})
export class CompaniesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/companies`;

  findAll(): Observable<ClientCompany[]> {
    return this.http.get<ClientCompany[]>(this.baseUrl, {});
  }

  findOne(id: string): Observable<ClientCompany> {
    return this.http.get<ClientCompany>(`${this.baseUrl}/${id}`, {});
  }

  create(payload: CompanyPayload): Observable<ClientCompany> {
    return this.http.post<ClientCompany>(this.baseUrl, payload, {});
  }

  lookupAadeRegistry(vatNumber: string): Observable<AadeRegistryCompanyLookup> {
    return this.http.post<AadeRegistryCompanyLookup>(
      `${this.baseUrl}/aade/lookup`,
      { vatNumber },
      {},
    );
  }

  listSetupTemplates(id: string): Observable<ClientSetupTemplate[]> {
    return this.http.get<ClientSetupTemplate[]>(`${this.baseUrl}/${id}/setup/templates`, {});
  }

  findSetupItems(id: string): Observable<ClientSetupItem[]> {
    return this.http.get<ClientSetupItem[]>(`${this.baseUrl}/${id}/setup`, {});
  }

  applySetupTemplate(id: string, templateId: string): Observable<ApplyClientSetupResult> {
    return this.http.post<ApplyClientSetupResult>(
      `${this.baseUrl}/${id}/setup/apply`,
      { templateId },
      {},
    );
  }

  update(id: string, payload: CompanyPayload): Observable<ClientCompany> {
    return this.http.patch<ClientCompany>(`${this.baseUrl}/${id}`, payload, {});
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, {});
  }
}
