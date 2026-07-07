import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserRole } from '../auth/user-roles';

export interface OfficeUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  disabledAt: string | null;
  lockedUntil: string | null;
  failedLoginAttempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOfficeUserPayload {
  email: string;
  fullName: string;
  role: UserRole;
  password: string;
}

export interface UpdateOfficeUserPayload {
  fullName?: string;
  role?: UserRole;
}

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/users`;

  findAll(): Observable<OfficeUser[]> {
    return this.http.get<OfficeUser[]>(this.baseUrl, {});
  }

  create(payload: CreateOfficeUserPayload): Observable<OfficeUser> {
    return this.http.post<OfficeUser>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateOfficeUserPayload): Observable<OfficeUser> {
    return this.http.patch<OfficeUser>(`${this.baseUrl}/${id}`, payload);
  }

  disable(id: string): Observable<OfficeUser> {
    return this.http.post<OfficeUser>(`${this.baseUrl}/${id}/disable`, {});
  }

  enable(id: string): Observable<OfficeUser> {
    return this.http.post<OfficeUser>(`${this.baseUrl}/${id}/enable`, {});
  }
}
