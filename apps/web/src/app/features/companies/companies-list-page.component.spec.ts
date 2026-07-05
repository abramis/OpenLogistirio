import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CompaniesApiService } from '../../core/api/companies-api.service';
import { CompaniesListPageComponent } from './companies-list-page.component';

describe('CompaniesListPageComponent', () => {
  let fixture: ComponentFixture<CompaniesListPageComponent>;
  const companiesApi = {
    findAll: jasmine.createSpy('findAll').and.returnValue(
      of([
        {
          id: 'company-1',
          legalName: 'Demo Company',
          vatNumber: '123456789',
          fiscalYearStart: 1,
          fiscalYearEnd: 12,
          createdAt: '',
          updatedAt: '',
        },
      ]),
    ),
    delete: jasmine.createSpy('delete').and.returnValue(of(undefined)),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompaniesListPageComponent],
      providers: [provideRouter([]), { provide: CompaniesApiService, useValue: companiesApi }],
    }).compileComponents();

    fixture = TestBed.createComponent(CompaniesListPageComponent);
    fixture.detectChanges();
  });

  it('renders client companies', () => {
    expect(fixture.nativeElement.textContent).toContain('Demo Company');
    expect(fixture.nativeElement.textContent).toContain('123456789');
  });
});
