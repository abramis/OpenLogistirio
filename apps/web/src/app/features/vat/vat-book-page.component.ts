import { AsyncPipe, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, map, switchMap } from 'rxjs';
import { CompaniesApiService } from '../../core/api/companies-api.service';
import {
  DocumentFilters,
  DocumentListItem,
  DocumentsApiService,
} from '../../core/api/documents-api.service';

type BookView = 'REVENUE' | 'EXPENSES' | 'VAT';

interface BookPeriodRow {
  period: string;
  revenueNet: number;
  revenueVat: number;
  expenseNet: number;
  expenseVat: number;
  payableVat: number;
  documents: number;
}

@Component({
  selector: 'ol-vat-book-page',
  standalone: true,
  imports: [AsyncPipe, DatePipe, DecimalPipe, FormsModule, NgFor, NgIf],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Βιβλία</h1>
        <p class="page-subtitle">Έσοδα, έξοδα, ΦΠΑ και κινήσεις ανά πελάτη και περίοδο</p>
      </div>
      <button type="button" class="btn btn-secondary" (click)="exportCsv()">
        <span class="material-symbols-outlined">download</span>
        CSV
      </button>
    </section>

    <section class="book-filters">
      <label>
        Πελάτης
        <select
          [(ngModel)]="filters.clientCompanyId"
          name="clientCompanyId"
          (ngModelChange)="reload()"
        >
          <option value="">Όλοι οι πελάτες</option>
          <option *ngFor="let company of companies$ | async" [value]="company.id">
            {{ company.legalName }} - {{ company.vatNumber }}
          </option>
        </select>
      </label>
      <label>
        Έτος
        <input
          [(ngModel)]="filters.year"
          name="year"
          type="number"
          min="2000"
          max="2200"
          (ngModelChange)="reload()"
        />
      </label>
      <label>
        Μήνας
        <select [(ngModel)]="filters.month" name="month" (ngModelChange)="reload()">
          <option value="">Όλο το έτος</option>
          <option *ngFor="let month of months" [value]="month.value">{{ month.label }}</option>
        </select>
      </label>
      <label>
        Ημερολόγιο
        <select [(ngModel)]="filters.journalCode" name="journalCode" (ngModelChange)="reload()">
          <option value="">Όλα</option>
          <option value="SALES">Πωλήσεων</option>
          <option value="PURCHASES">Αγορών</option>
          <option value="CASH_BANK">Ταμείο / τράπεζες</option>
          <option value="GENERAL">Γενικό</option>
        </select>
      </label>
    </section>

    <ng-container *ngIf="book$ | async as book">
      <section class="book-tabs" aria-label="Προβολή βιβλίων">
        <button type="button" [class.active]="view === 'REVENUE'" (click)="view = 'REVENUE'">
          Έσοδα
        </button>
        <button type="button" [class.active]="view === 'EXPENSES'" (click)="view = 'EXPENSES'">
          Έξοδα
        </button>
        <button type="button" [class.active]="view === 'VAT'" (click)="view = 'VAT'">ΦΠΑ</button>
      </section>

      <section class="book-summary">
        <div>
          <span>Έσοδα καθαρά</span>
          <strong>{{ book.revenueNet | number: '1.2-2' }}</strong>
        </div>
        <div>
          <span>Έξοδα καθαρά</span>
          <strong>{{ book.expenseNet | number: '1.2-2' }}</strong>
        </div>
        <div>
          <span>ΦΠΑ εκροών</span>
          <strong>{{ book.revenueVat | number: '1.2-2' }}</strong>
        </div>
        <div>
          <span>ΦΠΑ εισροών</span>
          <strong>{{ book.expenseVat | number: '1.2-2' }}</strong>
        </div>
        <div [class.credit]="book.payableVat < 0">
          <span>{{ book.payableVat < 0 ? 'Πιστωτικό ΦΠΑ' : 'Πληρωτέο ΦΠΑ' }}</span>
          <strong>{{ book.payableVat | number: '1.2-2' }}</strong>
        </div>
      </section>

      <section class="table-wrap period-table" *ngIf="book.periods.length > 0">
        <table>
          <thead>
            <tr>
              <th>Περίοδος</th>
              <th class="tr">Έσοδα</th>
              <th class="tr">ΦΠΑ εσόδων</th>
              <th class="tr">Έξοδα</th>
              <th class="tr">ΦΠΑ εξόδων</th>
              <th class="tr">Πληρωτέο</th>
              <th class="tr">Παρ.</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of book.periods">
              <td>
                <strong>{{ row.period }}</strong>
              </td>
              <td class="tr">{{ row.revenueNet | number: '1.2-2' }}</td>
              <td class="tr">{{ row.revenueVat | number: '1.2-2' }}</td>
              <td class="tr">{{ row.expenseNet | number: '1.2-2' }}</td>
              <td class="tr">{{ row.expenseVat | number: '1.2-2' }}</td>
              <td class="tr" [class.credit]="row.payableVat < 0">
                <strong>{{ row.payableVat | number: '1.2-2' }}</strong>
              </td>
              <td class="tr">{{ row.documents }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="table-wrap" *ngIf="visibleDocuments(book.documents).length > 0; else noRows">
        <table>
          <thead>
            <tr>
              <th>Ημερ.</th>
              <th>Πελάτης</th>
              <th>Παραστατικό</th>
              <th>Κίνηση</th>
              <th>Ημερολόγιο</th>
              <th>Αντισυμβαλλόμενος</th>
              <th class="tr">Καθαρή</th>
              <th class="tr">ΦΠΑ</th>
              <th class="tr">Σύνολο</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let document of visibleDocuments(book.documents)">
              <td>{{ document.issueDate | date: 'dd/MM/yy' }}</td>
              <td>
                {{ document.clientCompany.legalName }}
                <small>{{ document.clientCompany.vatNumber }}</small>
              </td>
              <td>
                <strong>{{ document.series || '-' }}/{{ document.documentNumber }}</strong>
                <small>{{ documentTypeLabel(document.documentType) }}</small>
              </td>
              <td>{{ movementLabel(document.movementCode) }}</td>
              <td>{{ journalLabel(document.journalCode) }}</td>
              <td>{{ document.counterpartyName || '-' }}</td>
              <td class="tr">{{ signedNet(document) | number: '1.2-2' }}</td>
              <td class="tr">{{ signedVat(document) | number: '1.2-2' }}</td>
              <td class="tr">
                <strong>{{ signedTotal(document) | number: '1.2-2' }}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <ng-template #noRows>
        <div class="card">
          <div class="empty-state">
            <span class="material-symbols-outlined">calculate</span>
            <p>Δεν υπάρχουν κινήσεις για τα φίλτρα.</p>
          </div>
        </div>
      </ng-template>
    </ng-container>
  `,
  styles: [
    `
      .book-filters {
        display: grid;
        grid-template-columns: minmax(260px, 2fr) repeat(3, minmax(120px, 1fr));
        gap: 12px;
        margin-bottom: 14px;
        padding-bottom: 14px;
        border-bottom: 1px solid var(--border);
      }

      .book-filters label {
        display: grid;
        gap: 6px;
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 700;
      }

      .book-tabs {
        display: inline-flex;
        gap: 4px;
        padding: 3px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface);
        margin-bottom: 14px;
      }

      .book-tabs button {
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--text-2);
        font: inherit;
        font-weight: 700;
        padding: 8px 13px;
        cursor: pointer;
      }

      .book-tabs button.active {
        background: var(--primary);
        color: #fff;
      }

      .book-summary {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface);
        overflow: hidden;
        margin-bottom: 14px;
      }

      .book-summary div {
        display: grid;
        gap: 5px;
        padding: 13px 15px;
        border-right: 1px solid var(--border);
      }

      .book-summary div:last-child {
        border-right: none;
      }

      .book-summary span {
        color: var(--muted);
        font-size: 0.75rem;
        font-weight: 700;
      }

      .book-summary strong {
        font-size: 1.1rem;
      }

      .period-table {
        margin-bottom: 14px;
      }

      .tr {
        text-align: right;
      }

      .credit strong {
        color: var(--ok);
      }

      td small {
        display: block;
        margin-top: 3px;
        color: var(--muted);
      }

      @media (max-width: 960px) {
        .book-filters,
        .book-summary {
          grid-template-columns: 1fr;
        }

        .book-summary div {
          border-right: none;
          border-bottom: 1px solid var(--border);
        }

        .book-summary div:last-child {
          border-bottom: none;
        }
      }
    `,
  ],
})
export class VatBookPageComponent {
  private readonly documentsApi = inject(DocumentsApiService);
  private readonly reload$ = new BehaviorSubject<void>(undefined);

  readonly companies$ = inject(CompaniesApiService).findAll();
  readonly months = [
    { value: '1', label: 'Ιανουάριος' },
    { value: '2', label: 'Φεβρουάριος' },
    { value: '3', label: 'Μάρτιος' },
    { value: '4', label: 'Απρίλιος' },
    { value: '5', label: 'Μάιος' },
    { value: '6', label: 'Ιούνιος' },
    { value: '7', label: 'Ιούλιος' },
    { value: '8', label: 'Αύγουστος' },
    { value: '9', label: 'Σεπτέμβριος' },
    { value: '10', label: 'Οκτώβριος' },
    { value: '11', label: 'Νοέμβριος' },
    { value: '12', label: 'Δεκέμβριος' },
  ];
  filters = {
    clientCompanyId: '',
    year: new Date().getFullYear(),
    month: '',
    journalCode: '',
  };
  view: BookView = 'REVENUE';
  private latestDocuments: DocumentListItem[] = [];

  readonly book$ = this.reload$.pipe(
    map(() => this.toDocumentFilters()),
    switchMap((query) => this.documentsApi.findAll(query)),
    map((documents) => {
      this.latestDocuments = documents;
      return toBook(documents);
    }),
  );

  reload(): void {
    this.reload$.next();
  }

  visibleDocuments(documents: DocumentListItem[]): DocumentListItem[] {
    return documents.filter((document) => {
      if (this.view === 'REVENUE') {
        return isRevenueDocument(document);
      }
      if (this.view === 'EXPENSES') {
        return isExpenseDocument(document);
      }
      return true;
    });
  }

  exportCsv(): void {
    const documents = this.visibleDocuments(this.latestDocuments);
    const header = [
      'issueDate',
      'company',
      'document',
      'documentType',
      'movementCode',
      'journalCode',
      'counterparty',
      'net',
      'vat',
      'total',
    ];
    const rows = documents.map((document) => [
      document.issueDate,
      document.clientCompany.legalName,
      `${document.series || '-'}/${document.documentNumber}`,
      document.documentType,
      document.movementCode ?? '',
      document.journalCode ?? '',
      document.counterpartyName ?? '',
      this.signedNet(document),
      this.signedVat(document),
      this.signedTotal(document),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `books-${this.filters.year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  signedNet(document: DocumentListItem): number {
    return signedValue(document, 'netAmount');
  }

  signedVat(document: DocumentListItem): number {
    return signedValue(document, 'vatAmount');
  }

  signedTotal(document: DocumentListItem): number {
    return signedValue(document, 'totalAmount');
  }

  movementLabel(code?: string | null): string {
    const labels: Record<string, string> = {
      SALE_INVOICE: 'Πώληση',
      PURCHASE_INVOICE: 'Αγορά / δαπάνη',
      CREDIT_NOTE: 'Πιστωτικό',
    };

    return code ? (labels[code] ?? code) : '-';
  }

  journalLabel(code?: string | null): string {
    const labels: Record<string, string> = {
      SALES: 'Πωλήσεων',
      PURCHASES: 'Αγορών',
      CASH_BANK: 'Ταμείο / τράπεζες',
      GENERAL: 'Γενικό',
    };

    return code ? (labels[code] ?? code) : '-';
  }

  documentTypeLabel(value: string): string {
    const labels: Record<string, string> = {
      SALES_INVOICE: 'Τιμολόγιο πώλησης',
      PURCHASE_INVOICE: 'Τιμολόγιο αγοράς',
      CREDIT_NOTE: 'Πιστωτικό',
      RETAIL_RECEIPT: 'Απόδειξη λιανικής',
    };

    return labels[value] ?? value;
  }

  private toDocumentFilters(): DocumentFilters {
    const year = Number(this.filters.year || new Date().getFullYear());
    const month = this.filters.month ? Number(this.filters.month) : undefined;
    const dateFrom = month
      ? new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10)
      : `${year}-01-01`;
    const dateTo = month
      ? new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
      : `${year}-12-31`;

    return {
      clientCompanyId: this.filters.clientCompanyId,
      journalCode: this.filters.journalCode,
      dateFrom,
      dateTo,
    };
  }
}

