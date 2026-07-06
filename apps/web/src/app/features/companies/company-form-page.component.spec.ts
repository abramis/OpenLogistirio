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
    lookupAadeRegistry: jasmine.createSpy('lookupAadeRegistry').and.returnValue(
      of({
        vatNumber: '123456789',
        legalName: 'Demo Company',
        activityCodes: ['69200000'],
      }),
    ),
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
    expect(component.form.controls.vatNumber.hasError('required')).toBeTrue();
  });

  it('fills basic company fields from an AADE registry lookup', () => {
    const component = fixture.componentInstance;
    component.form.patchValue({ vatNumber: '123456789' });

    component.lookupAadeRegistry();

    expect(companiesApi.lookupAadeRegistry).toHaveBeenCalledWith('123456789');
    expect(component.form.controls.legalName.value).toBe('Demo Company');
    expect(component.form.controls.activityCodesText.value).toBe('69200000');
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
