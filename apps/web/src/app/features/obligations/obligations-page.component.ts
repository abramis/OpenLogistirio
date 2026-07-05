import { AsyncPipe, DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, switchMap } from 'rxjs';
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
        <button class="btn btn-secondary" type="button" (click)="generateCurrentMonth()">
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
            <select [(ngModel)]="form.type" name="type">
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
            </select>
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
          <button class="btn btn-secondary wide" type="button" (click)="resetFilters()">
            Καθαρισμός
          </button>
        </div>
      </article>
    </section>

    <section class="table-wrap" *ngIf="obligations$ | async as obligations">
      <table>
        <thead>
          <tr>
            <th>Υποχρέωση</th>
            <th>Πελάτης</th>
            <th>Περίοδος</th>
            <th>Προθεσμία</th>
            <th>Κατάσταση</th>
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

      .overdue {
        color: var(--err);
        font-weight: 700;
      }

      @media (max-width: 980px) {
        .work-grid,
        .form-grid {
          grid-template-columns: 1fr;
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
  );

  readonly today = new Date().toISOString().slice(0, 10);
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

  applyFilters(): void {
    this.filters$.next({ ...this.filters });
  }

  resetFilters(): void {
    this.filters = {};
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
    this.clearMessages();
    const now = new Date();

    this.obligationsApi.generateMonthly(now.getFullYear(), now.getMonth() + 1).subscribe({
      next: (response) => {
        this.message = `Δημιουργήθηκαν/βρέθηκαν ${response.generated} υποχρεώσεις για τον μήνα.`;
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