function toBook(documents: DocumentListItem[]) {
  const periods = new Map<string, BookPeriodRow>();
  let revenueNet = 0;
  let revenueVat = 0;
  let expenseNet = 0;
  let expenseVat = 0;

  for (const document of documents) {
    const period = document.issueDate.slice(0, 7);
    const row =
      periods.get(period) ??
      ({
        period,
        revenueNet: 0,
        revenueVat: 0,
        expenseNet: 0,
        expenseVat: 0,
        payableVat: 0,
        documents: 0,
      } satisfies BookPeriodRow);

    if (isExpenseDocument(document)) {
      const net = signedValue(document, 'netAmount');
      const vat = signedValue(document, 'vatAmount');
      expenseNet += net;
      expenseVat += vat;
      row.expenseNet += net;
      row.expenseVat += vat;
    } else {
      const net = signedValue(document, 'netAmount');
      const vat = signedValue(document, 'vatAmount');
      revenueNet += net;
      revenueVat += vat;
      row.revenueNet += net;
      row.revenueVat += vat;
    }

    row.payableVat = roundMoney(row.revenueVat - row.expenseVat);
    row.documents += 1;
    periods.set(period, row);
  }

  return {
    documents,
    revenueNet: roundMoney(revenueNet),
    revenueVat: roundMoney(revenueVat),
    expenseNet: roundMoney(expenseNet),
    expenseVat: roundMoney(expenseVat),
    payableVat: roundMoney(revenueVat - expenseVat),
    periods: [...periods.values()].sort((a, b) => b.period.localeCompare(a.period)),
  };
}

function isRevenueDocument(document: DocumentListItem): boolean {
  return (
    document.movementCode !== 'PURCHASE_INVOICE' && document.documentType !== 'PURCHASE_INVOICE'
  );
}

function isExpenseDocument(document: DocumentListItem): boolean {
  return (
    document.movementCode === 'PURCHASE_INVOICE' || document.documentType === 'PURCHASE_INVOICE'
  );
}

function signedValue(
  document: DocumentListItem,
  field: 'netAmount' | 'vatAmount' | 'totalAmount',
): number {
  const sign = document.documentType === 'CREDIT_NOTE' ? -1 : 1;
  return roundMoney(Number(document[field] || 0) * sign);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}
