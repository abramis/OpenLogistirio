import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService, AuthSession, InitialSetupRequest } from './auth.service';

describe('AuthService initial setup', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigate']) },
      ],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('loads the public first-run status', () => {
    let result: { required: boolean; available: boolean } | undefined;
    service.getInitialSetupStatus().subscribe((value) => (result = value));

    const request = http.expectOne(`${environment.apiBaseUrl}/setup/status`);
    expect(request.request.method).toBe('GET');
    request.flush({ required: true, available: true });

    expect(result).toEqual({ required: true, available: true });
  });

  it('posts the setup token in the body and stores the returned session', () => {
    const payload: InitialSetupRequest = {
      setupToken: 'a'.repeat(48),
      officeName: 'Λογιστικό Γραφείο',
      officeVatNumber: '123456789',
      officeEmail: 'office@example.gr',
      officePhone: '2101234567',
      officeAddress: 'Αθήνα',
      adminFullName: 'Μαρία Παπαδοπούλου',
      adminEmail: 'maria@example.gr',
      adminPassword: 'Very-Str0ng-Setup-Key-2026!',
    };
    const session: AuthSession = {
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

    service.completeInitialSetup(payload).subscribe();

    const request = http.expectOne(`${environment.apiBaseUrl}/setup`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush(session);

    expect(service.user()).toEqual(session.user);
    expect(service.isAuthenticated()).toBeTrue();
    expect(localStorage.getItem('open-logistirio.accessToken')).toBe('access-token');
    expect(localStorage.getItem('open-logistirio.refreshToken')).toBe('refresh-token');
  });
});
