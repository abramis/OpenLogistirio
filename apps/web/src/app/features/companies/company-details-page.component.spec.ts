import { convertToParamMap } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CompaniesApiService } from '../../core/api/companies-api.service';
import { DocumentsApiService } from '../../core/api/documents-api.service';
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
    listSetupTemplates: jasmine.createSpy('listSetupTemplates').and.returnValue(
      of([
        {
          id: 'SIMPLE_BOOKS_ELP',
          name: 'Απλογραφικά - ΕΛΠ',
          description: 'Βασική παραμετροποίηση',
          recommendedFor: ['COMPANY'],
          itemCount: 2,
          kinds: [],
        },
      ]),
    ),
    findSetupItems: jasmine.createSpy('findSetupItems').and.returnValue(
      of([
        {
          id: 'setup-1',
          clientCompanyId: 'company-1',
          kind: 'JOURNAL',
          code: 'SALES',
          name: 'Ημερολόγιο πωλήσεων',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    ),
    applySetupTemplate: jasmine.createSpy('applySetupTemplate').and.returnValue(
      of({
        templateId: 'SIMPLE_BOOKS_ELP',
        appliedCount: 2,
        items: [],
      }),
    ),
  };
  const documentsApi = {
    findAll: jasmine.createSpy('findAll').and.returnValue(
      of([
        {
          id: 'document-1',
          documentType: 'SALES_INVOICE',
          series: 'A',
          documentNumber: '1',
          issueDate: '2026-07-01T00:00:00.000Z',
          counterpartyName: 'Demo Customer',
          movementCode: 'SALE_INVOICE',
          journalCode: 'SALES',
          netAmount: '100.00',
          vatAmount: '24.00',
          totalAmount: '124.00',
          vatCategory: 'VAT_24',
          myDataStatus: 'DRAFT',
          clientCompany: {
            id: 'company-1',
            legalName: 'Demo Company',
            vatNumber: '123456789',
          },
        },
      ]),
    ),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompanyDetailsPageComponent],
      providers: [
        provideRouter([]),
        { provide: CompaniesApiService, useValue: companiesApi },
        { provide: DocumentsApiService, useValue: documentsApi },
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
    expect(fixture.nativeElement.textContent).toContain('Παραμετροποίηση');
    expect(fixture.nativeElement.textContent).toContain('Κινήσεις / Βιβλία');
  });
});
