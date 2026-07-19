import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MyDataApiService } from '../core/api/mydata-api.service';
import { SystemApiService } from '../core/api/system-api.service';
import { AuthService } from '../core/auth/auth.service';
import { ShellComponent } from './shell.component';

describe('ShellComponent', () => {
  it('does not request protected shell metadata without an authenticated session', async () => {
    const auth = {
      isAuthenticated: () => false,
      user: () => null,
      hasAnyRole: () => false,
      logout: () => undefined,
    };
    const myDataApi = jasmine.createSpyObj<MyDataApiService>('MyDataApiService', ['environment']);
    const systemApi = jasmine.createSpyObj<SystemApiService>('SystemApiService', ['health']);
    systemApi.health.and.returnValue(
      of({ status: 'ok', service: 'open-logistirio-api', version: 'test', gitSha: 'test' }),
    );

    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: MyDataApiService, useValue: myDataApi },
        { provide: SystemApiService, useValue: systemApi },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();

    expect(myDataApi.environment).not.toHaveBeenCalled();
  });
});
