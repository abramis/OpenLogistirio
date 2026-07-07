import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface AuditLogUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

export interface AuditLogEntry {
  id: string;
  accountingOfficeId: string;
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
  user: AuditLogUser | null;
}

export interface AuditLogQuery {
  action?: AuditAction | '';
  entityType?: string;
  entityId?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  take?: number;
}

@Injectable({ providedIn: 'root' })
export class AuditApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/audit`;

  findAll(query: AuditLogQuery = {}): Observable<AuditLogEntry[]> {
    const params: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        params[key] = value;
      }
    }

    return this.http.get<AuditLogEntry[]>(this.baseUrl, { params });
  }
}
