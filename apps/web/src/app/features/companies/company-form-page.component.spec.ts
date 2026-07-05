import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CompaniesApiService } from '../../core/api/companies-api.service';
import { CompanyFormPageComponent } from './company-form-page.component';

describe('CompanyFormPageComponent', () => {
  let fixture: ComponentFixture<CompanyFormPageComponent>;
  const companiesApi = {
    findOne: jasmine.createSpy('findOne'),
    create: jasmine.createSpy('create').and.returnValue(
      of({
        id: 'company-1',
        legalName: 'Demo Company',
        vatNumber: '123456789',
      }),
    ),
    update: jasmine.createSpy('update'),
  };
  const router = {
    navigate: jasmine.createSpy('navigate').and.resolveTo(true),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompanyFormPageComponent],
      providers: [
        provideRouter([]),
        { provide: CompaniesApiService, useValue: companiesApi },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => null,
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CompanyFormPageComponent);
    fixture.detectChanges();
  });

  it('shows Greek validation messages', () => {
    const component = fixture.componentInstance;

    component.submit();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Η επωνυμία είναι υποχρεωτική.');
    expect(fixture.nativeElement.textContent).toContain('Το ΑΦΜ είναι υποχρεωτικό.');
  });

  it('creates a company when the form is valid', () => {
    const component = fixture.componentInstance;
    component.form.patchValue({
      legalName: 'Demo Company',
      vatNumber: '123456789',
    });

    component.submit();

    expect(companiesApi.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
        legalName: 'Demo Company',
        vatNumber: '123456789',
      }),
    );
    expect(router.navigate).toHaveBeenCalledWith(['/companies', 'company-1']);
  });
});
