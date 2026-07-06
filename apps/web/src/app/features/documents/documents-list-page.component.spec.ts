import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DocumentsApiService } from '../../core/api/documents-api.service';
import { DocumentsListPageComponent } from './documents-list-page.component';

describe('DocumentsListPageComponent', () => {
  let fixture: ComponentFixture<DocumentsListPageComponent>;
  const documentsApi = {
    findAll: jasmine.createSpy('findAll').and.returnValue(
      of([
        {
          id: 'document-1',
          documentType: 'SALES_INVOICE',
          series: 'A',
          documentNumber: '12',
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
    prepareMyData: jasmine.createSpy('prepareMyData').and.returnValue(
      of({
        documentId: 'document-1',
        status: 'READY_TO_SEND',
        xml: '<myDataPreview />',
      }),
    ),
    sendMockMyData: jasmine.createSpy('sendMockMyData').and.returnValue(
      of({
        documentId: 'document-1',
        status: 'SENT',
        mark: 'MOCK-MARK-document-1',
      }),
    ),
    sendTestMyData: jasmine.createSpy('sendTestMyData').and.returnValue(
      of({
        documentId: 'document-1',
        status: 'SENT',
        mark: 'AADE-TEST-MARK',
      }),
    ),
    getMyDataHistory: jasmine.createSpy('getMyDataHistory').and.returnValue(of([])),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentsListPageComponent],
      providers: [provideRouter([]), { provide: DocumentsApiService, useValue: documentsApi }],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentsListPageComponent);
    fixture.detectChanges();
  });

  it('renders document myDATA status', () => {
    expect(fixture.nativeElement.textContent).toContain('Demo Company');
    expect(fixture.nativeElement.textContent).toContain('Πρόχειρο');
  });

  it('prepares XML and shows the preview', () => {
    fixture.componentInstance.prepare({
      id: 'document-1',
      documentType: 'SALES_INVOICE',
      documentNumber: '12',
      issueDate: '2026-07-01T00:00:00.000Z',
      netAmount: '100.00',
      vatAmount: '24.00',
      totalAmount: '124.00',
      vatCategory: 'VAT_24',
      movementCode: 'SALE_INVOICE',
      journalCode: 'SALES',
      myDataStatus: 'DRAFT',
      clientCompany: {
        id: 'company-1',
        legalName: 'Demo Company',
        vatNumber: '123456789',
      },
    });
    fixture.detectChanges();

    expect(documentsApi.prepareMyData).toHaveBeenCalledWith('document-1');
    expect(fixture.nativeElement.textContent).toContain('myDATA XML preview');
  });

  it('sends to the mock myDATA provider', () => {
    fixture.componentInstance.sendMock({
      id: 'document-1',
      documentType: 'SALES_INVOICE',
      documentNumber: '12',
      issueDate: '2026-07-01T00:00:00.000Z',
      netAmount: '100.00',
      vatAmount: '24.00',
      totalAmount: '124.00',
      vatCategory: 'VAT_24',
      movementCode: 'SALE_INVOICE',
      journalCode: 'SALES',
      myDataStatus: 'DRAFT',
      clientCompany: {
        id: 'company-1',
        legalName: 'Demo Company',
        vatNumber: '123456789',
      },
    });

    expect(documentsApi.sendMockMyData).toHaveBeenCalledWith('document-1');
  });

  it('sends to the AADE test environment', () => {
    fixture.componentInstance.sendTest({
      id: 'document-1',
      documentType: 'SALES_INVOICE',
      documentNumber: '12',
      issueDate: '2026-07-01T00:00:00.000Z',
      netAmount: '100.00',
      vatAmount: '24.00',
      totalAmount: '124.00',
      vatCategory: 'VAT_24',
      movementCode: 'SALE_INVOICE',
      journalCode: 'SALES',
      myDataStatus: 'DRAFT',
      clientCompany: {
        id: 'company-1',
        legalName: 'Demo Company',
        vatNumber: '123456789',
      },
    });

    expect(documentsApi.sendTestMyData).toHaveBeenCalledWith('document-1');
  });
});
