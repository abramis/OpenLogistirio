import { convertToParamMap } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CompaniesApiService } from '../../core/api/companies-api.service';
import { CompanyDetailsPageComponent } from './company-details-page.component';

describe('CompanyDetailsPageComponent', () => {
  let fixture: ComponentFixture<CompanyDetailsPageComponent>;
  const companiesApi = {
    findOne: jasmine.createSpy('findOne').and.returnValue(
      of({
        id: 'company-1',
        legalName: 'Demo Company',
        tradeName: 'Demo',
        vatNumber: '123456789',
        taxOffice: 'Α Αθηνών',
        activityCodes: ['69200000'],
        fiscalYearStart: 1,
        fiscalYearEnd: 12,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    ),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompanyDetailsPageComponent],
      providers: [
        provideRouter([]),
        { provide: CompaniesApiService, useValue: companiesApi },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: 'company-1' })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CompanyDetailsPageComponent);
    fixture.detectChanges();
  });

  it('renders company details', () => {
    expect(fixture.nativeElement.textContent).toContain('Demo Company');
    expect(fixture.nativeElement.textContent).toContain('Α Αθηνών');
  });
});
