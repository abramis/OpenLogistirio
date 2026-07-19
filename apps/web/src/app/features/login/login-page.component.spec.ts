import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { LoginPageComponent } from './login-page.component';

describe('LoginPageComponent first-run redirect', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;
  let route: { snapshot: { fragment: string | null } };

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'getInitialSetupStatus',
      'login',
      'requestPasswordReset',
      'confirmPasswordReset',
    ]);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    route = { snapshot: { fragment: null } };

    await TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: route },
      ],
    }).compileComponents();
  });

  it('does not query setup status when no fragment token is present', () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();

    expect(authService.getInitialSetupStatus).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('redirects an uninitialized installation only when the fragment contains a token', () => {
    route.snapshot.fragment = 'token=installer-token';
    authService.getInitialSetupStatus.and.returnValue(of({ required: true, available: true }));

    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();

    expect(authService.getInitialSetupStatus).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/setup'], {
      fragment: 'token=installer-token',
      replaceUrl: true,
    });
  });
});
