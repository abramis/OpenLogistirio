import { AsyncPipe, DatePipe, JsonPipe, NgFor, NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, switchMap } from 'rxjs';
import { CompaniesApiService } from '../../core/api/companies-api.service';
import { DocumentsCsvImportResponse, ImportsApiService } from '../../core/api/imports-api.service';

@Component({
  selector: 'ol-imports-page',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, JsonPipe, NgFor, NgIf],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Imports</h1>
        <p class="page-subtitle">Μαζική εισαγωγή παραστατικών από CSV exports παλιών συστημάτων.</p>
      </div>
    </section>

    <div class="alert alert-success" *ngIf="message">{{ message }}</div>
    <div class="alert alert-danger" *ngIf="errorMessage">{{ errorMessage }}</div>

    <section class="card import-card">
      <div class="card-header">
        <div>
          <h2 class="card-title">
            <span class="material-symbols-outlined">upload_file</span> CSV παραστατικών
          </h2>
          <p class="card-subtitle">
            Headers:
            documentType,series,documentNumber,issueDate,counterpartyName,counterpartyVatNumber,netAmount,vatAmount,totalAmount,vatCategory
          </p>
        </div>
      </div>
      <div class="card-body form-grid">
        <label>
          Εταιρεία πελάτη
          <select [(ngModel)]="clientCompanyId">
            <option value="">Επιλογή</option>
            <option *ngFor="let company of companies$ | async" [value]="company.id">
              {{ company.legalName }}
            </option>
          </select>
        </label>
        <label>
          Αρχείο CSV
          <input type="file" accept=".csv,text/csv" (change)="readFile($event)" />
        </label>
        <label class="wide">
          CSV κείμενο
          <textarea [(ngModel)]="csvText" rows="8"></textarea>
        </label>
        <div class="wide actions">
          <button class="btn btn-secondary" type="button" (click)="preview()">Preview</button>
          <button class="btn btn-primary" type="button" (click)="runImport()">Import</button>
        </div>
      </div>
    </section>

    <section class="card" *ngIf="lastResult">
      <div class="card-header">
        <div>
          <h2 class="card-title">
            <span class="material-symbols-outlined">fact_check</span> Αποτέλεσμα import
          </h2>
          <p class="card-subtitle">
            Rows: {{ lastResult.totalRows }}, valid: {{ lastResult.validRows }}, failed:
            {{ lastResult.failedRows }}
          </p>
        </div>
      </div>
      <div class="card-body">
        <div class="alert alert-danger" *ngIf="lastResult.errors.length > 0">
          Υπάρχουν γραμμές με λάθη. Διορθώστε το CSV πριν κάνετε import.
        </div>
        <pre>{{
          lastResult.errors.length ? (lastResult.errors | json) : (lastResult.preview | json)
        }}</pre>
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
            <th>Rows</th>
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
              <span class="badge badge-info">{{ batch.status }}</span>
            </td>
            <td>{{ batch.successfulRows }}/{{ batch.totalRows }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  `,
  styles: [
    `
      .import-card {
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
        gap: 8px;
        justify-content: flex-end;
      }

      pre {
        overflow: auto;
        margin: 0;
        border-radius: 6px;
        background: #111827;
        color: #f8fafc;
        padding: 14px;
      }

      @media (max-width: 760px) {
        .form-grid {
          grid-template-columns: 1fr;
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
  csvText =
    'documentType,series,documentNumber,issueDate,counterpartyName,counterpartyVatNumber,netAmount,vatAmount,totalAmount,vatCategory\nSALES_INVOICE,A,100,2026-07-06,Demo Customer,999888777,100,24,124,VAT_24';
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

  preview(): void {
    this.submit(true);
  }

  runImport(): void {
    this.submit(false);
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
