import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { UserRole } from './user-roles';

export const authGuard: CanActivateFn = () => requireAuthentication();
export const authMatchGuard: CanMatchFn = () => requireAuthentication();
export const roleMatchGuard: CanMatchFn = (route) => {
  const authResult = requireAuthentication();
  if (authResult !== true) {
    return authResult;
  }

  const roles = route.data?.['roles'] as UserRole[] | undefined;
  if (!roles?.length || inject(AuthService).hasAnyRole(roles)) {
    return true;
  }

  return inject(Router).createUrlTree(['/']);
};

function requireAuthentication() {
  const authService = inject(AuthService);
  if (authService.isAuthenticated()) {
    return true;
  }

  return inject(Router).createUrlTree(['/login']);
}
