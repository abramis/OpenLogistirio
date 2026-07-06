import { AsyncPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, switchMap } from 'rxjs';
import { CompaniesApiService } from '../../core/api/companies-api.service';
import { DocumentsCsvImportResponse, ImportsApiService } from '../../core/api/imports-api.service';

@Component({
  selector: 'ol-imports-page',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, NgFor, NgIf],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Imports</h1>
        <p class="page-subtitle">Μαζική εισαγωγή παραστατικών από CSV exports παλιών συστημάτων.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" type="button" (click)="downloadTemplate()">
          <span class="material-symbols-outlined">download</span>
          Template
        </button>
      </div>
    </section>

    <div class="alert alert-success" *ngIf="message">{{ message }}</div>
    <div class="alert alert-danger" *ngIf="errorMessage">{{ errorMessage }}</div>

    <section class="card import-card">
      <div class="card-header">
        <div>
          <h2 class="card-title">
            <span class="material-symbols-outlined">upload_file</span>
            CSV παραστατικών
          </h2>
          <p class="card-subtitle">
            Υποστηρίζει τύπο παραστατικού, ποσά, ΦΠΑ, κωδικό κίνησης, ημερολόγιο και
            αντισυμβαλλόμενο.
          </p>
        </div>
      </div>
      <div class="card-body form-grid">
        <label>
          Εταιρεία πελάτη
          <select [(ngModel)]="clientCompanyId">
            <option value="">Επιλογή</option>
            <option *ngFor="let company of companies$ | async" [value]="company.id">
              {{ company.legalName }} - {{ company.vatNumber }}
            </option>
          </select>
        </label>
        <label>
          Αρχείο CSV
          <input type="file" accept=".csv,text/csv" (change)="readFile($event)" />
        </label>
        <label class="wide">
          CSV κείμενο
          <textarea [(ngModel)]="csvText" rows="9"></textarea>
        </label>
        <div class="wide actions">
          <button class="btn btn-secondary" type="button" (click)="loadSample()">
            <span class="material-symbols-outlined">article</span>
            Sample
          </button>
          <button class="btn btn-secondary" type="button" (click)="preview()">
            <span class="material-symbols-outlined">visibility</span>
            Preview
          </button>
          <button class="btn btn-primary" type="button" (click)="runImport()">
            <span class="material-symbols-outlined">upload</span>
            Import
          </button>
        </div>
      </div>
    </section>

    <section class="card result-card" *ngIf="lastResult">
      <div class="card-header">
        <div>
          <h2 class="card-title">
            <span class="material-symbols-outlined">fact_check</span>
            Αποτέλεσμα import
          </h2>
          <p class="card-subtitle">
            Rows {{ lastResult.totalRows }}, valid {{ lastResult.validRows }}, failed
            {{ lastResult.failedRows }}
          </p>
        </div>
      </div>
      <div class="result-summary">
        <div>
          <span>Total</span>
          <strong>{{ lastResult.totalRows }}</strong>
        </div>
        <div>
          <span>Valid</span>
          <strong>{{ lastResult.validRows }}</strong>
        </div>
        <div>
          <span>Failed</span>
          <strong [class.danger-text]="lastResult.failedRows > 0">{{
            lastResult.failedRows
          }}</strong>
        </div>
        <div>
          <span>Mode</span>
          <strong>{{ lastResult.dryRun ? 'Preview' : 'Import' }}</strong>
        </div>
      </div>

      <div class="card-body" *ngIf="lastResult.errors.length > 0">
        <div class="alert alert-danger">Υπάρχουν γραμμές με λάθη. Διορθώστε το CSV.</div>
        <table>
          <thead>
            <tr>
              <th>Γραμμή</th>
              <th>Σφάλμα</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let error of lastResult.errors">
              <td>{{ error.rowNumber }}</td>
              <td>{{ error.message }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card-body" *ngIf="lastResult.errors.length === 0">
        <div class="preview-table">
          <table>
            <thead>
              <tr>
                <th>Παραστατικό</th>
                <th>Ημερ.</th>
                <th>Κίνηση</th>
                <th>Ημερολόγιο</th>
                <th>Αντισυμβαλλόμενος</th>
                <th class="tr">Καθαρή</th>
                <th class="tr">ΦΠΑ</th>
                <th class="tr">Σύνολο</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of lastResult.preview">
                <td>{{ row['series'] || '-' }}/{{ row['documentNumber'] }}</td>
                <td>{{ previewIssueDate(row) | date: 'dd/MM/yyyy' }}</td>
                <td>{{ row['movementCode'] || '-' }}</td>
                <td>{{ row['journalCode'] || '-' }}</td>
                <td>{{ row['counterpartyName'] || '-' }}</td>
                <td class="tr">{{ row['netAmount'] }}</td>
                <td class="tr">{{ row['vatAmount'] }}</td>
                <td class="tr">{{ row['totalAmount'] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="table-wrap" *ngIf="history$ | async as history">
      <table>
        <thead>
          <tr>
            <th>Ημερομηνία</th>
            <th>Πελάτης</th>
            <th>Αρχείο</th>
            <th>Status</th>
            <th class="tr">Rows</th>
            <th class="tr">Failed</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let batch of history">
            <td>{{ batch.createdAt | date: 'dd/MM/yyyy HH:mm' }}</td>
            <td>
              {{ batch.clientCompany?.legalName || '-' }}
              <small>{{ batch.clientCompany?.vatNumber || '-' }}</small>
            </td>
            <td>{{ batch.fileName || '-' }}</td>
            <td>
              <span
                class="badge"
                [class.badge-success]="batch.status === 'COMPLETED'"
                [class.badge-danger]="batch.status === 'FAILED'"
                [class.badge-info]="batch.status === 'PREVIEW'"
              >
                {{ statusLabel(batch.status) }}
              </span>
            </td>
            <td class="tr">{{ batch.successfulRows }}/{{ batch.totalRows }}</td>
            <td class="tr">{{ batch.failedRows }}</td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" *ngIf="history.length === 0">
        <span class="material-symbols-outlined">upload_file</span>
        Δεν υπάρχουν imports ακόμα.
      </div>
    </section>
  `,
  styles: [
    `
      .import-card,
      .result-card {
        margin-bottom: 16px;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      label {
        display: grid;
        gap: 6px;
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 700;
      }

      .wide {
        grid-column: 1 / -1;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: flex-end;
      }

      .result-summary {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        border-top: 1px solid var(--border);
        border-bottom: 1px solid var(--border);
      }

      .result-summary div {
        display: grid;
        gap: 4px;
        padding: 12px 14px;
        border-right: 1px solid var(--border);
      }

      .result-summary div:last-child {
        border-right: none;
      }

      .result-summary span {
        color: var(--muted);
        font-size: 0.72rem;
        font-weight: 700;
      }

      .result-summary strong {
        font-size: 1.1rem;
      }

      .preview-table {
        overflow-x: auto;
      }

      .tr {
        text-align: right;
      }

      .danger-text {
        color: var(--err);
      }

      td small {
        display: block;
        margin-top: 3px;
        color: var(--muted);
      }

      @media (max-width: 760px) {
        .form-grid,
        .result-summary {
          grid-template-columns: 1fr;
        }

        .result-summary div {
          border-right: none;
          border-bottom: 1px solid var(--border);
        }
      }
    `,
  ],
})
export class ImportsPageComponent {
  private readonly importsApi = inject(ImportsApiService);
  private readonly reload$ = new BehaviorSubject<void>(undefined);

  readonly companies$ = inject(CompaniesApiService).findAll();
  readonly history$ = this.reload$.pipe(switchMap(() => this.importsApi.history()));
  clientCompanyId = '';
  fileName = '';
  csvText = documentsCsvTemplate();
  lastResult: DocumentsCsvImportResponse | null = null;
  message = '';
  errorMessage = '';

  readFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.fileName = file.name;
    file.text().then((text) => {
      this.csvText = text;
    });
  }

  loadSample(): void {
    this.csvText = documentsCsvTemplate();
  }

  downloadTemplate(): void {
    const blob = new Blob([documentsCsvTemplate()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'documents-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  preview(): void {
    this.submit(true);
  }

  runImport(): void {
    this.submit(false);
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      PREVIEW: 'Preview',
      COMPLETED: 'Ολοκληρώθηκε',
      FAILED: 'Απέτυχε',
    };

    return labels[status] ?? status;
  }

  previewIssueDate(row: Record<string, unknown>): string | number | Date | null {
    const value = row['issueDate'];
    return typeof value === 'string' || typeof value === 'number' || value instanceof Date
      ? value
      : null;
  }

  private submit(dryRun: boolean): void {
    this.message = '';
    this.errorMessage = '';
    this.importsApi
      .importDocumentsCsv({
        clientCompanyId: this.clientCompanyId,
        csvText: this.csvText,
        fileName: this.fileName,
        dryRun,
      })
      .subscribe({
        next: (result) => {
          this.lastResult = result;
          this.message = dryRun ? 'Preview ολοκληρώθηκε.' : 'Import ολοκληρώθηκε.';
          this.reload$.next();
        },
        error: (error: unknown) => this.showError(error),
      });
  }

  private showError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      const message = error.error?.message;
      this.errorMessage = Array.isArray(message) ? message.join(' ') : message || error.message;
      return;
    }
    this.errorMessage = 'Request failed.';
  }
}

function documentsCsvTemplate(): string {
  return [
    [
      'documentType',
      'series',
      'documentNumber',
      'issueDate',
      'counterpartyName',
      'counterpartyVatNumber',
      'movementCode',
      'journalCode',
      'netAmount',
      'vatAmount',
      'totalAmount',
      'vatCategory',
    ].join(','),
    'SALES_INVOICE,A,100,2026-07-06,Demo Customer,999888777,SALE_INVOICE,SALES,100,24,124,VAT_24',
    'PURCHASE_INVOICE,B,42,2026-07-08,Demo Supplier,123123123,PURCHASE_INVOICE,PURCHASES,50,12,62,VAT_24',
  ].join('\n');
}
