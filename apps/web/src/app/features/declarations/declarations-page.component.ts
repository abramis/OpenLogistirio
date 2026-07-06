import { AsyncPipe, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, switchMap } from 'rxjs';
import { CompaniesApiService } from '../../core/api/companies-api.service';
import {
  DeclarationWorkpaper,
  DeclarationsApiService,
} from '../../core/api/declarations-api.service';

@Component({
  selector: 'ol-declarations-page',
  standalone: true,
  imports: [AsyncPipe, DatePipe, DecimalPipe, FormsModule, NgFor, NgIf],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Δηλωτικά workpapers</h1>
        <p class="page-subtitle">
          Προετοιμασία δηλώσεων από τα δεδομένα του γραφείου, χωρίς επίσημη υποβολή.
        </p>
      </div>
    </section>

    <div class="alert alert-success" *ngIf="message">{{ message }}</div>
    <div class="alert alert-danger" *ngIf="errorMessage">{{ errorMessage }}</div>

    <section class="card generator">
      <div class="card-header">
        <div>
          <h2 class="card-title">
            <span class="material-symbols-outlined">summarize</span> Generate ΦΠΑ workpaper
          </h2>
          <p class="card-subtitle">
            Υπολογίζει πωλήσεις, αγορές, ΦΠΑ, πιστωτικά και αποτυχίες myDATA από τα παραστατικά.
          </p>
        </div>
      </div>
      <div class="card-body form-grid">
        <label>
          Πελάτης
          <select [(ngModel)]="clientCompanyId">
            <option value="">Επιλογή</option>
            <option *ngFor="let company of companies$ | async" [value]="company.id">
              {{ company.legalName }}
            </option>
          </select>
        </label>
        <label>
          Έτος
          <input [(ngModel)]="year" type="number" />
        </label>
        <label>
          Μήνας
          <input [(ngModel)]="month" type="number" min="1" max="12" />
        </label>
        <div class="actions">
          <button class="btn btn-primary" type="button" (click)="generate()">
            <span class="material-symbols-outlined">play_arrow</span>
            Generate
          </button>
        </div>
      </div>
    </section>

    <section *ngIf="workpapers$ | async as workpapers">
      <div class="workpaper-list" *ngIf="workpapers.length > 0; else emptyWorkpapers">
        <article class="card workpaper" *ngFor="let workpaper of workpapers">
          <div class="workpaper-head">
            <div>
              <h2>{{ workpaper.title }}</h2>
              <p>
                {{ workpaper.clientCompany?.legalName || '-' }}
                <span>{{ workpaper.clientCompany?.vatNumber || '-' }}</span>
              </p>
            </div>
            <div class="workpaper-actions">
              <button class="btn btn-secondary" type="button" (click)="toggleDetails(workpaper.id)">
                <span class="material-symbols-outlined">
                  {{ expandedId === workpaper.id ? 'expand_less' : 'expand_more' }}
                </span>
                Ανάλυση
              </button>
              <button class="btn btn-secondary" type="button" (click)="exportCsv(workpaper)">
                <span class="material-symbols-outlined">download</span>
                CSV
              </button>
            </div>
          </div>

          <div class="workpaper-meta">
            <span>Περίοδος {{ periodLabel(workpaper) }}</span>
            <span>Generated {{ workpaper.generatedAt | date: 'dd/MM/yyyy HH:mm' }}</span>
            <span>{{ workpaper.totals.documentCount || 0 }} παραστατικά</span>
            <span
              class="badge"
              [class.badge-danger]="(workpaper.totals.failedMyData || 0) > 0"
              [class.badge-success]="(workpaper.totals.failedMyData || 0) === 0"
            >
              {{ workpaper.totals.failedMyData || 0 }} myDATA fails
            </span>
          </div>

          <div class="totals-strip">
            <div>
              <span>Πωλήσεις καθαρά</span>
              <strong>{{ workpaper.totals.salesNet || 0 | number: '1.2-2' }}</strong>
            </div>
            <div>
              <span>Αγορές καθαρά</span>
              <strong>{{ workpaper.totals.purchasesNet || 0 | number: '1.2-2' }}</strong>
            </div>
            <div>
              <span>ΦΠΑ εκροών</span>
              <strong>{{ workpaper.totals.salesVat || 0 | number: '1.2-2' }}</strong>
            </div>
            <div>
              <span>ΦΠΑ εισροών</span>
              <strong>{{ workpaper.totals.purchasesVat || 0 | number: '1.2-2' }}</strong>
            </div>
            <div [class.credit]="(workpaper.totals.payableVat || 0) < 0">
              <span>{{ (workpaper.totals.payableVat || 0) < 0 ? 'Πιστωτικό' : 'Πληρωτέο' }}</span>
              <strong>{{ workpaper.totals.payableVat || 0 | number: '1.2-2' }}</strong>
            </div>
          </div>

          <div class="details-grid" *ngIf="expandedId === workpaper.id">
            <div class="mini-table">
              <h3>Κατηγορίες ΦΠΑ</h3>
              <table>
                <thead>
                  <tr>
                    <th>Κατηγορία</th>
                    <th class="tr">Έσοδα</th>
                    <th class="tr">ΦΠΑ εσόδων</th>
                    <th class="tr">Έξοδα</th>
                    <th class="tr">ΦΠΑ εξόδων</th>
                    <th class="tr">Διαφορά</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let row of workpaper.totals.vatBreakdown || []">
                    <td>
                      <strong>{{ vatCategoryLabel(row.vatCategory) }}</strong>
                      <small>{{ row.documents }} παραστατικά</small>
                    </td>
                    <td class="tr">{{ row.salesNet | number: '1.2-2' }}</td>
                    <td class="tr">{{ row.salesVat | number: '1.2-2' }}</td>
                    <td class="tr">{{ row.purchasesNet | number: '1.2-2' }}</td>
                    <td class="tr">{{ row.purchasesVat | number: '1.2-2' }}</td>
                    <td class="tr" [class.credit]="row.payableVat < 0">
                      <strong>{{ row.payableVat | number: '1.2-2' }}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div
                class="empty-state compact"
                *ngIf="(workpaper.totals.vatBreakdown || []).length === 0"
              >
                Δεν υπάρχει breakdown ΦΠΑ.
              </div>
            </div>

            <div class="mini-table">
              <h3>Τύποι παραστατικών</h3>
              <table>
                <thead>
                  <tr>
                    <th>Τύπος</th>
                    <th class="tr">Καθαρή</th>
                    <th class="tr">ΦΠΑ</th>
                    <th class="tr">Σύνολο</th>
                    <th class="tr">Παρ.</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let row of workpaper.totals.documentTypeBreakdown || []">
                    <td>{{ documentTypeLabel(row.documentType) }}</td>
                    <td class="tr">{{ row.net | number: '1.2-2' }}</td>
                    <td class="tr">{{ row.vat | number: '1.2-2' }}</td>
                    <td class="tr">
                      <strong>{{ row.total | number: '1.2-2' }}</strong>
                    </td>
                    <td class="tr">{{ row.documents }}</td>
                  </tr>
                </tbody>
              </table>
              <div
                class="empty-state compact"
                *ngIf="(workpaper.totals.documentTypeBreakdown || []).length === 0"
              >
                Δεν υπάρχει breakdown παραστατικών.
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>

    <ng-template #emptyWorkpapers>
      <div class="card">
        <div class="empty-state">
          <span class="material-symbols-outlined">summarize</span>
          Δεν υπάρχουν workpapers ακόμα.
        </div>
      </div>
    </ng-template>
  `,
  styles: [
    `
      .generator {
        margin-bottom: 16px;
      }

      .form-grid {
        display: grid;
        grid-template-columns: minmax(260px, 2fr) 1fr 1fr auto;
        gap: 12px;
        align-items: end;
      }

      label {
        display: grid;
        gap: 6px;
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 700;
      }

      .workpaper-list {
        display: grid;
        gap: 14px;
      }

      .workpaper {
        padding: 16px;
      }

      .workpaper-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
      }

      .workpaper-head h2 {
        margin: 0 0 4px;
        font-size: 1rem;
      }

      .workpaper-head p,
      .workpaper-meta {
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 700;
      }

      .workpaper-head p {
        margin: 0;
      }

      .workpaper-head p span {
        margin-left: 8px;
      }

      .workpaper-actions,
      .workpaper-meta {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }

      .workpaper-meta {
        margin-bottom: 12px;
      }

      .totals-strip {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        border: 1px solid var(--border);
        border-radius: 8px;
        overflow: hidden;
      }

      .totals-strip div {
        display: grid;
        gap: 5px;
        padding: 12px;
        border-right: 1px solid var(--border);
      }

      .totals-strip div:last-child {
        border-right: none;
      }

      .totals-strip span {
        color: var(--muted);
        font-size: 0.72rem;
        font-weight: 700;
      }

      .totals-strip strong {
        font-size: 1.05rem;
      }

      .credit strong,
      .credit {
        color: var(--ok);
      }

      .details-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
        gap: 14px;
        margin-top: 14px;
      }

      .mini-table {
        min-width: 0;
      }

      .mini-table h3 {
        margin: 0 0 8px;
        font-size: 0.86rem;
      }

      .mini-table table {
        width: 100%;
      }

      .tr {
        text-align: right;
      }

      td small {
        display: block;
        margin-top: 3px;
        color: var(--muted);
      }

      .compact {
        padding: 12px;
        font-size: 0.82rem;
      }

      @media (max-width: 1080px) {
        .form-grid,
        .details-grid,
        .totals-strip {
          grid-template-columns: 1fr;
        }

        .totals-strip div {
          border-right: none;
          border-bottom: 1px solid var(--border);
        }

        .totals-strip div:last-child {
          border-bottom: none;
        }
      }

      @media (max-width: 700px) {
        .workpaper-head {
          display: grid;
        }

        .workpaper-actions {
          justify-content: stretch;
        }
      }
    `,
  ],
})
export class DeclarationsPageComponent {
  private readonly declarationsApi = inject(DeclarationsApiService);
  private readonly reload$ = new BehaviorSubject<void>(undefined);

  readonly companies$ = inject(CompaniesApiService).findAll();
  readonly workpapers$ = this.reload$.pipe(switchMap(() => this.declarationsApi.findWorkpapers()));
  clientCompanyId = '';
  year = new Date().getFullYear();
  month = new Date().getMonth() + 1;
  expandedId = '';
  message = '';
  errorMessage = '';

  generate(): void {
    this.message = '';
    this.errorMessage = '';
    this.declarationsApi
      .generateVatWorkpaper({
        clientCompanyId: this.clientCompanyId,
        year: this.year,
        month: this.month,
      })
      .subscribe({
        next: (workpaper) => {
          this.message = 'Το ΦΠΑ workpaper δημιουργήθηκε.';
          this.expandedId = workpaper.id;
          this.reload$.next();
        },
        error: (error: unknown) => this.showError(error),
      });
  }

  toggleDetails(id: string): void {
    this.expandedId = this.expandedId === id ? '' : id;
  }

  exportCsv(workpaper: DeclarationWorkpaper): void {
    const rows = [
      [
        'section',
        'label',
        'salesNet',
        'salesVat',
        'purchasesNet',
        'purchasesVat',
        'payableVat',
        'documents',
      ],
      [
        'total',
        this.periodLabel(workpaper),
        workpaper.totals.salesNet || 0,
        workpaper.totals.salesVat || 0,
        workpaper.totals.purchasesNet || 0,
        workpaper.totals.purchasesVat || 0,
        workpaper.totals.payableVat || 0,
        workpaper.totals.documentCount || 0,
      ],
      ...(workpaper.totals.vatBreakdown || []).map((row) => [
        'vatCategory',
        row.vatCategory,
        row.salesNet,
        row.salesVat,
        row.purchasesNet,
        row.purchasesVat,
        row.payableVat,
        row.documents,
      ]),
      ['section', 'documentType', 'net', 'vat', 'total', 'documents'],
      ...(workpaper.totals.documentTypeBreakdown || []).map((row) => [
        'documentType',
        row.documentType,
        row.net,
        row.vat,
        row.total,
        row.documents,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vat-workpaper-${workpaper.periodYear}-${workpaper.periodMonth || 'year'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  periodLabel(workpaper: DeclarationWorkpaper): string {
    return workpaper.periodMonth
      ? `${String(workpaper.periodMonth).padStart(2, '0')}/${workpaper.periodYear}`
      : String(workpaper.periodYear);
  }

  vatCategoryLabel(value: string): string {
    const labels: Record<string, string> = {
      VAT_24: 'ΦΠΑ 24%',
      VAT_13: 'ΦΠΑ 13%',
      VAT_6: 'ΦΠΑ 6%',
      VAT_0: 'Χωρίς ΦΠΑ',
    };

    return labels[value] ?? value;
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

  private showError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      const message = error.error?.message;
      this.errorMessage = Array.isArray(message) ? message.join(' ') : message || error.message;
      return;
    }
    this.errorMessage = 'Request failed.';
  }
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}
