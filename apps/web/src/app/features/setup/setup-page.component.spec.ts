import { NgForm } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService, AuthSession } from '../../core/auth/auth.service';
import { SetupPageComponent } from './setup-page.component';
import { readSetupToken } from './setup-token';

describe('SetupPageComponent', () => {
  const setupToken = 'a'.repeat(48);
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;
  let route: { snapshot: { fragment: string | null } };

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'getInitialSetupStatus',
      'completeInitialSetup',
    ]);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    route = { snapshot: { fragment: `token=${setupToken}` } };
    authService.getInitialSetupStatus.and.returnValue(of({ required: true, available: true }));

    await TestBed.configureTestingModule({
      imports: [SetupPageComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: route },
      ],
    }).compileComponents();
  });

  it('redirects to login when setup has already been completed', () => {
    authService.getInitialSetupStatus.and.returnValue(of({ required: false, available: true }));

    const fixture = TestBed.createComponent(SetupPageComponent);
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
    expect(authService.completeInitialSetup).not.toHaveBeenCalled();
  });

  it('submits the fragment token and stores the returned authenticated session', () => {
    const session = initialSession();
    authService.completeInitialSetup.and.returnValue(of(session));
    const fixture = TestBed.createComponent(SetupPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.officeName = '  Λογιστικό Γραφείο  ';
    component.officeVatNumber = '123456789';
    component.officeEmail = ' OFFICE@example.gr ';
    component.officePhone = ' 2101234567 ';
    component.officeAddress = ' Αθήνα ';
    component.adminFullName = ' Μαρία Παπαδοπούλου ';
    component.adminEmail = ' MARIA@example.gr ';
    component.adminPassword = 'Very-Str0ng-Setup-Key-2026!';
    component.confirmPassword = component.adminPassword;

    component.submit({ invalid: false } as NgForm);

    expect(authService.completeInitialSetup).toHaveBeenCalledWith({
      setupToken,
      officeName: 'Λογιστικό Γραφείο',
      officeVatNumber: '123456789',
      officeEmail: 'office@example.gr',
      officePhone: '2101234567',
      officeAddress: 'Αθήνα',
      adminFullName: 'Μαρία Παπαδοπούλου',
      adminEmail: 'maria@example.gr',
      adminPassword: 'Very-Str0ng-Setup-Key-2026!',
    });
    expect(router.navigate).toHaveBeenCalledWith(['/'], { replaceUrl: true });
  });

  it('does not show the form without a token in the URL fragment', () => {
    route.snapshot.fragment = null;
    const fixture = TestBed.createComponent(SetupPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.ready).toBeFalse();
    expect(fixture.componentInstance.blockingError).toContain('token');
  });
});

describe('readSetupToken', () => {
  it('reads only the token key from a URL fragment', () => {
    expect(readSetupToken('source=installer&token=abc-123_xyz')).toBe('abc-123_xyz');
    expect(readSetupToken(null)).toBeNull();
    expect(readSetupToken('other=abc')).toBeNull();
  });
});

function initialSession(): AuthSession {
  return {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    user: {
      id: 'user-1',
      email: 'maria@example.gr',
      fullName: 'Μαρία Παπαδοπούλου',
      role: 'ACCOUNTING_OFFICE_ADMIN',
      accountingOffice: { id: 'office-1', name: 'Λογιστικό Γραφείο' },
    },
  };
}
