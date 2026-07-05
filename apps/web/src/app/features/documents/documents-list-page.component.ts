import { AsyncPipe, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, map, switchMap } from 'rxjs';
import {
  DocumentListItem,
  DocumentsApiService,
  TransmissionAttempt,
} from '../../core/api/documents-api.service';

@Component({
  selector: 'ol-documents-list-page',
  standalone: true,
  imports: [AsyncPipe, DatePipe, DecimalPipe, FormsModule, NgFor, NgIf, RouterLink],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Παραστατικά</h1>
        <p class="page-subtitle">Λίστα παραστατικών και κατάσταση myDATA διαβίβασης</p>
      </div>
      <a class="btn btn-primary" routerLink="/documents/new">
        <span class="material-symbols-outlined">add</span>
        Νέο παραστατικό
      </a>
    </section>

    <div class="alert alert-success" *ngIf="message">
      <span class="material-symbols-outlined">check_circle</span>
      {{ message }}
    </div>
    <div class="alert alert-danger" *ngIf="errorMessage">
      <span class="material-symbols-outlined">error</span>
      {{ errorMessage }}
    </div>

    <ng-container *ngIf="vm$ | async as vm">
      <!-- Metrics -->
      <section class="kpi-row" aria-label="Document metrics">
        <div class="kpi-card">
          <span class="kpi-lbl">Παραστατικά</span
          ><strong class="kpi-val">{{ vm.documents.length }}</strong>
        </div>
        <div class="kpi-card">
          <span class="kpi-lbl">Καθαρή αξία</span
          ><strong class="kpi-val">{{ vm.netTotal | number: '1.0-0' }}</strong>
        </div>
        <div class="kpi-card">
          <span class="kpi-lbl">ΦΠΑ</span
          ><strong class="kpi-val">{{ vm.vatTotal | number: '1.0-0' }}</strong>
        </div>
        <div class="kpi-card">
          <span class="kpi-lbl">Σύνολο</span
          ><strong class="kpi-val">{{ vm.grossTotal | number: '1.0-0' }}</strong>
        </div>
        <div class="kpi-card" [class.kpi-warning]="vm.pendingCount > 0">
          <span class="kpi-lbl">Εκκρεμή myDATA</span
          ><strong class="kpi-val">{{ vm.pendingCount }}</strong>
        </div>
        <div class="kpi-card" [class.kpi-danger]="vm.failedCount > 0">
          <span class="kpi-lbl">Αποτυχίες</span
          ><strong class="kpi-val">{{ vm.failedCount }}</strong>
        </div>
      </section>

      <!-- Filters -->
      <div class="card filters-card">
        <div class="filters">
          <label class="filter-field">
            <span>
              <span class="material-symbols-outlined">search</span>
              Αναζήτηση
            </span>
            <input
              [(ngModel)]="filters.search"
              name="search"
              placeholder="Αριθμός, σειρά, πελάτης, ΑΦΜ"
              (ngModelChange)="applyFilters()"
            />
          </label>
          <label class="filter-field">
            <span>Τύπος</span>
            <select
              [(ngModel)]="filters.documentType"
              name="documentType"
              (ngModelChange)="applyFilters()"
            >
              <option value="">Όλοι</option>
              <option value="SALES_INVOICE">Τιμολόγια πώλησης</option>
              <option value="PURCHASE_INVOICE">Τιμολόγια αγοράς</option>
              <option value="CREDIT_NOTE">Πιστωτικά</option>
              <option value="RETAIL_RECEIPT">Αποδείξεις λιανικής</option>
            </select>
          </label>
          <label class="filter-field">
            <span>myDATA</span>
            <select
              [(ngModel)]="filters.myDataStatus"
              name="myDataStatus"
              (ngModelChange)="applyFilters()"
            >
              <option value="">Όλα</option>
              <option value="DRAFT">Πρόχειρα</option>
              <option value="READY_TO_SEND">Έτοιμα</option>
              <option value="SENT">Σταλμένα</option>
              <option value="FAILED">Αποτυχημένα</option>
              <option value="CANCELLED">Ακυρωμένα</option>
            </select>
          </label>
          <label class="filter-field">
            <span>Από</span>
            <input
              [(ngModel)]="filters.dateFrom"
              name="dateFrom"
              type="date"
              (ngModelChange)="applyFilters()"
            />
          </label>
          <label class="filter-field">
            <span>Έως</span>
            <input
              [(ngModel)]="filters.dateTo"
              name="dateTo"
              type="date"
              (ngModelChange)="applyFilters()"
            />
          </label>
          <div class="filter-actions">
            <button type="button" class="btn btn-secondary btn-sm" (click)="resetFilters()">
              <span class="material-symbols-outlined">filter_alt_off</span>
              Επαναφορά
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              (click)="exportCsv(vm.documents)"
            >
              <span class="material-symbols-outlined">download</span>
              CSV
            </button>
          </div>
        </div>
      </div>

      <!-- Table -->
      <div class="table-wrap" *ngIf="vm.documents.length > 0; else noDocuments">
        <table>
          <thead>
            <tr>
              <th>Παραστατικό</th>
              <th>Εταιρεία</th>
              <th>Αντισυμβαλλόμενος</th>
              <th>Ημερ.</th>
              <th class="tr">Καθαρή</th>
              <th class="tr">ΦΠΑ</th>
              <th class="tr">Σύνολο</th>
              <th>myDATA</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let document of vm.documents">
              <td>
                <strong>{{ document.series || '-' }}/{{ document.documentNumber }}</strong>
                <small>{{ document.documentType }}</small>
              </td>
              <td>
                {{ document.clientCompany.legalName }}
                <small>{{ document.clientCompany.vatNumber }}</small>
                <small>{{ companyMyDataLabel(document) }}</small>
              </td>
              <td>
                {{ document.counterpartyName || '-' }}
                <small *ngIf="document.counterpartyVatNumber">{{
                  document.counterpartyVatNumber
                }}</small>
              </td>
              <td>{{ document.issueDate | date: 'dd/MM/yy' }}</td>
              <td class="tr">{{ document.netAmount | number: '1.2-2' }}</td>
              <td class="tr">{{ document.vatAmount | number: '1.2-2' }}</td>
              <td class="tr">
                <strong>{{ document.totalAmount | number: '1.2-2' }}</strong>
              </td>
              <td>
                <span
                  class="badge"
                  [class.badge-success]="document.myDataStatus === 'SENT'"
                  [class.badge-danger]="document.myDataStatus === 'FAILED'"
                  [class.badge-warning]="document.myDataStatus === 'READY_TO_SEND'"
                  [class.badge-info]="document.myDataStatus === 'DRAFT'"
                  [class.badge-neutral]="document.myDataStatus === 'CANCELLED'"
                  >{{ statusLabel(document.myDataStatus) }}</span
                >
                <small *ngIf="document.myDataMark">MARK: {{ document.myDataMark }}</small>
              </td>
              <td class="doc-actions">
                <button
                  type="button"
                  class="btn btn-xs btn-secondary"
                  title="Prepare myDATA XML"
                  [disabled]="!supportsSendInvoices(document)"
                  (click)="prepare(document)"
                >
                  <span class="material-symbols-outlined">code</span> XML
                </button>
                <button
                  type="button"
                  class="btn btn-xs btn-secondary"
                  title="Mock send"
                  [disabled]="!supportsSendInvoices(document)"
                  (click)="sendMock(document)"
                >
                  <span class="material-symbols-outlined">send</span> Mock
                </button>
                <button
                  type="button"
                  class="btn btn-xs btn-secondary"
                  title="Expense classification preview"
                  [disabled]="!supportsExpenseReceiver(document)"
                  (click)="prepareExpense(document)"
                >
                  <span class="material-symbols-outlined">fact_check</span> Expense XML
                </button>
                <button
                  type="button"
                  class="btn btn-xs btn-secondary"
                  title="Mock expense classification"
                  [disabled]="!supportsExpenseReceiver(document)"
                  (click)="sendExpenseMock(document)"
                >
                  <span class="material-symbols-outlined">done_all</span> Expense mock
                </button>
                <button
                  type="button"
                  class="btn btn-xs btn-danger"
                  title="AADE test send"
                  [disabled]="!canSendAadeTest(document)"
                  (click)="sendTest(document)"
                >
                  <span class="material-symbols-outlined">cloud_upload</span> AADE
                </button>
                <button
                  type="button"
                  class="btn btn-xs btn-ghost"
                  title="Ιστορικό"
                  (click)="loadHistory(document)"
                >
                  <span class="material-symbols-outlined">history</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ng-template #noDocuments>
        <div class="card">
          <div class="empty-state">
            <span class="material-symbols-outlined">receipt_long</span>
            <p>Δεν υπάρχουν παραστατικά για τα φίλτρα.</p>
          </div>
        </div>
      </ng-template>
    </ng-container>

    <!-- XML Preview -->
    <div class="card preview-panel" *ngIf="xmlPreview">
      <div class="preview-header">
        <h2 class="card-title">
          <span class="material-symbols-outlined">code</span>
          myDATA XML preview
        </h2>
        <button type="button" class="btn btn-sm btn-secondary" (click)="xmlPreview = ''">
          <span class="material-symbols-outlined">close</span>
          Κλείσιμο
        </button>
      </div>
      <pre class="xml-pre">{{ xmlPreview }}</pre>
    </div>

    <!-- History -->
    <div class="card preview-panel" *ngIf="history.length > 0">
      <div class="preview-header">
        <h2 class="card-title">
          <span class="material-symbols-outlined">history</span>
          Ιστορικό διαβιβάσεων
        </h2>
        <button type="button" class="btn btn-sm btn-secondary" (click)="history = []">
          <span class="material-symbols-outlined">close</span>
          Κλείσιμο
        </button>
      </div>
      <ol class="history-list">
        <li *ngFor="let attempt of history" class="history-item">
          <span
            class="badge"
            [class.badge-success]="attempt.status === 'SENT'"
            [class.badge-danger]="attempt.status === 'FAILED'"
            [class.badge-neutral]="attempt.status !== 'SENT' && attempt.status !== 'FAILED'"
            >{{ attempt.status }}</span
          >
          <span class="history-meta"
            >{{ attempt.provider }} — {{ attempt.createdAt | date: 'dd/MM/yy HH:mm' }}</span
          >
          <small *ngIf="attempt.errorMessage">{{ attempt.errorMessage }}</small>
        </li>
      </ol>
    </div>
  `,
  styles: [
    `
      .kpi-row {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 10px;
        margin-bottom: 14px;
      }
      .kpi-card {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 12px 14px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface);
        box-shadow: var(--shadow-sm);
      }
      .kpi-card.kpi-danger {
        border-left: 3px solid var(--err);
      }
      .kpi-card.kpi-warning {
        border-left: 3px solid var(--warn);
      }
      .kpi-lbl {
        font-size: 0.6875rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--muted);
      }
      .kpi-val {
        font-size: 1.25rem;
        font-weight: 700;
        line-height: 1;
      }

      .filters-card {
        margin-bottom: 14px;
      }

      .filters {
        display: grid;
        grid-template-columns: 2fr repeat(4, minmax(110px, 1fr)) auto;
        gap: 10px;
        align-items: end;
        padding: 14px 16px;
      }

      .filter-field {
        display: flex;
        flex-direction: column;
        gap: 5px;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-2);
      }
      .filter-field span {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .filter-field .material-symbols-outlined {
        font-size: 14px;
        color: var(--muted);
      }

      .filter-actions {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .tr {
        text-align: right;
      }

      .doc-actions {
        display: flex;
        gap: 4px;
        justify-content: flex-end;
        flex-wrap: wrap;
      }

      .preview-panel {
        margin-top: 16px;
      }

      .preview-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 18px;
        border-bottom: 1px solid var(--border);
      }

      .xml-pre {
        overflow-x: auto;
        margin: 0;
        padding: 16px 18px;
        background: #111827;
        color: #f8fafc;
        font-size: 0.8125rem;
        line-height: 1.6;
        border-radius: 0 0 8px 8px;
      }

      .history-list {
        margin: 0;
        padding: 14px 18px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        list-style: none;
      }

      .history-item {
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 8px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--border);
        font-size: 0.875rem;
      }
      .history-item:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }
      .history-meta {
        color: var(--muted);
      }

      @media (max-width: 1200px) {
        .kpi-row {
          grid-template-columns: repeat(3, 1fr);
        }
        .filters {
          grid-template-columns: repeat(2, 1fr);
        }
      }
    `,
  ],
})
export class DocumentsListPageComponent {
  private readonly documentsApi = inject(DocumentsApiService);
  private readonly reload$ = new BehaviorSubject<void>(undefined);
  private readonly filters$ = new BehaviorSubject(this.defaultFilters());

  readonly documents$ = combineLatest([this.reload$, this.filters$]).pipe(
    switchMap(([, filters]) => this.documentsApi.findAll(filters)),
  );
  readonly vm$ = this.documents$.pipe(
    map((documents) => ({
      documents,
      netTotal: sumDocuments(documents, 'netAmount'),
      vatTotal: sumDocuments(documents, 'vatAmount'),
      grossTotal: sumDocuments(documents, 'totalAmount'),
      pendingCount: documents.filter((document) =>
        ['DRAFT', 'READY_TO_SEND'].includes(document.myDataStatus),
      ).length,
      failedCount: documents.filter((document) => document.myDataStatus === 'FAILED').length,
    })),
  );
  filters = this.defaultFilters();
  xmlPreview = '';
  history: TransmissionAttempt[] = [];
  message = '';
  errorMessage = '';

  applyFilters(): void {
    this.filters$.next({ ...this.filters });
  }

  resetFilters(): void {
    this.filters = this.defaultFilters();
    this.applyFilters();
  }

  exportCsv(documents: DocumentListItem[]): void {
    const header = [
      'type',
      'series',
      'number',
      'issueDate',
      'company',
      'companyVat',
      'counterparty',
      'counterpartyVat',
      'net',
      'vat',
      'total',
      'vatCategory',
      'myDataStatus',
      'mark',
    ];
    const rows = documents.map((document) => [
      document.documentType,
      document.series ?? '',
      document.documentNumber,
      document.issueDate,
      document.clientCompany.legalName,
      document.clientCompany.vatNumber,
      document.counterpartyName ?? '',
      document.counterpartyVatNumber ?? '',
      document.netAmount,
      document.vatAmount,
      document.totalAmount,
      document.vatCategory,
      document.myDataStatus,
      document.myDataMark ?? '',
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `documents-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  prepare(document: DocumentListItem): void {
    this.clearMessages();
    this.documentsApi.prepareMyData(document.id).subscribe({
      next: (response) => {
        this.xmlPreview = response.xml;
        this.message = `XML prepared for ${document.series || '-'}/${document.documentNumber}.`;
        this.reload$.next();
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  sendMock(document: DocumentListItem): void {
    this.clearMessages();
    this.documentsApi.sendMockMyData(document.id).subscribe({
      next: (response) => {
        this.message = `Mock send succeeded. MARK: ${response.mark || '-'}`;
        this.reload$.next();
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  sendTest(document: DocumentListItem): void {
    this.clearMessages();
    this.documentsApi.sendTestMyData(document.id).subscribe({
      next: (response) => {
        this.message = `AADE test send succeeded. MARK: ${response.mark || '-'}`;
        this.reload$.next();
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  prepareExpense(document: DocumentListItem): void {
    this.clearMessages();
    this.documentsApi.prepareExpenseMyData(document.id).subscribe({
      next: (response) => {
        this.xmlPreview = response.xml;
        this.message = `Expense XML prepared for ${document.series || '-'}/${document.documentNumber}.`;
        this.reload$.next();
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  sendExpenseMock(document: DocumentListItem): void {
    this.clearMessages();
    this.documentsApi.sendExpenseMockMyData(document.id).subscribe({
      next: (response) => {
        this.message = `Expense mock classification succeeded. MARK: ${response.mark || '-'}`;
        this.reload$.next();
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  loadHistory(document: DocumentListItem): void {
    this.clearMessages();
    this.documentsApi.getMyDataHistory(document.id).subscribe({
      next: (history) => {
        this.history = history;
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  supportsSendInvoices(document: DocumentListItem): boolean {
    return ['SALES_INVOICE', 'CREDIT_NOTE', 'RETAIL_RECEIPT'].includes(document.documentType);
  }

  supportsExpenseReceiver(document: DocumentListItem): boolean {
    return document.documentType === 'PURCHASE_INVOICE';
  }

  canSendAadeTest(document: DocumentListItem): boolean {
    if (!this.supportsSendInvoices(document)) {
      return false;
    }

    return (
      (document.clientCompany.myDataMode === 'ACCOUNTING_OFFICE_AUTHORIZED' &&
        document.clientCompany.myDataAuthorized === true) ||
      document.clientCompany.myDataMode === 'OWN_API_CREDENTIALS_ENV_REF'
    );
  }

  companyMyDataLabel(document: DocumentListItem): string {
    const mode = document.clientCompany.myDataMode;

    if (mode === 'ACCOUNTING_OFFICE_AUTHORIZED') {
      return document.clientCompany.myDataAuthorized
        ? 'AADE: εξουσιοδότηση γραφείου'
        : 'AADE: λείπει εξουσιοδότηση';
    }

    const labels: Record<string, string> = {
      OWN_API_CREDENTIALS_ENV_REF: 'AADE: ίδια credentials από env',
      MANUAL_UPLOAD: 'AADE: χειροκίνητη ροή',
      NOT_CONFIGURED: 'AADE: αρρύθμιστο',
    };

    return labels[mode ?? ''] ?? 'AADE: αρρύθμιστο';
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      DRAFT: 'Πρόχειρο',
      READY_TO_SEND: 'Έτοιμο',
      SENT: 'Στάλθηκε',
      FAILED: 'Αποτυχία',
      CANCELLED: 'Ακυρωμένο',
    };

    return labels[status] ?? status;
  }

  private clearMessages(): void {
    this.message = '';
    this.errorMessage = '';
  }

  private showError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      const message = error.error?.message;
      this.errorMessage = Array.isArray(message)
        ? message.join(' ')
        : message || error.message || 'Request failed.';
      return;
    }

    this.errorMessage = 'Request failed.';
  }

  private defaultFilters() {
    return {
      search: '',
      documentType: '',
      myDataStatus: '',
      dateFrom: '',
      dateTo: '',
    };
  }
}

function sumDocuments(
  documents: DocumentListItem[],
  field: 'netAmount' | 'vatAmount' | 'totalAmount',
) {
  return documents.reduce((sum, document) => sum + Number(document[field] || 0), 0);
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}
