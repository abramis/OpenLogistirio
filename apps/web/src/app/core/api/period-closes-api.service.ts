import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PeriodCloseCheck {
  code: string;
  label: string;
  completed: boolean;
  automatic: boolean;
  blocking: boolean;
  details: string;
}

export interface PeriodCloseReview {
  id: string;
  clientCompanyId: string;
  kind: 'MONTHLY' | 'QUARTERLY';
  periodYear: number;
  startMonth: number;
  endMonth: number;
  status: 'DRAFT' | 'READY_FOR_REVIEW' | 'APPROVED' | 'REJECTED';
  checklist: PeriodCloseCheck[];
  reviewSummary: {
    documentCount: number;
    unpostedDocuments: number;
    journalEntryCount: number;
    journalDifference: number;
    failedMyDataDocuments: number;
    unresolvedMyDataDocuments: number;
    myDataSnapshotCount: number;
    reconciliationMismatches: number;
    vatDelta: {
      salesNet: number;
      salesVat: number;
      purchasesNet: number;
      purchasesVat: number;
    };
  };
  rejectionReason?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  clientCompany?: { id: string; legalName: string; vatNumber: string };
  preparedBy?: { id: string; fullName: string } | null;
  approvedBy?: { id: string; fullName: string } | null;
}

@Injectable({ providedIn: 'root' })
export class PeriodClosesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/period-closes`;

  findAll(): Observable<PeriodCloseReview[]> {
    return this.http.get<PeriodCloseReview[]>(this.baseUrl);
  }

  generate(payload: {
    clientCompanyId: string;
    year: number;
    kind: 'MONTHLY' | 'QUARTERLY';
    endMonth: number;
  }): Observable<PeriodCloseReview> {
    return this.http.post<PeriodCloseReview>(`${this.baseUrl}/generate`, payload, {});
  }

  updateChecklist(
    id: string,
    payload: { code: string; completed: boolean },
  ): Observable<PeriodCloseReview> {
    return this.http.patch<PeriodCloseReview>(`${this.baseUrl}/${id}/checklist`, payload, {});
  }

  submit(id: string): Observable<PeriodCloseReview> {
    return this.http.post<PeriodCloseReview>(`${this.baseUrl}/${id}/submit`, {}, {});
  }

  approve(id: string): Observable<PeriodCloseReview> {
    return this.http.post<PeriodCloseReview>(`${this.baseUrl}/${id}/approve`, {}, {});
  }

  reject(id: string, reason: string): Observable<PeriodCloseReview> {
    return this.http.post<PeriodCloseReview>(`${this.baseUrl}/${id}/reject`, { reason }, {});
  }
}
