import { AsyncPipe, DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, switchMap, tap } from 'rxjs';
import { CompaniesApiService } from '../../core/api/companies-api.service';
import {
  ObligationFilters,
  ObligationPayload,
  ObligationsApiService,
  OfficeObligation,
} from '../../core/api/obligations-api.service';

@Component({
  selector: 'ol-obligations-page',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, NgClass, NgFor, NgIf],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Υποχρεώσεις γραφείου</h1>
        <p class="page-subtitle">Προθεσμίες ανά πελάτη για ΦΠΑ, myDATA και εσωτερικές εργασίες.</p>
      </div>
      <div class="page-actions">
        <select class="compact-control" [(ngModel)]="generateMonth" aria-label="Μήνας παραγωγής">
          <option *ngFor="let month of months" [value]="month.value">{{ month.label }}</option>
        </select>
        <input
          class="compact-control year-control"
          [(ngModel)]="generateYear"
          type="number"
          min="2000"
          max="2200"
          aria-label="Έτος παραγωγής"
        />
        <button class="btn btn-secondary" type="button" (click)="generateSelectedMonth()">
          <span class="material-symbols-outlined">event_repeat</span>
          Παραγωγή μήνα
        </button>
      </div>
    </section>

    <div class="alert alert-success" *ngIf="message">{{ message }}</div>
    <div class="alert alert-danger" *ngIf="errorMessage">{{ errorMessage }}</div>

    <section class="work-grid">
      <article class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">
              <span class="material-symbols-outlined">add_task</span>
              Νέα υποχρέωση
            </h2>
            <p class="card-subtitle">Χειροκίνητη εργασία για συγκεκριμένο πελάτη.</p>
          </div>
        </div>
        <form class="card-body form-grid" (ngSubmit)="create()">
          <label>
            Πελάτης
            <select [(ngModel)]="form.clientCompanyId" name="clientCompanyId" required>
              <option value="">Επιλογή πελάτη</option>
              <option *ngFor="let company of companies$ | async" [value]="company.id">
                {{ company.legalName }} - {{ company.vatNumber }}
              </option>
            </select>
          </label>
          <label>
            Τύπος
            <select [(ngModel)]="form.type" name="type" (ngModelChange)="onFormTypeChange()">
              <option value="VAT_RETURN">Περιοδική ΦΠΑ</option>
              <option value="MYDATA_REVIEW">Έλεγχος myDATA</option>
              <option value="WITHHOLDING_TAX">Παρακρατούμενοι</option>
              <option value="INCOME_TAX_PREP">Προετοιμασία εισοδήματος</option>
              <option value="CUSTOM">Άλλη εργασία</option>
            </select>
          </label>
          <label class="wide">
            Τίτλος
            <input [(ngModel)]="form.title" name="title" required />
          </label>
          <label>
            Έτος
            <input
              [(ngModel)]="form.periodYear"
              name="periodYear"
              type="number"
              min="2000"
              max="2200"
            />
          </label>
          <label>
            Μήνας
            <input
              [(ngModel)]="form.periodMonth"
              name="periodMonth"
              type="number"
              min="1"
              max="12"
            />
          </label>
          <label>
            Προθεσμία
            <input [(ngModel)]="form.dueDate" name="dueDate" type="date" required />
          </label>
          <label>
            Κατάσταση
            <select [(ngModel)]="form.status" name="status">
              <option value="OPEN">Ανοιχτό</option>
              <option value="IN_PROGRESS">Σε εξέλιξη</option>
              <option value="WAITING_CLIENT">Αναμονή πελάτη</option>
              <option value="READY_TO_SUBMIT">Έτοιμο για υποβολή</option>
            </select>
          </label>
          <div class="wide form-actions">
            <button class="btn btn-primary" type="submit">
              <span class="material-symbols-outlined">save</span>
              Καταχώριση
            </button>
          </div>
        </form>
      </article>

      <article class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">
              <span class="material-symbols-outlined">filter_list</span>
              Φίλτρα
            </h2>
            <p class="card-subtitle">Περιορίστε το work queue.</p>
          </div>
        </div>
        <div class="card-body form-grid">
          <label class="wide">
            Πελάτης
            <select
              [(ngModel)]="filters.clientCompanyId"
              name="filterClientCompanyId"
              (ngModelChange)="applyFilters()"
            >
              <option value="">Όλοι οι πελάτες</option>
              <option *ngFor="let company of companies$ | async" [value]="company.id">
                {{ company.legalName }} - {{ company.vatNumber }}
              </option>
            </select>
          </label>
          <label>
            Τύπος
            <select [(ngModel)]="filters.type" name="filterType" (ngModelChange)="applyFilters()">
              <option value="">Όλοι</option>
              <option value="VAT_RETURN">Περιοδική ΦΠΑ</option>
              <option value="MYDATA_REVIEW">Έλεγχος myDATA</option>
              <option value="WITHHOLDING_TAX">Παρακρατούμενοι</option>
              <option value="INCOME_TAX_PREP">Εισόδημα</option>
              <option value="PAYROLL_REVIEW">Μισθοδοσία</option>
              <option value="CUSTOM">Άλλη εργασία</option>
            </select>
          </label>
          <label>
            Κατάσταση
            <select
              [(ngModel)]="filters.status"
              name="filterStatus"
              (ngModelChange)="applyFilters()"
            >
              <option value="">Όλες</option>
              <option value="OPEN">Ανοιχτό</option>
              <option value="IN_PROGRESS">Σε εξέλιξη</option>
              <option value="WAITING_CLIENT">Αναμονή πελάτη</option>
              <option value="READY_TO_SUBMIT">Έτοιμο</option>
              <option value="SUBMITTED">Υποβλήθηκε</option>
              <option value="CANCELLED">Ακυρώθηκε</option>
            </select>
          </label>
          <label>
            Από
            <input
              [(ngModel)]="filters.dueFrom"
              name="dueFrom"
              type="date"
              (ngModelChange)="applyFilters()"
            />
          </label>
          <label>
            Έως
            <input
              [(ngModel)]="filters.dueTo"
              name="dueTo"
              type="date"
              (ngModelChange)="applyFilters()"
            />
          </label>
          <div class="wide quick-filters">
            <button class="btn btn-xs btn-secondary" type="button" (click)="showOverdue()">
              Ληξιπρόθεσμα
            </button>
            <button class="btn btn-xs btn-secondary" type="button" (click)="showToday()">
              Σήμερα
            </button>
            <button class="btn btn-xs btn-secondary" type="button" (click)="showNextDays(7)">
              7 ημέρες
            </button>
            <button class="btn btn-xs btn-secondary" type="button" (click)="showNextDays(30)">
              30 ημέρες
            </button>
          </div>
          <button class="btn btn-secondary wide" type="button" (click)="resetFilters()">
            Καθαρισμός
          </button>
        </div>
      </article>
    </section>

    <section class="table-wrap" *ngIf="obligations$ | async as obligations">
      <div class="queue-summary" *ngIf="obligations.length > 0">
        <div>
          <span>Ανοιχτά</span>
          <strong>{{ queueSummary(obligations).open }}</strong>
        </div>
        <div>
          <span>Ληξιπρόθεσμα</span>
          <strong class="danger-text">{{ queueSummary(obligations).overdue }}</strong>
        </div>
        <div>
          <span>Επόμενες 7 ημέρες</span>
          <strong>{{ queueSummary(obligations).dueSoon }}</strong>
        </div>
        <div>
          <span>Αναμονή πελάτη</span>
          <strong>{{ queueSummary(obligations).waitingClient }}</strong>
        </div>
        <div>
          <span>Έτοιμα</span>
          <strong>{{ queueSummary(obligations).ready }}</strong>
        </div>
        <button class="btn btn-secondary" type="button" (click)="exportCsv()">
          <span class="material-symbols-outlined">download</span>
          CSV
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Υποχρέωση</th>
            <th>Πελάτης</th>
            <th>Περίοδος</th>
            <th>Προθεσμία</th>
            <th>Κατάσταση</th>
            <th>Recurrence</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let obligation of obligations">
            <td>
              <strong>{{ obligation.title }}</strong>
              <small>{{ typeLabel(obligation.type) }}</small>
            </td>
            <td>
              {{ obligation.clientCompany?.legalName || '-' }}
              <small>{{ obligation.clientCompany?.vatNumber || '-' }}</small>
            </td>
            <td>{{ periodLabel(obligation) }}</td>
            <td [class.overdue]="isOverdue(obligation)">
              {{ obligation.dueDate | date: 'dd/MM/yyyy' }}
            </td>
            <td>
              <span class="badge" [ngClass]="statusClass(obligation.status)">
                {{ statusLabel(obligation.status) }}
              </span>
            </td>
            <td>{{ recurrenceLabel(obligation.recurrence) }}</td>
            <td class="row-actions">
              <button
                class="btn btn-xs btn-secondary"
                type="button"
                (click)="markReady(obligation)"
                [disabled]="obligation.status === 'SUBMITTED'"
              >
                Έτοιμο
              </button>
              <button
                class="btn btn-xs btn-primary"
                type="button"
                (click)="complete(obligation)"
                [disabled]="obligation.status === 'SUBMITTED'"
              >
                Υποβλήθηκε
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" *ngIf="obligations.length === 0">
        <span class="material-symbols-outlined">task_alt</span>
        Δεν υπάρχουν υποχρεώσεις για τα φίλτρα.
      </div>
    </section>
  `,
  styles: [
    `
      .work-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.6fr);
        gap: 16px;
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

      .form-actions,
      .row-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .compact-control {
        width: 132px;
        min-height: 36px;
      }

      .year-control {
        width: 92px;
      }

      .quick-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .queue-summary {
        display: grid;
        grid-template-columns: repeat(5, minmax(110px, 1fr)) auto;
        align-items: stretch;
        gap: 0;
        border-bottom: 1px solid var(--border);
        margin: -1px -1px 12px;
      }

      .queue-summary div {
        display: grid;
        gap: 4px;
        padding: 12px 14px;
        border-right: 1px solid var(--border);
      }

      .queue-summary span {
        color: var(--muted);
        font-size: 0.72rem;
        font-weight: 700;
      }

      .queue-summary strong {
        font-size: 1.2rem;
      }

      .queue-summary .btn {
        align-self: center;
        margin: 8px 10px;
      }

      .overdue {
        color: var(--err);
        font-weight: 700;
      }

      .danger-text {
        color: var(--err);
      }

      @media (max-width: 980px) {
        .work-grid,
        .form-grid,
        .queue-summary {
          grid-template-columns: 1fr;
        }

        .queue-summary div {
          border-right: none;
          border-bottom: 1px solid var(--border);
        }
      }
    `,
  ],
})
export class ObligationsPageComponent {
  private readonly obligationsApi = inject(ObligationsApiService);
  private readonly reload$ = new BehaviorSubject<void>(undefined);
  private readonly filters$ = new BehaviorSubject<ObligationFilters>({});

  readonly companies$ = inject(CompaniesApiService).findAll();
  readonly obligations$ = combineLatest([this.reload$, this.filters$]).pipe(
    switchMap(([, filters]) => this.obligationsApi.findAll(filters)),
    tap((obligations) => {
      this.latestObligations = obligations;
    }),
  );

  readonly today = new Date().toISOString().slice(0, 10);
  readonly months = [
    { value: 1, label: 'Ιανουάριος' },
    { value: 2, label: 'Φεβρουάριος' },
    { value: 3, label: 'Μάρτιος' },
    { value: 4, label: 'Απρίλιος' },
    { value: 5, label: 'Μάιος' },
    { value: 6, label: 'Ιούνιος' },
    { value: 7, label: 'Ιούλιος' },
    { value: 8, label: 'Αύγουστος' },
    { value: 9, label: 'Σεπτέμβριος' },
    { value: 10, label: 'Οκτώβριος' },
    { value: 11, label: 'Νοέμβριος' },
    { value: 12, label: 'Δεκέμβριος' },
  ];
  private latestObligations: OfficeObligation[] = [];
  generateYear = new Date().getFullYear();
  generateMonth = new Date().getMonth() + 1;
  message = '';
  errorMessage = '';
  filters: ObligationFilters = {};
  form: ObligationPayload = {
    clientCompanyId: '',
    type: 'VAT_RETURN',
    title: 'Περιοδική ΦΠΑ',
    periodYear: new Date().getFullYear(),
    periodMonth: new Date().getMonth() + 1,
    dueDate: this.today,
    status: 'OPEN',
    recurrence: 'NONE',
  };

  onFormTypeChange(): void {
    this.form.title = this.typeLabel(this.form.type);
  }

  applyFilters(): void {
    this.filters$.next({ ...this.filters });
  }

  resetFilters(): void {
    this.filters = {};
    this.applyFilters();
  }

  showOverdue(): void {
    this.filters = { ...this.filters, dueFrom: undefined, dueTo: yesterdayIso(), status: 'OPEN' };
    this.applyFilters();
  }

  showToday(): void {
    this.filters = { ...this.filters, dueFrom: this.today, dueTo: this.today };
    this.applyFilters();
  }

  showNextDays(days: number): void {
    this.filters = { ...this.filters, dueFrom: this.today, dueTo: addDaysIso(days) };
    this.applyFilters();
  }

  create(): void {
    this.clearMessages();
    this.obligationsApi.create(this.form).subscribe({
      next: () => {
        this.message = 'Η υποχρέωση καταχωρίστηκε.';
        this.reload$.next();
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  generateCurrentMonth(): void {
    const now = new Date();
    this.generateYear = now.getFullYear();
    this.generateMonth = now.getMonth() + 1;
    this.generateSelectedMonth();
  }

  generateSelectedMonth(): void {
    this.clearMessages();

    this.obligationsApi.generateMonthly(this.generateYear, Number(this.generateMonth)).subscribe({
      next: (response) => {
        this.message = `Δημιουργήθηκαν/βρέθηκαν ${response.generated} υποχρεώσεις για ${String(
          this.generateMonth,
        ).padStart(2, '0')}/${this.generateYear}.`;
        this.reload$.next();
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  markReady(obligation: OfficeObligation): void {
    this.clearMessages();
    this.obligationsApi.update(obligation.id, { status: 'READY_TO_SUBMIT' }).subscribe({
      next: () => this.reload$.next(),
      error: (error: unknown) => this.showError(error),
    });
  }

  complete(obligation: OfficeObligation): void {
    this.clearMessages();
    this.obligationsApi.complete(obligation.id).subscribe({
      next: () => this.reload$.next(),
      error: (error: unknown) => this.showError(error),
    });
  }

  isOverdue(obligation: OfficeObligation): boolean {
    return obligation.status !== 'SUBMITTED' && obligation.dueDate.slice(0, 10) < this.today;
  }

  periodLabel(obligation: OfficeObligation): string {
    return obligation.periodMonth
      ? `${String(obligation.periodMonth).padStart(2, '0')}/${obligation.periodYear}`
      : String(obligation.periodYear);
  }

  queueSummary(obligations: OfficeObligation[]) {
    return obligations.reduce(
      (summary, obligation) => {
        const isSubmitted = obligation.status === 'SUBMITTED' || obligation.status === 'CANCELLED';
        if (!isSubmitted) {
          summary.open += 1;
        }
        if (this.isOverdue(obligation)) {
          summary.overdue += 1;
        }
        if (!isSubmitted && obligation.dueDate.slice(0, 10) <= addDaysIso(7)) {
          summary.dueSoon += 1;
        }
        if (obligation.status === 'WAITING_CLIENT') {
          summary.waitingClient += 1;
        }
        if (obligation.status === 'READY_TO_SUBMIT') {
          summary.ready += 1;
        }

        return summary;
      },
      { open: 0, overdue: 0, dueSoon: 0, waitingClient: 0, ready: 0 },
    );
  }

  typeLabel(type: string): string {
    const labels: Record<string, string> = {
      VAT_RETURN: 'Περιοδική ΦΠΑ',
      MYDATA_REVIEW: 'Έλεγχος myDATA',
      WITHHOLDING_TAX: 'Παρακρατούμενοι φόροι',
      INCOME_TAX_PREP: 'Προετοιμασία φορολογίας',
      PAYROLL_REVIEW: 'Μισθοδοσία',
      CUSTOM: 'Άλλη εργασία',
    };

    return labels[type] ?? type;
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      OPEN: 'Ανοιχτό',
      IN_PROGRESS: 'Σε εξέλιξη',
      WAITING_CLIENT: 'Αναμονή πελάτη',
      READY_TO_SUBMIT: 'Έτοιμο',
      SUBMITTED: 'Υποβλήθηκε',
      CANCELLED: 'Ακυρώθηκε',
    };

    return labels[status] ?? status;
  }

  statusClass(status: string): string {
    const classes: Record<string, string> = {
      OPEN: 'badge-neutral',
      IN_PROGRESS: 'badge-info',
      WAITING_CLIENT: 'badge-warning',
      READY_TO_SUBMIT: 'badge-success',
      SUBMITTED: 'badge-success',
      CANCELLED: 'badge-neutral',
    };

    return classes[status] ?? 'badge-neutral';
  }

  recurrenceLabel(recurrence: string): string {
    const labels: Record<string, string> = {
      NONE: 'Μία φορά',
      MONTHLY: 'Μηνιαία',
      QUARTERLY: 'Τριμηνιαία',
      YEARLY: 'Ετήσια',
    };

    return labels[recurrence] ?? recurrence;
  }

  exportCsv(): void {
    const header = [
      'title',
      'type',
      'company',
      'vatNumber',
      'period',
      'dueDate',
      'status',
      'recurrence',
    ];
    const rows = this.latestObligations.map((obligation) => [
      obligation.title,
      obligation.type,
      obligation.clientCompany?.legalName ?? '',
      obligation.clientCompany?.vatNumber ?? '',
      this.periodLabel(obligation),
      obligation.dueDate,
      obligation.status,
      obligation.recurrence,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `obligations-${this.today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
}

function addDaysIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function yesterdayIso(): string {
  return addDaysIso(-1);
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}
