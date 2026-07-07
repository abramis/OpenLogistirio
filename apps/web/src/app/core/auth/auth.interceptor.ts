import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const authenticatedRequest = withBearerToken(request, authService.accessToken);

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      if (
        isAuthRequest(request) ||
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        !authService.refreshToken
      ) {
        return throwError(() => error);
      }

      return authService.refreshSession().pipe(
        switchMap((session) => next(withBearerToken(request, session.accessToken))),
        catchError((refreshError: unknown) => {
          authService.logout();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};

function withBearerToken(request: HttpRequest<unknown>, token: string | null) {
  if (!token) {
    return request;
  }

  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}

function isAuthRequest(request: HttpRequest<unknown>): boolean {
  return (
    request.url.includes('/auth/login') ||
    request.url.includes('/auth/refresh') ||
    request.url.includes('/auth/logout') ||
    request.url.includes('/auth/password-reset/')
  );
}
