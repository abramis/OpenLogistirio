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
import {
  PeriodCloseCheck,
  PeriodCloseReview,
  PeriodClosesApiService,
} from '../../core/api/period-closes-api.service';

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

    <section class="card generator">
      <div class="card-header">
        <div>
          <h2 class="card-title">
            <span class="material-symbols-outlined">fact_check</span> Κλείσιμο περιόδου
          </h2>
          <p class="card-subtitle">
            Δημιουργεί αυτόματο checklist από λογιστική, myDATA και VAT workpaper και το
            προωθεί για έγκριση λογιστή.
          </p>
        </div>
      </div>
      <div class="card-body form-grid close-generator">
        <label>
          Πελάτης
          <select [(ngModel)]="closeClientCompanyId">
            <option value="">Επιλογή</option>
            <option *ngFor="let company of companies$ | async" [value]="company.id">
              {{ company.legalName }}
            </option>
          </select>
        </label>
        <label>
          Έτος
          <input [(ngModel)]="closeYear" type="number" />
        </label>
        <label>
          Περίοδος
          <select [(ngModel)]="closeKind">
            <option value="MONTHLY">Μήνας</option>
            <option value="QUARTERLY">Τρίμηνο</option>
          </select>
        </label>
        <label>
          {{ closeKind === 'QUARTERLY' ? 'Τελευταίος μήνας τριμήνου' : 'Μήνας' }}
          <input [(ngModel)]="closeEndMonth" type="number" min="1" max="12" />
        </label>
        <div class="actions">
          <button class="btn btn-primary" type="button" (click)="generateCloseReview()">
            Generate review
          </button>
        </div>
      </div>
    </section>

    <section *ngIf="closeReviews$ | async as reviews">
      <div class="workpaper-list close-list" *ngIf="reviews.length > 0">
        <article class="card close-review" *ngFor="let review of reviews">
          <div class="workpaper-head">
            <div>
              <h2>
                {{ review.kind === 'MONTHLY' ? 'Μηνιαίο' : 'Τριμηνιαίο' }} κλείσιμο
                {{ closePeriodLabel(review) }}
              </h2>
              <p>{{ review.clientCompany?.legalName }} — {{ review.clientCompany?.vatNumber }}</p>
            </div>
            <span class="badge">{{ closeStatusLabel(review.status) }}</span>
          </div>

          <div class="close-summary">
            <span>{{ review.reviewSummary.documentCount }} παραστατικά</span>
            <span>{{ review.reviewSummary.unpostedDocuments }} μη λογιστικοποιημένα</span>
            <span>{{ review.reviewSummary.unresolvedMyDataDocuments }} myDATA εκκρεμή</span>
            <span>{{ review.reviewSummary.reconciliationMismatches }} αποκλίσεις ΑΑΔΕ</span>
            <span>GL διαφορά {{ review.reviewSummary.journalDifference | number: '1.2-2' }} €</span>
          </div>

          <div class="checklist">
            <label class="check-row" *ngFor="let item of review.checklist">
              <input
                type="checkbox"
                [checked]="item.completed"
                [disabled]="item.automatic || !canEditReview(review)"
                (change)="toggleCloseCheck(review, item, $event)"
              />
              <span>
                <strong>{{ item.label }}</strong>
                <small>{{ item.details }}{{ item.automatic ? ' · αυτόματο' : '' }}</small>
              </span>
            </label>
          </div>

          <div class="close-actions">
            <span *ngIf="review.rejectionReason" class="rejection">
              Απόρριψη: {{ review.rejectionReason }}
            </span>
            <button
              class="btn btn-secondary"
              type="button"
              *ngIf="canEditReview(review)"
              (click)="submitCloseReview(review)"
            >
              Για έγκριση
            </button>
            <button
              class="btn btn-primary"
              type="button"
              *ngIf="review.status === 'READY_FOR_REVIEW'"
              (click)="approveCloseReview(review)"
            >
              Έγκριση λογιστή
            </button>
          </div>
        </article>
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
              <span class="badge">{{ workpaper.status }}</span>
              <button
                class="btn btn-secondary"
                type="button"
                *ngIf="workpaper.status === 'DRAFT'"
                (click)="markWorkpaperReady(workpaper)"
              >
                Για έγκριση
              </button>
              <button
                class="btn btn-primary"
                type="button"
                *ngIf="workpaper.status === 'READY'"
                (click)="approveWorkpaper(workpaper)"
              >
                Έγκριση λογιστή
              </button>
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

            <div class="mini-table reconciliation" *ngIf="workpaper.totals.myDataReconciliation as rec">
              <h3>Συμφωνία βιβλίων vs myDATA</h3>
              <table>
                <thead>
                  <tr><th></th><th class="tr">ERP</th><th class="tr">ΑΑΔΕ</th><th class="tr">Διαφορά</th></tr>
                </thead>
                <tbody>
                  <tr><td>Πωλήσεις καθαρά</td><td class="tr">{{ rec.erpSalesNet | number: '1.2-2' }}</td><td class="tr">{{ rec.aadeSalesNet | number: '1.2-2' }}</td><td class="tr">{{ rec.salesNetDelta | number: '1.2-2' }}</td></tr>
                  <tr><td>ΦΠΑ εκροών</td><td class="tr">{{ rec.erpSalesVat | number: '1.2-2' }}</td><td class="tr">{{ rec.aadeSalesVat | number: '1.2-2' }}</td><td class="tr">{{ rec.salesVatDelta | number: '1.2-2' }}</td></tr>
                  <tr><td>Αγορές καθαρά</td><td class="tr">{{ rec.erpPurchasesNet | number: '1.2-2' }}</td><td class="tr">{{ rec.aadePurchasesNet | number: '1.2-2' }}</td><td class="tr">{{ rec.purchasesNetDelta | number: '1.2-2' }}</td></tr>
                  <tr><td>ΦΠΑ εισροών</td><td class="tr">{{ rec.erpPurchasesVat | number: '1.2-2' }}</td><td class="tr">{{ rec.aadePurchasesVat | number: '1.2-2' }}</td><td class="tr">{{ rec.purchasesVatDelta | number: '1.2-2' }}</td></tr>
                </tbody>
              </table>
              <small>{{ rec.snapshotCount }} AADE snapshots · {{ rec.mismatches }} αποκλίσεις</small>
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

      .close-generator {
        grid-template-columns: minmax(220px, 2fr) 1fr 1fr 1fr auto;
      }

      .close-list {
        margin-bottom: 16px;
      }

      .close-review {
        padding: 16px;
      }

      .close-summary,
      .close-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
      }

      .close-summary span {
        padding: 5px 8px;
        border-radius: 6px;
        background: var(--surface-2);
        color: var(--muted);
        font-size: 0.75rem;
        font-weight: 700;
      }

      .checklist {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin: 12px 0;
      }

      .check-row {
        display: flex;
        grid-template: none;
        grid-template-columns: none;
        align-items: flex-start;
        gap: 8px;
        padding: 9px;
        border: 1px solid var(--border);
        border-radius: 7px;
      }

      .check-row input {
        margin-top: 2px;
      }

      .check-row span,
      .check-row small {
        display: grid;
        gap: 3px;
      }

      .check-row small,
      .reconciliation > small {
        color: var(--muted);
        font-size: 0.72rem;
      }

      .close-actions {
        justify-content: flex-end;
      }

      .rejection {
        margin-right: auto;
        color: var(--err);
        font-size: 0.78rem;
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
        .totals-strip,
        .close-generator,
        .checklist {
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
  private readonly periodClosesApi = inject(PeriodClosesApiService);
  private readonly closeReload$ = new BehaviorSubject<void>(undefined);

  readonly companies$ = inject(CompaniesApiService).findAll();
  readonly workpapers$ = this.reload$.pipe(switchMap(() => this.declarationsApi.findWorkpapers()));
  readonly closeReviews$ = this.closeReload$.pipe(
    switchMap(() => this.periodClosesApi.findAll()),
  );
  clientCompanyId = '';
  year = new Date().getFullYear();
  month = new Date().getMonth() + 1;
  expandedId = '';
  message = '';
  errorMessage = '';
  closeClientCompanyId = '';
  closeYear = new Date().getFullYear();
  closeKind: 'MONTHLY' | 'QUARTERLY' = 'MONTHLY';
  closeEndMonth = new Date().getMonth() + 1;

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

  generateCloseReview(): void {
    this.clearMessages();
    this.periodClosesApi
      .generate({
        clientCompanyId: this.closeClientCompanyId,
        year: this.closeYear,
        kind: this.closeKind,
        endMonth: this.closeEndMonth,
      })
      .subscribe({
        next: () => {
          this.message = 'Το checklist κλεισίματος δημιουργήθηκε.';
          this.closeReload$.next();
        },
        error: (error: unknown) => this.showError(error),
      });
  }

  toggleCloseCheck(
    review: PeriodCloseReview,
    item: PeriodCloseCheck,
    event: Event,
  ): void {
    const completed = (event.target as HTMLInputElement).checked;
    this.clearMessages();
    this.periodClosesApi.updateChecklist(review.id, { code: item.code, completed }).subscribe({
      next: () => this.closeReload$.next(),
      error: (error: unknown) => this.showError(error),
    });
  }

  submitCloseReview(review: PeriodCloseReview): void {
    this.clearMessages();
    this.periodClosesApi.submit(review.id).subscribe({
      next: () => {
        this.message = 'Το κλείσιμο στάλθηκε για έγκριση.';
        this.closeReload$.next();
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  approveCloseReview(review: PeriodCloseReview): void {
    this.clearMessages();
    this.periodClosesApi.approve(review.id).subscribe({
      next: () => {
        this.message = 'Το κλείσιμο εγκρίθηκε από λογιστή.';
        this.closeReload$.next();
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  markWorkpaperReady(workpaper: DeclarationWorkpaper): void {
    this.clearMessages();
    this.declarationsApi.markReady(workpaper.id).subscribe({
      next: () => {
        this.message = 'Το workpaper στάλθηκε για έγκριση.';
        this.reload$.next();
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  approveWorkpaper(workpaper: DeclarationWorkpaper): void {
    this.clearMessages();
    this.declarationsApi.approve(workpaper.id).subscribe({
      next: () => {
        this.message = 'Το workpaper εγκρίθηκε.';
        this.reload$.next();
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  canEditReview(review: PeriodCloseReview): boolean {
    return review.status === 'DRAFT' || review.status === 'REJECTED';
  }

  closePeriodLabel(review: PeriodCloseReview): string {
    return review.startMonth === review.endMonth
      ? `${String(review.endMonth).padStart(2, '0')}/${review.periodYear}`
      : `${String(review.startMonth).padStart(2, '0')}–${String(review.endMonth).padStart(2, '0')}/${review.periodYear}`;
  }

  closeStatusLabel(status: PeriodCloseReview['status']): string {
    const labels: Record<PeriodCloseReview['status'], string> = {
      DRAFT: 'Πρόχειρο',
      READY_FOR_REVIEW: 'Για έγκριση',
      APPROVED: 'Εγκεκριμένο',
      REJECTED: 'Απορρίφθηκε',
    };
    return labels[status];
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

  private clearMessages(): void {
    this.message = '';
    this.errorMessage = '';
  }
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}
