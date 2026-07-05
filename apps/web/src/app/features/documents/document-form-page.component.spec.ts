import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CompaniesApiService } from '../../core/api/companies-api.service';
import { DocumentsApiService } from '../../core/api/documents-api.service';
import { DocumentFormPageComponent } from './document-form-page.component';

describe('DocumentFormPageComponent', () => {
  let fixture: ComponentFixture<DocumentFormPageComponent>;
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
  };
  const documentsApi = {
    create: jasmine.createSpy('create').and.returnValue(
      of({
        id: 'document-1',
        documentNumber: '1001',
      }),
    ),
  };
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentFormPageComponent],
      providers: [
        provideRouter([]),
        { provide: CompaniesApiService, useValue: companiesApi },
        { provide: DocumentsApiService, useValue: documentsApi },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(DocumentFormPageComponent);
    fixture.detectChanges();
  });

  it('creates a sales invoice document', () => {
    const component = fixture.componentInstance;
    component.form.patchValue({
      clientCompanyId: 'company-1',
      documentType: 'SALES_INVOICE',
      documentNumber: '1001',
      issueDate: '2026-07-05',
      counterpartyName: 'Customer SA',
      counterpartyVatNumber: '987654321',
      netAmount: 100,
      vatAmount: 24,
      totalAmount: 124,
      vatCategory: 'VAT_24',
    });

    component.submit();

    expect(documentsApi.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
        clientCompanyId: 'company-1',
        documentType: 'SALES_INVOICE',
        documentNumber: '1001',
      }),
    );
    expect(router.navigate).toHaveBeenCalledWith(['/documents']);
  });
});
