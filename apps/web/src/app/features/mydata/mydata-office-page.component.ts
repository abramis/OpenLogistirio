import { DatePipe, DecimalPipe, NgClass, NgFor, NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  MyDataApiService,
  MyDataEnvironmentInfo,
  MyDataPurchasePreview,
  MyDataReconciliationItem,
  MyDataSnapshotCandidate,
  OfficeMyDataCompanySummary,
  OfficeMyDataDashboard,
} from '../../core/api/mydata-api.service';

type SyncSource = 'BOTH' | 'REQUEST_DOCS' | 'REQUEST_TRANSMITTED_DOCS';

@Component({
  selector: 'ol-mydata-office-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, NgClass, NgFor, NgIf, RouterLink],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">myDATA — Ημερήσια συμφωνία γραφείου</h1>
        <p class="page-subtitle">
          Εισερχόμενα, εξερχόμενα και αποκλίσεις όλων των εξουσιοδοτημένων πελατών.
        </p>
      </div>
      <span class="environment-badge" *ngIf="environment" [ngClass]="environmentClass()">
        {{ environmentLabel() }}
      </span>
    </section>

    <div class="alert alert-success" *ngIf="message">{{ message }}</div>
    <div class="alert alert-danger" *ngIf="errorMessage">{{ errorMessage }}</div>

    <section class="card controls-card filter-bar">
      <div class="card-header">
        <div>
          <h2 class="card-title">
            <span class="material-symbols-outlined">tune</span>
            Πεδίο ελέγχου
          </h2>
          <p class="card-subtitle">Ορίστε περίοδο και ροή πριν από τη λήψη από ΑΑΔΕ.</p>
        </div>
      </div>
      <div class="card-body controls">
        <label>
          Περίοδος από
          <input type="date" [(ngModel)]="dateFrom" />
        </label>
        <label>
          έως
          <input type="date" [(ngModel)]="dateTo" />
        </label>
        <label>
          Ροή
          <select [(ngModel)]="source">
            <option value="BOTH">Εισερχόμενα και εξερχόμενα</option>
            <option value="REQUEST_DOCS">Μόνο εισερχόμενα</option>
            <option value="REQUEST_TRANSMITTED_DOCS">Μόνο εξερχόμενα</option>
          </select>
        </label>
        <label>
          Προβολή
          <select [(ngModel)]="statusFilter" (ngModelChange)="reload()">
            <option value="">Όλες οι εκκρεμότητες</option>
            <option value="MISSING_INTERNAL">Λείπουν στην πλατφόρμα</option>
            <option value="AMOUNT_MISMATCH">Διαφορά ποσών</option>
            <option value="DATE_MISMATCH">Διαφορά ημερομηνίας</option>
            <option value="TYPE_MISMATCH">Διαφορά τύπου</option>
            <option value="COUNTERPARTY_MISMATCH">Διαφορά ΑΦΜ</option>
          </select>
        </label>
        <button class="btn btn-secondary" type="button" [disabled]="busy" (click)="reload()">
          Ανανέωση εικόνας
        </button>
        <button class="btn btn-primary" type="button" [disabled]="busy" (click)="syncOffice()">
          <span class="material-symbols-outlined">cloud_sync</span>
          {{ busy ? 'Συγχρονισμός...' : 'Λήψη από ΑΑΔΕ' }}
        </button>
      </div>
      <p class="read-note">
        Η ενέργεια είναι μόνο ανάγνωση από ΑΑΔΕ. Δεν εκδίδει, δεν ακυρώνει και δεν χαρακτηρίζει
        παραστατικά.
      </p>
    </section>

    <section class="summary-grid" *ngIf="dashboard as data">
      <article class="metric-card">
        <span>Πελάτες με εξουσιοδότηση</span>
        <strong>{{ data.overview.authorizedCompanyCount }}/{{ data.overview.companyCount }}</strong>
      </article>
      <article class="metric-card">
        <span>Εγγραφές περιόδου</span>
        <strong>{{ data.overview.totalCount }}</strong>
      </article>
      <article class="metric-card success">
        <span>Συμφωνημένες</span>
        <strong>{{ data.overview.matchedCount }}</strong>
      </article>
      <article class="metric-card warning">
        <span>Λείπουν εσωτερικά</span>
        <strong>{{ data.overview.missingInternalCount }}</strong>
      </article>
      <article class="metric-card danger">
        <span>Διαφορές</span>
        <strong>{{ data.overview.mismatchCount }}</strong>
      </article>
      <article class="metric-card warning">
        <span>Πελάτες για έλεγχο σήμερα</span>
        <strong>{{ data.overview.companiesNeedingReviewCount }}</strong>
        <small *ngIf="data.overview.failedSyncCountLast24Hours">
          {{ data.overview.failedSyncCountLast24Hours }} αποτυχημένα sync / 24ωρο
        </small>
      </article>
    </section>

    <section class="table-wrap" *ngIf="dashboard as data">
      <div class="table-heading">
        <div>
          <h2>Εικόνα ανά πελάτη</h2>
          <small>Πρώτα εμφανίζονται όσοι χρειάζονται λογιστικό έλεγχο.</small>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Πελάτης</th>
            <th>Εξουσιοδότηση</th>
            <th>Εγγραφές</th>
            <th>Συμφωνία</th>
            <th>Λείπουν</th>
            <th>Διαφορές</th>
            <th>Τελευταίο sync</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let company of sortedCompanies(data.companies)">
            <td>
              <a [routerLink]="['/companies', company.id]"
                ><strong>{{ company.legalName }}</strong></a
              >
              <small>{{ company.vatNumber }}</small>
            </td>
            <td>
              <span class="badge" [ngClass]="company.apiReady ? 'badge-success' : 'badge-warning'">
                {{ company.apiReady ? 'Ενεργή' : 'Εκκρεμεί' }}
              </span>
            </td>
            <td>{{ company.totalCount }}</td>
            <td>{{ company.matchedCount }}</td>
            <td>{{ company.missingInternalCount }}</td>
            <td>
              <strong [class.danger-text]="company.mismatchCount > 0">{{
                company.mismatchCount
              }}</strong>
            </td>
            <td>{{ lastSyncAt(company) | date: 'dd/MM/yyyy HH:mm' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="table-wrap exceptions" *ngIf="dashboard as data">
      <div class="table-heading">
        <div>
          <h2>Ουρά λογιστικού ελέγχου</h2>
          <small>{{ data.exceptions.length }} εκκρεμότητες με τα επιλεγμένα φίλτρα.</small>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Πελάτης</th>
            <th>Ημερομηνία</th>
            <th>Παραστατικό ΑΑΔΕ</th>
            <th>Ροή</th>
            <th>Αξία</th>
            <th>Αιτία</th>
            <th>Εσωτερικό match</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let item of data.exceptions">
            <td>
              <a [routerLink]="['/companies', item.clientCompany.id]">{{
                item.clientCompany.legalName
              }}</a>
            </td>
            <td>{{ item.issueDate | date: 'dd/MM/yyyy' }}</td>
            <td>
              <strong>{{ item.series || '-' }}/{{ item.documentNumber }}</strong>
              <small>MARK {{ item.mark }}</small>
            </td>
            <td>{{ sourceLabel(item.source) }}</td>
            <td>{{ item.totalAmount | number: '1.2-2' }} €</td>
            <td>
              <span class="badge badge-warning">{{ statusLabel(item.reconciliationStatus) }}</span>
              <small>{{ issueFields(item) }}</small>
            </td>
            <td>
              <span *ngIf="!item.matchedDocument">Δεν βρέθηκε</span>
              <a *ngIf="item.matchedDocument" [routerLink]="['/documents']">
                {{ item.matchedDocument.series || '-' }}/{{ item.matchedDocument.documentNumber }}
              </a>
            </td>
            <td class="row-actions">
              <button
                *ngIf="canAutoCreate(item)"
                class="btn btn-xs btn-primary"
                type="button"
                [disabled]="busy"
                (click)="openPurchasePreview(item)"
              >
                Δημιουργία αγοράς
              </button>
              <button
                class="btn btn-xs btn-secondary"
                type="button"
                [disabled]="busy"
                (click)="openCandidates(item)"
              >
                Manual match
              </button>
              <button
                class="btn btn-xs btn-danger"
                type="button"
                [disabled]="busy"
                (click)="ignore(item)"
              >
                Αγνόηση
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" *ngIf="data.exceptions.length === 0">
        Δεν υπάρχουν εκκρεμότητες για τα επιλεγμένα φίλτρα.
      </div>
    </section>

    <section class="card purchase-preview-card" *ngIf="purchasePreview as preview">
      <div class="card-header">
        <div>
          <h2 class="card-title">Προεπισκόπηση παραστατικού αγοράς</h2>
          <p class="card-subtitle">
            {{ preview.supplier.name }} — {{ preview.series || '-' }}/{{ preview.documentNumber }}
          </p>
        </div>
        <button class="btn btn-xs btn-secondary" type="button" (click)="closePurchasePreview()">
          Κλείσιμο
        </button>
      </div>
      <div class="card-body preview-body">
        <div class="preview-summary">
          <span><small>Καθαρή αξία</small><strong>{{ preview.totals.netAmount | number: '1.2-2' }} €</strong></span>
          <span><small>ΦΠΑ</small><strong>{{ preview.totals.vatAmount | number: '1.2-2' }} €</strong></span>
          <span><small>Σύνολο</small><strong>{{ preview.totals.totalAmount | number: '1.2-2' }} €</strong></span>
          <span><small>Γραμμές</small><strong>{{ preview.lines.length }}</strong></span>
        </div>
        <div class="alert alert-danger" *ngIf="preview.possibleDuplicate">
          Βρέθηκε πιθανό διπλό {{ preview.possibleDuplicate.series || '-' }}/{{
            preview.possibleDuplicate.documentNumber
          }}. Χρησιμοποιήστε manual match.
        </div>
        <div class="preview-table">
          <table>
            <thead>
              <tr><th>#</th><th>Περιγραφή</th><th>Καθαρή</th><th>ΦΠΑ</th><th>Σύνολο</th><th>Χαρακτηρισμός</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let line of preview.lines">
                <td>{{ line.lineNumber }}</td>
                <td>{{ line.description }}</td>
                <td>{{ line.netAmount | number: '1.2-2' }} €</td>
                <td>{{ line.vatRate | number: '1.0-2' }}% · {{ line.vatAmount | number: '1.2-2' }} €</td>
                <td>{{ line.totalAmount | number: '1.2-2' }} €</td>
                <td>{{ line.expenseClassificationType || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="preview-actions">
          <span>Η δημιουργία είναι εσωτερική και δεν στέλνει δεδομένα στην ΑΑΔΕ.</span>
          <button class="btn btn-primary" type="button" [disabled]="busy || !preview.canCreate" (click)="createPurchaseFromPreview()">
            Επιβεβαίωση δημιουργίας
          </button>
        </div>
      </div>
    </section>

    <section class="card candidate-card" *ngIf="matchingItem as item">
      <div class="card-header">
        <div>
          <h2 class="card-title">Υποψήφια εσωτερικά παραστατικά</h2>
          <p class="card-subtitle">
            Για {{ item.clientCompany.legalName }} — {{ item.series || '-' }}/{{
              item.documentNumber
            }}
          </p>
        </div>
        <button class="btn btn-xs btn-secondary" type="button" (click)="closeCandidates()">
          Κλείσιμο
        </button>
      </div>
      <div class="card-body candidate-list">
        <div *ngFor="let candidate of candidates">
          <span>
            <strong>{{ candidate.series || '-' }}/{{ candidate.documentNumber }}</strong>
            {{ candidate.issueDate | date: 'dd/MM/yyyy' }} —
            {{ candidate.counterpartyName || candidate.counterpartyVatNumber || '-' }}
          </span>
          <span>{{ candidate.totalAmount | number: '1.2-2' }} €</span>
          <button class="btn btn-xs btn-primary" type="button" (click)="match(item, candidate)">
            Σύνδεση
          </button>
        </div>
        <div class="empty-state" *ngIf="candidates.length === 0">
          Δεν βρέθηκαν υποψήφια παραστατικά σε διάστημα ±7 ημερών.
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .environment-badge {
        padding: 7px 11px;
        border-radius: 999px;
        font-weight: 700;
        font-size: 0.8rem;
      }
      .environment-production-read {
        color: #166534;
        background: #dcfce7;
      }
      .environment-production-write {
        color: #991b1b;
        background: #fee2e2;
      }
      .environment-test {
        color: #854d0e;
        background: #fef9c3;
      }
      .controls-card {
        margin-bottom: 18px;
      }
      .controls {
        display: grid;
        grid-template-columns: repeat(4, minmax(150px, 1fr)) auto auto;
        gap: 10px;
        align-items: end;
      }
      label {
        display: grid;
        gap: 5px;
        color: var(--muted);
        font-size: 0.76rem;
        font-weight: 700;
      }
      .read-note {
        margin: 0;
        padding: 10px 18px;
        border-top: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.45);
        color: var(--text-2);
        font-size: 0.78rem;
      }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 12px;
        margin-bottom: 16px;
      }
      .metric-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        padding: 15px;
        display: grid;
        gap: 6px;
        box-shadow: var(--shadow-sm);
      }
      .metric-card span {
        color: var(--muted);
        font-size: 0.78rem;
      }
      .metric-card strong {
        font-size: 1.45rem;
      }
      .metric-card.success {
        border-left: 4px solid #16a34a;
      }
      .metric-card.warning {
        border-left: 4px solid #d97706;
      }
      .metric-card.danger {
        border-left: 4px solid #dc2626;
      }
      .table-heading {
        padding: 14px 16px;
        border-bottom: 1px solid var(--border);
        background: var(--surface-2);
      }
      .table-heading h2 {
        margin: 0 0 3px;
        font-size: 1rem;
      }
      .table-heading small,
      td small {
        display: block;
        color: var(--muted);
        margin-top: 2px;
      }
      .exceptions {
        margin-top: 16px;
      }
      .danger-text {
        color: var(--danger);
      }
      .row-actions {
        display: flex;
        gap: 5px;
        justify-content: flex-end;
        min-width: 270px;
      }
      .candidate-card {
        margin-top: 16px;
      }
      .purchase-preview-card {
        margin-top: 16px;
        border-left: 4px solid var(--primary);
      }
      .preview-body {
        display: grid;
        gap: 14px;
      }
      .preview-summary {
        display: grid;
        grid-template-columns: repeat(4, minmax(120px, 1fr));
        gap: 8px;
      }
      .preview-summary span {
        display: grid;
        gap: 3px;
        padding: 10px;
        border-radius: var(--radius-sm);
        background: var(--surface-2);
      }
      .preview-summary small {
        color: var(--muted);
      }
      .preview-table {
        overflow-x: auto;
      }
      .preview-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        color: var(--text-2);
        font-size: 0.82rem;
      }
      .candidate-list {
        display: grid;
        gap: 8px;
      }
      .candidate-list > div:not(.empty-state) {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 120px auto;
        align-items: center;
        gap: 10px;
        padding: 8px;
        border-bottom: 1px solid var(--border);
      }
      @media (max-width: 1100px) {
        .controls,
        .summary-grid,
        .preview-summary {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 680px) {
        .controls,
        .summary-grid,
        .preview-summary {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class MyDataOfficePageComponent implements OnInit {
  private readonly api = inject(MyDataApiService);

  environment?: MyDataEnvironmentInfo;
  dashboard?: OfficeMyDataDashboard;
  dateFrom = firstDayOfCurrentMonth();
  dateTo = today();
  source: SyncSource = 'BOTH';
  statusFilter = '';
  busy = false;
  matchingItem?: OfficeMyDataDashboard['exceptions'][number];
  candidates: MyDataSnapshotCandidate[] = [];
  purchasePreview?: MyDataPurchasePreview;
  message = '';
  errorMessage = '';

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    forkJoin({
      environment: this.api.environment(),
      dashboard: this.api.officeDashboard({
        dateFrom: this.dateFrom,
        dateTo: this.dateTo,
        source: this.source === 'BOTH' ? undefined : this.source,
        status: this.statusFilter || undefined,
        take: 200,
      }),
    }).subscribe({
      next: ({ environment, dashboard }) => {
        this.environment = environment;
        this.dashboard = dashboard;
        this.errorMessage = '';
      },
      error: (error) => this.handleError(error),
    });
  }

  syncOffice(): void {
    if (this.environment?.environment === 'production' && !this.environment.productionReadEnabled) {
      this.errorMessage = 'Η production ανάγνωση myDATA είναι απενεργοποιημένη.';
      return;
    }
    this.busy = true;
    this.message = '';
    this.errorMessage = '';
    this.api
      .syncOffice({
        sources:
          this.source === 'BOTH' ? ['REQUEST_DOCS', 'REQUEST_TRANSMITTED_DOCS'] : [this.source],
        dateFrom: this.dateFrom,
        dateTo: this.dateTo,
        maxPages: 10,
      })
      .subscribe({
        next: (result) => {
          this.busy = false;
          this.message =
            `Ολοκληρώθηκαν ${result.completedCount}/${result.flowCount} ροές. ` +
            `Λήφθηκαν ${result.fetchedCount}, συμφωνήθηκαν ${result.matchedCount}, ` +
            `εκκρεμούν ${result.mismatchCount}.`;
          if (result.failedCount > 0) {
            this.errorMessage = `${result.failedCount} ροές απέτυχαν και χρειάζονται έλεγχο.`;
          }
          this.reload();
        },
        error: (error) => {
          this.busy = false;
          this.handleError(error);
        },
      });
  }

  sortedCompanies(companies: OfficeMyDataCompanySummary[]) {
    return [...companies].sort(
      (a, b) =>
        b.mismatchCount + b.missingInternalCount - (a.mismatchCount + a.missingInternalCount) ||
        a.legalName.localeCompare(b.legalName, 'el'),
    );
  }

  lastSyncAt(company: OfficeMyDataCompanySummary): string | undefined {
    const dates = [
      company.lastReceivedSync?.createdAt,
      company.lastTransmittedSync?.createdAt,
    ].filter((value): value is string => Boolean(value));
    return dates.sort().at(-1);
  }

  environmentLabel(): string {
    if (!this.environment) return '';
    if (this.environment.productionWriteEnabled) return 'AADE production — writes ενεργά';
    if (this.environment.productionReadEnabled) return 'AADE production — μόνο ανάγνωση';
    return this.environment.environment === 'test' ? 'AADE test' : 'AADE production — κλειδωμένο';
  }

  environmentClass(): string {
    if (this.environment?.productionWriteEnabled) return 'environment-production-write';
    if (this.environment?.productionReadEnabled) return 'environment-production-read';
    return 'environment-test';
  }

  sourceLabel(source: string): string {
    return source === 'REQUEST_DOCS' ? 'Εισερχόμενο' : 'Εξερχόμενο';
  }

  statusLabel(status: string): string {
    return (
      {
        MISSING_INTERNAL: 'Λείπει στην πλατφόρμα',
        AMOUNT_MISMATCH: 'Διαφορά ποσών',
        DATE_MISMATCH: 'Διαφορά ημερομηνίας',
        TYPE_MISMATCH: 'Διαφορά τύπου',
        COUNTERPARTY_MISMATCH: 'Διαφορά ΑΦΜ',
        MATCHED: 'Συμφωνεί',
      }[status] ?? status
    );
  }

  issueFields(item: MyDataReconciliationItem): string {
    return [
      ...(item.reconciliationIssues?.fields ?? []),
      ...(item.reconciliationIssues?.missing ?? []),
    ].join(', ');
  }

  canAutoCreate(item: MyDataReconciliationItem): boolean {
    return item.source === 'REQUEST_DOCS' && !item.invoiceType?.startsWith('5.');
  }

  openPurchasePreview(item: OfficeMyDataDashboard['exceptions'][number]): void {
    this.busy = true;
    this.purchasePreview = undefined;
    this.api.previewPurchaseFromSnapshot(item.id).subscribe({
      next: (preview) => {
        this.busy = false;
        this.purchasePreview = preview;
      },
      error: (error) => {
        this.busy = false;
        this.handleError(error);
      },
    });
  }

  closePurchasePreview(): void {
    this.purchasePreview = undefined;
  }

  createPurchaseFromPreview(): void {
    const preview = this.purchasePreview;
    if (!preview?.canCreate) return;
    const label = (preview.series || '-') + '/' + preview.documentNumber;
    if (!confirm('Να δημιουργηθεί το ελεγμένο παραστατικό αγοράς ' + label + ';')) return;
    this.busy = true;
    this.api.createPurchaseFromSnapshot(preview.snapshotId).subscribe({
      next: () => {
        this.busy = false;
        this.closePurchasePreview();
        this.message = 'Δημιουργήθηκε παραστατικό αγοράς και συνδέθηκε με το MARK της ΑΑΔΕ.';
        this.reload();
      },
      error: (error) => {
        this.busy = false;
        this.handleError(error);
      },
    });
  }

  createPurchase(item: OfficeMyDataDashboard['exceptions'][number]): void {
    if (
      !confirm(
        `Να δημιουργηθεί παραστατικό αγοράς για ${item.series || '-'}/${item.documentNumber};`,
      )
    ) {
      return;
    }
    this.busy = true;
    this.api.createPurchaseFromSnapshot(item.id).subscribe({
      next: () => {
        this.busy = false;
        this.message = 'Δημιουργήθηκε παραστατικό αγοράς και συνδέθηκε με το MARK της ΑΑΔΕ.';
        this.reload();
      },
      error: (error) => {
        this.busy = false;
        this.handleError(error);
      },
    });
  }

  openCandidates(item: OfficeMyDataDashboard['exceptions'][number]): void {
    this.matchingItem = item;
    this.candidates = [];
    this.api.snapshotCandidates(item.id).subscribe({
      next: (candidates) => (this.candidates = candidates),
      error: (error) => this.handleError(error),
    });
  }

  closeCandidates(): void {
    this.matchingItem = undefined;
    this.candidates = [];
  }

  match(
    item: OfficeMyDataDashboard['exceptions'][number],
    candidate: MyDataSnapshotCandidate,
  ): void {
    if (!confirm(`Να συνδεθεί με ${candidate.series || '-'}/${candidate.documentNumber};`)) return;
    this.busy = true;
    this.api.matchSnapshot(item.id, candidate.id, 'Manual match from office queue.').subscribe({
      next: () => {
        this.busy = false;
        this.closeCandidates();
        this.message = 'Το παραστατικό συνδέθηκε με το snapshot της ΑΑΔΕ.';
        this.reload();
      },
      error: (error) => {
        this.busy = false;
        this.handleError(error);
      },
    });
  }

  ignore(item: OfficeMyDataDashboard['exceptions'][number]): void {
    const notes = prompt('Αιτιολογία αγνόησης (υποχρεωτική):')?.trim();
    if (!notes) return;
    this.busy = true;
    this.api.reviewSnapshot(item.id, 'IGNORE', notes).subscribe({
      next: () => {
        this.busy = false;
        this.message = 'Η εκκρεμότητα αγνοήθηκε και καταγράφηκε στο audit trail.';
        this.reload();
      },
      error: (error) => {
        this.busy = false;
        this.handleError(error);
      },
    });
  }

  private handleError(error: unknown): void {
    const response = error as HttpErrorResponse;
    const body = response.error as { message?: string | string[] } | undefined;
    this.errorMessage = Array.isArray(body?.message)
      ? body.message.join(' · ')
      : (body?.message ?? 'Η ενέργεια myDATA απέτυχε.');
    this.message = '';
  }
}

function firstDayOfCurrentMonth(): string {
  const now = new Date();
  return localDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function today(): string {
  return localDate(new Date());
}

function localDate(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
