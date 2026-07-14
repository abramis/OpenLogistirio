import { AsyncPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import readXlsxFile from 'read-excel-file/browser';
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
        <p class="page-subtitle">
          Μαζική εισαγωγή πολυγραμμικών παραστατικών από CSV ή Excel exports παλιών συστημάτων.
        </p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" type="button" (click)="downloadCsvTemplate()">
          <span class="material-symbols-outlined">download</span>
          Template για Excel / CSV
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
            Παραστατικά CSV / Excel
          </h2>
          <p class="card-subtitle">
            Κάθε γραμμή μπορεί να είναι μία γραμμή παραστατικού: επαναλάβετε τα στοιχεία header και
            συμπληρώστε τα πεδία <code>line*</code> για πολυγραμμικό παραστατικό. Υποστηρίζεται CSV
            και το πρώτο φύλλο αρχείου <code>.xlsx</code>.
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
          Αρχείο CSV ή Excel
          <input type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" (change)="readFile($event)" />
        </label>
        <label class="wide">
          Δεδομένα εισαγωγής
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
              <th>Πεδίο</th>
              <th>Τύπος</th>
              <th>Σφάλμα</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let error of lastResult.errors">
              <td>{{ error.rowNumber }}</td>
              <td>{{ error.field || '-' }}</td>
              <td>{{ error.code }}</td>
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
            <th></th>
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
            <td class="tr">
              <button
                class="btn btn-secondary btn-small"
                type="button"
                *ngIf="batch.failedRows > 0"
                (click)="downloadErrorReport(batch)"
              >
                Errors CSV
              </button>
              <button
                class="btn btn-danger btn-small"
                type="button"
                *ngIf="batch.status === 'COMPLETED'"
                (click)="rollback(batch)"
              >
                Rollback
              </button>
            </td>
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

      .btn-small {
        min-height: 30px;
        margin-left: 5px;
        padding: 4px 7px;
        font-size: 0.72rem;
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

  async readFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.errorMessage = '';
    try {
      this.fileName = file.name;
      this.csvText = isExcelFile(file)
        ? await csvFromWorkbook(file)
        : await file.text();
    } catch (error: unknown) {
      this.showError(error);
    }
  }

  loadSample(): void {
    this.csvText = documentsCsvTemplate();
  }

  downloadCsvTemplate(): void {
    const blob = new Blob([documentsCsvTemplate()], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, 'documents-import-template.csv');
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
      ROLLED_BACK: 'Ανακλήθηκε',
    };

    return labels[status] ?? status;
  }

  previewIssueDate(row: Record<string, unknown>): string | number | Date | null {
    const value = row['issueDate'];
    return typeof value === 'string' || typeof value === 'number' || value instanceof Date
      ? value
      : null;
  }

  downloadErrorReport(batch: { id: string; fileName?: string | null }): void {
    this.importsApi.errorReportCsv(batch.id).subscribe({
      next: (csv) => {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${batch.fileName || 'import'}-errors.csv`;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  rollback(batch: { id: string }): void {
    this.message = '';
    this.errorMessage = '';
    this.importsApi.rollback(batch.id).subscribe({
      next: () => {
        this.message = 'Το import ανακλήθηκε. Τα παραστατικά του batch διαγράφηκαν λογικά.';
        this.reload$.next();
      },
      error: (error: unknown) => this.showError(error),
    });
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
  const headers = documentsImportHeaders();
  return [
    headers.join(','),
    ...documentsImportRows().map((row) =>
      headers.map((header) => csvCell(row[header] ?? '')).join(','),
    ),
  ].join('\n');
}

function documentsImportHeaders(): string[] {
  return [
    'documentType', 'series', 'documentNumber', 'issueDate', 'counterpartyName',
    'counterpartyVatNumber', 'movementCode', 'journalCode', 'netAmount', 'vatAmount',
    'totalAmount', 'vatCategory', 'paymentMethodType', 'paymentNumber', 'paymentType',
    'paymentAmount', 'paymentMethodInfo', 'paymentTransactionId', 'paymentTid',
    'paymentProviderSigningAuthor', 'paymentProviderSignature', 'paymentEcrSigningAuthor',
    'paymentEcrSessionNumber', 'withheldAmount', 'withheldCategory', 'feesAmount',
    'feesCategory', 'stampDutyAmount', 'stampDutyCategory', 'otherTaxesAmount',
    'otherTaxesCategory', 'deductionsAmount', 'lineItemCode', 'lineDescription',
    'lineQuantity', 'lineMeasurementUnit', 'lineUnitPrice', 'lineNetAmount', 'lineVatAmount',
    'lineVatCategory', 'lineVatExemptionCategory', 'lineDiscountAmount',
    'lineDiscountOption', 'lineWithheldAmount', 'lineWithheldCategory', 'lineFeesAmount',
    'lineFeesCategory', 'lineStampDutyAmount', 'lineStampDutyCategory', 'lineOtherTaxesAmount',
    'lineOtherTaxesCategory', 'lineDeductionsAmount', 'lineIncomeClassificationType',
    'lineIncomeClassificationCategory', 'lineExpenseClassificationType',
    'lineExpenseClassificationCategory', 'lineVatClassificationType',
  ];
}

function documentsImportRows(): Array<Record<string, string | number>> {
  return [
    {
      documentType: 'SALES_INVOICE', series: 'A', documentNumber: '100', issueDate: '2026-07-06',
      counterpartyName: 'Demo Customer', counterpartyVatNumber: '999888777',
      movementCode: 'SALE_INVOICE', journalCode: 'SALES', netAmount: 150, vatAmount: 30,
      totalAmount: 180, vatCategory: 'MULTIPLE', paymentMethodType: 7, paymentNumber: 1,
      paymentType: 7, paymentAmount: 180, paymentMethodInfo: 'POS front desk',
      paymentTransactionId: 'TX-100', paymentTid: 'TID-1', paymentProviderSigningAuthor: 'PROVIDER',
      paymentProviderSignature: 'signature', paymentEcrSigningAuthor: 'ECR-1',
      paymentEcrSessionNumber: '123456', lineItemCode: 'SERV-1', lineDescription: 'Υπηρεσία 24%',
      lineQuantity: 1, lineMeasurementUnit: 7, lineUnitPrice: 100, lineNetAmount: 100,
      lineVatAmount: 24, lineVatCategory: 'VAT_24', lineIncomeClassificationType: 'E3_561_001',
      lineIncomeClassificationCategory: 'category1_1', lineVatClassificationType: 'VAT_361',
    },
    {
      documentType: 'SALES_INVOICE', series: 'A', documentNumber: '100', issueDate: '2026-07-06',
      counterpartyName: 'Demo Customer', counterpartyVatNumber: '999888777',
      movementCode: 'SALE_INVOICE', journalCode: 'SALES', netAmount: 150, vatAmount: 30,
      totalAmount: 180, vatCategory: 'MULTIPLE', lineItemCode: 'BOOK-1',
      lineDescription: 'Έντυπο 6%', lineQuantity: 2, lineMeasurementUnit: 1, lineUnitPrice: 25,
      lineNetAmount: 50, lineVatAmount: 6, lineVatCategory: 'VAT_6',
      lineIncomeClassificationType: 'E3_561_001', lineIncomeClassificationCategory: 'category1_1',
      lineVatClassificationType: 'VAT_363',
    },
    {
      documentType: 'PURCHASE_INVOICE', series: 'B', documentNumber: '42', issueDate: '2026-07-08',
      counterpartyName: 'Demo Supplier', counterpartyVatNumber: '123123123',
      movementCode: 'PURCHASE_INVOICE', journalCode: 'PURCHASES', netAmount: 50, vatAmount: 12,
      totalAmount: 62, vatCategory: 'VAT_24', paymentMethodType: 3, paymentNumber: 1,
      paymentType: 3, paymentAmount: 62, lineItemCode: 'OFFICE-1', lineDescription: 'Γραφική ύλη',
      lineQuantity: 1, lineMeasurementUnit: 1, lineUnitPrice: 50, lineNetAmount: 50,
      lineVatAmount: 12, lineVatCategory: 'VAT_24', lineExpenseClassificationType: 'E3_102_001',
      lineExpenseClassificationCategory: 'category2_4', lineVatClassificationType: 'VAT_361',
    },
  ];
}

function csvCell(value: unknown): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function isExcelFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.xlsx');
}

async function csvFromWorkbook(file: File): Promise<string> {
  const rows = (await readXlsxFile(file))[0]?.data ?? [];
  const nonEmptyRows = rows.filter((row) => row.some((cell) => cell !== null && cell !== ''));
  if (nonEmptyRows.length === 0) {
    throw new Error('Το πρώτο φύλλο Excel είναι κενό.');
  }
  return nonEmptyRows
    .map((row) => row.map((cell) => csvCell(excelCellValue(cell))).join(','))
    .join('\n');
}

function excelCellValue(value: unknown): string | number | boolean {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return value == null ? '' : String(value);
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
