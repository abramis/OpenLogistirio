import { AsyncPipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, switchMap, tap } from 'rxjs';
import { CompaniesApiService } from '../../core/api/companies-api.service';
import { ReportsApiService, VatSummaryRow } from '../../core/api/reports-api.service';

@Component({
  selector: 'ol-reports-page',
  standalone: true,
  imports: [AsyncPipe, DecimalPipe, FormsModule, NgFor, NgIf],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Reports</h1>
        <p class="page-subtitle">Σύνοψη γραφείου και ΦΠΑ reports από τα καταχωρημένα δεδομένα.</p>
      </div>
    </section>

    <section class="metrics" *ngIf="summary$ | async as summary">
      <article class="card metric">
        <span>Πελάτες</span><strong>{{ summary.clients }}</strong>
      </article>
      <article class="card metric">
        <span>Παραστατικά</span><strong>{{ summary.documents }}</strong>
      </article>
      <article class="card metric">
        <span>Υποχρεώσεις</span><strong>{{ summary.openObligations }}</strong>
      </article>
      <article class="card metric">
        <span>Πάγια</span><strong>{{ summary.activeFixedAssets }}</strong>
      </article>
      <article class="card metric danger">
        <span>myDATA fails</span><strong>{{ summary.failedMyData }}</strong>
      </article>
    </section>

    <section class="card report-filter">
      <div class="card-body filter-row">
        <label>
          Πελάτης
          <select [(ngModel)]="clientCompanyId">
            <option value="">Όλοι οι πελάτες</option>
            <option *ngFor="let company of companies$ | async" [value]="company.id">
              {{ company.legalName }} - {{ company.vatNumber }}
            </option>
          </select>
        </label>
        <label>
          Έτος ΦΠΑ report
          <input [(ngModel)]="year" type="number" min="2000" max="2200" />
        </label>
        <button class="btn btn-primary" type="button" (click)="reloadVat()">
          <span class="material-symbols-outlined">refresh</span>
          Ανανέωση
        </button>
        <button class="btn btn-secondary" type="button" (click)="exportCsv()">
          <span class="material-symbols-outlined">download</span>
          CSV
        </button>
      </div>
    </section>

    <ng-container *ngIf="vatRows$ | async as rows">
      <section class="vat-totals" *ngIf="rows.length > 0">
        <div>
          <span>Έσοδα καθαρά</span>
          <strong>{{ totals(rows).salesNet | number: '1.2-2' }}</strong>
        </div>
        <div>
          <span>Έξοδα καθαρά</span>
          <strong>{{ totals(rows).purchasesNet | number: '1.2-2' }}</strong>
        </div>
        <div>
          <span>ΦΠΑ εκροών</span>
          <strong>{{ totals(rows).salesVat | number: '1.2-2' }}</strong>
        </div>
        <div>
          <span>ΦΠΑ εισροών</span>
          <strong>{{ totals(rows).purchasesVat | number: '1.2-2' }}</strong>
        </div>
        <div [class.credit]="totals(rows).payableVat < 0">
          <span>{{ totals(rows).payableVat < 0 ? 'Πιστωτικό' : 'Πληρωτέο' }}</span>
          <strong>{{ totals(rows).payableVat | number: '1.2-2' }}</strong>
        </div>
      </section>

      <section class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Περίοδος</th>
              <th class="tr">Έσοδα καθαρά</th>
              <th class="tr">ΦΠΑ πωλήσεων</th>
              <th class="tr">Έξοδα καθαρά</th>
              <th class="tr">ΦΠΑ αγορών</th>
              <th class="tr">Πληρωτέο</th>
              <th class="tr">Παρ.</th>
              <th class="tr">myDATA fails</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of rows">
              <td>
                <strong>{{ row.period }}</strong>
              </td>
              <td class="tr">{{ row.salesNet | number: '1.2-2' }}</td>
              <td class="tr">{{ row.salesVat | number: '1.2-2' }}</td>
              <td class="tr">{{ row.purchasesNet | number: '1.2-2' }}</td>
              <td class="tr">{{ row.purchasesVat | number: '1.2-2' }}</td>
              <td class="tr" [class.credit]="row.payableVat < 0">
                <strong>{{ row.payableVat | number: '1.2-2' }}</strong>
              </td>
              <td class="tr">{{ row.documents }}</td>
              <td class="tr">
                <span
                  class="badge"
                  [class.badge-danger]="row.failedMyData > 0"
                  [class.badge-success]="row.failedMyData === 0"
                >
                  {{ row.failedMyData }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="empty-state" *ngIf="rows.length === 0">Δεν υπάρχουν δεδομένα ΦΠΑ.</div>
      </section>
    </ng-container>
  `,
  styles: [
    `
      .metrics {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }

      .metric {
        display: grid;
        gap: 8px;
        padding: 14px;
      }

      .metric span {
        color: var(--muted);
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      .metric strong {
        font-size: 1.4rem;
      }

      .metric.danger {
        border-color: var(--err-bd);
      }

      .report-filter {
        margin-bottom: 16px;
      }

      .filter-row {
        display: grid;
        grid-template-columns: minmax(260px, 2fr) minmax(130px, 1fr) auto auto;
        align-items: end;
        gap: 12px;
      }

      label {
        display: grid;
        gap: 6px;
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 700;
      }

      .vat-totals {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface);
        overflow: hidden;
        margin-bottom: 16px;
      }

      .vat-totals div {
        display: grid;
        gap: 5px;
        padding: 13px 15px;
        border-right: 1px solid var(--border);
      }

      .vat-totals div:last-child {
        border-right: none;
      }

      .vat-totals span {
        color: var(--muted);
        font-size: 0.75rem;
        font-weight: 700;
      }

      .vat-totals strong {
        font-size: 1.1rem;
      }

      .tr {
        text-align: right;
      }

      .credit,
      .credit strong {
        color: var(--ok);
      }

      @media (max-width: 980px) {
        .metrics {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .filter-row,
        .vat-totals {
          grid-template-columns: 1fr;
        }

        .vat-totals div {
          border-right: none;
          border-bottom: 1px solid var(--border);
        }

        .vat-totals div:last-child {
          border-bottom: none;
        }
      }
    `,
  ],
})
export class ReportsPageComponent {
  private readonly reportsApi = inject(ReportsApiService);
  private readonly vatReload$ = new BehaviorSubject<void>(undefined);
  private latestRows: VatSummaryRow[] = [];

  readonly companies$ = inject(CompaniesApiService).findAll();
  readonly summary$ = this.reportsApi.officeSummary();
  readonly vatRows$ = this.vatReload$.pipe(
    switchMap(() => this.reportsApi.vatSummary(this.year, this.clientCompanyId)),
    tap((rows) => {
      this.latestRows = rows;
    }),
  );
  year = new Date().getFullYear();
  clientCompanyId = '';

  reloadVat(): void {
    this.vatReload$.next();
  }

  totals(rows: VatSummaryRow[]): VatSummaryRow {
    return rows.reduce(
      (summary, row) => ({
        period: 'total',
        salesNet: roundMoney(summary.salesNet + row.salesNet),
        salesVat: roundMoney(summary.salesVat + row.salesVat),
        purchasesNet: roundMoney(summary.purchasesNet + row.purchasesNet),
        purchasesVat: roundMoney(summary.purchasesVat + row.purchasesVat),
        payableVat: roundMoney(summary.payableVat + row.payableVat),
        documents: summary.documents + row.documents,
        failedMyData: summary.failedMyData + row.failedMyData,
      }),
      {
        period: 'total',
        salesNet: 0,
        salesVat: 0,
        purchasesNet: 0,
        purchasesVat: 0,
        payableVat: 0,
        documents: 0,
        failedMyData: 0,
      },
    );
  }

  exportCsv(): void {
    const header = [
      'period',
      'salesNet',
      'salesVat',
      'purchasesNet',
      'purchasesVat',
      'payableVat',
      'documents',
      'failedMyData',
    ];
    const rows = this.latestRows.map((row) => [
      row.period,
      row.salesNet,
      row.salesVat,
      row.purchasesNet,
      row.purchasesVat,
      row.payableVat,
      row.documents,
      row.failedMyData,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vat-report-${this.year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}
