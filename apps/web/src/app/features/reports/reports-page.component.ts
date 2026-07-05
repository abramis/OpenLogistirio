import { AsyncPipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, switchMap } from 'rxjs';
import { ReportsApiService } from '../../core/api/reports-api.service';

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
          Έτος ΦΠΑ report
          <input [(ngModel)]="year" type="number" />
        </label>
        <button class="btn btn-primary" type="button" (click)="reloadVat()">Ανανέωση</button>
      </div>
    </section>

    <section class="table-wrap" *ngIf="vatRows$ | async as rows">
      <table>
        <thead>
          <tr>
            <th>Περίοδος</th>
            <th>ΦΠΑ πωλήσεων</th>
            <th>ΦΠΑ αγορών</th>
            <th>Πληρωτέο</th>
            <th>Παραστατικά</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let row of rows">
            <td>
              <strong>{{ row.period }}</strong>
            </td>
            <td>{{ row.salesVat | number: '1.2-2' }}</td>
            <td>{{ row.purchasesVat | number: '1.2-2' }}</td>
            <td>{{ row.payableVat | number: '1.2-2' }}</td>
            <td>{{ row.documents }}</td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" *ngIf="rows.length === 0">Δεν υπάρχουν δεδομένα ΦΠΑ.</div>
    </section>
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
        display: flex;
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

      @media (max-width: 980px) {
        .metrics {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `,
  ],
})
export class ReportsPageComponent {
  private readonly reportsApi = inject(ReportsApiService);
  private readonly vatReload$ = new BehaviorSubject<void>(undefined);

  readonly summary$ = this.reportsApi.officeSummary();
  readonly vatRows$ = this.vatReload$.pipe(switchMap(() => this.reportsApi.vatSummary(this.year)));
  year = new Date().getFullYear();

  reloadVat(): void {
    this.vatReload$.next();
  }
}
