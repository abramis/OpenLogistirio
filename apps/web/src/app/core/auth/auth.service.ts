import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, finalize, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserRole } from './user-roles';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  accountingOffice: {
    id: string;
    name: string;
  };
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface PasswordResetRequestResult {
  accepted: boolean;
  resetToken?: string;
}

export interface InitialSetupStatus {
  required: boolean;
  available: boolean;
}

export interface InitialSetupRequest {
  setupToken: string;
  officeName: string;
  officeVatNumber?: string;
  officeEmail?: string;
  officePhone?: string;
  officeAddress?: string;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
}

const ACCESS_TOKEN_KEY = 'open-logistirio.accessToken';
const REFRESH_TOKEN_KEY = 'open-logistirio.refreshToken';
const USER_KEY = 'open-logistirio.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly userSignal = signal<AuthUser | null>(readStoredUser());
  private refreshRequest$: Observable<AuthSession> | null = null;
  readonly user = this.userSignal.asReadonly();
  readonly isAuthenticated = computed(() => Boolean(this.accessToken && this.userSignal()));

  login(email: string, password: string) {
    return this.http
      .post<AuthSession>(`${environment.apiBaseUrl}/auth/login`, { email, password })
      .pipe(tap((session) => this.storeSession(session)));
  }

  getInitialSetupStatus(): Observable<InitialSetupStatus> {
    return this.http.get<InitialSetupStatus>(`${environment.apiBaseUrl}/setup/status`);
  }

  completeInitialSetup(request: InitialSetupRequest): Observable<AuthSession> {
    return this.http
      .post<AuthSession>(`${environment.apiBaseUrl}/setup`, request)
      .pipe(tap((session) => this.storeSession(session)));
  }

  requestPasswordReset(email: string): Observable<PasswordResetRequestResult> {
    return this.http.post<PasswordResetRequestResult>(
      `${environment.apiBaseUrl}/auth/password-reset/request`,
      { email },
    );
  }

  confirmPasswordReset(token: string, newPassword: string): Observable<{ reset: boolean }> {
    return this.http.post<{ reset: boolean }>(
      `${environment.apiBaseUrl}/auth/password-reset/confirm`,
      {
        token,
        newPassword,
      },
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ changed: boolean }> {
    return this.http.post<{ changed: boolean }>(`${environment.apiBaseUrl}/auth/password`, {
      currentPassword,
      newPassword,
    });
  }

  refreshSession(): Observable<AuthSession> {
    const refreshToken = this.refreshToken;
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token is available.'));
    }

    if (!this.refreshRequest$) {
      this.refreshRequest$ = this.http
        .post<AuthSession>(`${environment.apiBaseUrl}/auth/refresh`, { refreshToken })
        .pipe(
          tap((session) => this.storeSession(session)),
          shareReplay({ bufferSize: 1, refCount: false }),
          finalize(() => {
            this.refreshRequest$ = null;
          }),
        );
    }

    return this.refreshRequest$;
  }

  logout(): void {
    const refreshToken = this.refreshToken;
    if (refreshToken) {
      this.http
        .post(`${environment.apiBaseUrl}/auth/logout`, { refreshToken })
        .subscribe({ error: () => undefined });
    }

    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.userSignal.set(null);
    void this.router.navigate(['/login']);
  }

  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  get refreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  hasAnyRole(roles: UserRole[]): boolean {
    const role = this.userSignal()?.role;
    return Boolean(role && roles.includes(role));
  }

  private storeSession(session: AuthSession): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
    this.userSignal.set(session.user);
  }
}

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}
