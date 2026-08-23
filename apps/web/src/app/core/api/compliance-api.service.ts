import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ComplianceReturn {
  id: string;
  clientCompanyId: string;
  clientCompany: { legalName: string; vatNumber: string };
  fiscalYear?: number;
  periodYear?: number;
  periodMonth?: number;
  kind?: string;
  flow?: string;
  returnType: string;
  revision: number;
  status: string;
  blockerCount?: number;
  declaredAmount?: number;
  submissionProtocol?: string | null;
  lines: unknown[];
}

export interface CollectiveAgreement {
  id: string;
  code: string;
  title: string;
  mandatory: boolean;
  versions?: Array<{ id: string; versionLabel: string }>;
}

@Injectable({ providedIn: 'root' })
export class ComplianceApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  annual(companyId = ''): Observable<ComplianceReturn[]> {
    return this.http.get<ComplianceReturn[]>(`${this.base}/annual-certificates`, {
      params: companyId ? { clientCompanyId: companyId } : {},
    });
  }
  generateAnnual(payload: Record<string, unknown>) {
    return this.http.post<ComplianceReturn>(`${this.base}/annual-certificates/generate`, payload);
  }
  vies(companyId = ''): Observable<ComplianceReturn[]> {
    return this.http.get<ComplianceReturn[]>(`${this.base}/eu-compliance/vies`, {
      params: companyId ? { clientCompanyId: companyId } : {},
    });
  }
  generateVies(payload: Record<string, unknown>) {
    return this.http.post<ComplianceReturn>(`${this.base}/eu-compliance/vies/generate`, payload);
  }
  intrastat(companyId = ''): Observable<ComplianceReturn[]> {
    return this.http.get<ComplianceReturn[]>(`${this.base}/eu-compliance/intrastat`, {
      params: companyId ? { clientCompanyId: companyId } : {},
    });
  }
  generateIntrastat(payload: Record<string, unknown>) {
    return this.http.post<ComplianceReturn>(
      `${this.base}/eu-compliance/intrastat/generate`,
      payload,
    );
  }
  agreements(companyId = ''): Observable<CollectiveAgreement[]> {
    return this.http.get<CollectiveAgreement[]>(`${this.base}/collective-agreements`, {
      params: companyId ? { clientCompanyId: companyId } : {},
    });
  }
  createAgreement(payload: Record<string, unknown>): Observable<CollectiveAgreement> {
    return this.http.post<CollectiveAgreement>(`${this.base}/collective-agreements`, payload);
  }
  addAgreementVersion(
    id: string,
    payload: Record<string, unknown>,
  ): Observable<CollectiveAgreement> {
    return this.http.post<CollectiveAgreement>(
      `${this.base}/collective-agreements/${id}/versions`,
      payload,
    );
  }
  ready(type: 'annual' | 'vies' | 'intrastat', id: string) {
    const path = type === 'annual' ? 'annual-certificates' : `eu-compliance/${type}`;
    return this.http.post<ComplianceReturn>(`${this.base}/${path}/${id}/ready`, {});
  }
  submit(type: 'annual' | 'vies' | 'intrastat', id: string, protocol: string) {
    const path = type === 'annual' ? 'annual-certificates' : `eu-compliance/${type}`;
    return this.http.post<ComplianceReturn>(`${this.base}/${path}/${id}/submit`, {
      submittedAt: new Date().toISOString(),
      submissionProtocol: protocol,
    });
  }
  lock(type: 'annual' | 'vies' | 'intrastat', id: string) {
    const path = type === 'annual' ? 'annual-certificates' : `eu-compliance/${type}`;
    return this.http.post<ComplianceReturn>(`${this.base}/${path}/${id}/lock`, {});
  }
  file(type: 'annual' | 'vies' | 'intrastat', id: string): Observable<Blob> {
    const path = type === 'annual' ? 'annual-certificates' : `eu-compliance/${type}`;
    return this.http.get(`${this.base}/${path}/${id}/file`, { responseType: 'blob' });
  }
}
