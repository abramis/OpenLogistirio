import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, switchMap, tap } from 'rxjs';
import { CompaniesApiService } from '../../core/api/companies-api.service';
import {
  CounterpartiesApiService,
  Counterparty,
  CounterpartyFilters,
  CounterpartyPayload,
} from '../../core/api/counterparties-api.service';

@Component({
  selector: 'ol-counterparties-page',
  standalone: true,
  imports: [AsyncPipe, FormsModule, NgFor, NgIf],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Αντισυμβαλλόμενοι</h1>
        <p class="page-subtitle">Πελάτες και προμηθευτές ανά εταιρεία πελάτη.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" type="button" (click)="exportCsv()">
          <span class="material-symbols-outlined">download</span>
          CSV
        </button>
      </div>
    </section>

    <div class="alert alert-success" *ngIf="message">{{ message }}</div>
    <div class="alert alert-danger" *ngIf="errorMessage">{{ errorMessage }}</div>

    <section class="card form-card">
      <div class="card-header">
        <div>
          <h2 class="card-title">
            <span class="material-symbols-outlined">{{ editingId ? 'edit' : 'person_add' }}</span>
            {{ editingId ? 'Επεξεργασία αντισυμβαλλόμενου' : 'Νέος αντισυμβαλλόμενος' }}
          </h2>
          <p class="card-subtitle">Master data για γρήγορη και συνεπή καταχώριση παραστατικών.</p>
        </div>
      </div>
      <form class="card-body form-grid" (ngSubmit)="save()">
        <label>
          Εταιρεία πελάτη
          <select [(ngModel)]="form.clientCompanyId" name="clientCompanyId" required>
            <option value="">Επιλογή</option>
            <option *ngFor="let company of companies$ | async" [value]="company.id">
              {{ company.legalName }} - {{ company.vatNumber }}
            </option>
          </select>
        </label>
        <label>
          Τύπος
          <select [(ngModel)]="form.type" name="type">
            <option value="CUSTOMER">Πελάτης</option>
            <option value="SUPPLIER">Προμηθευτής</option>
            <option value="BOTH">Και τα δύο</option>
          </select>
        </label>
        <label>
          Επωνυμία
          <input [(ngModel)]="form.name" name="name" required />
        </label>
        <label>
          ΑΦΜ
          <input [(ngModel)]="form.vatNumber" name="vatNumber" />
        </label>
        <label>
          ΔΟΥ
          <input [(ngModel)]="form.taxOffice" name="taxOffice" />
        </label>
        <label>
          Χώρα
          <input [(ngModel)]="form.country" name="country" maxlength="2" />
        </label>
        <label>
          Email
          <input [(ngModel)]="form.email" name="email" type="email" />
        </label>
        <label>
          Τηλέφωνο
          <input [(ngModel)]="form.phone" name="phone" />
        </label>
        <label class="wide">
          Διεύθυνση
          <input [(ngModel)]="form.address" name="address" />
        </label>
        <label class="wide">
          Σημειώσεις
          <textarea [(ngModel)]="form.notes" name="notes" rows="3"></textarea>
        </label>
        <div class="wide form-actions">
          <button class="btn btn-secondary" type="button" *ngIf="editingId" (click)="cancelEdit()">
            Ακύρωση
          </button>
          <button class="btn btn-primary" type="submit">
            <span class="material-symbols-outlined">save</span>
            {{ editingId ? 'Αποθήκευση' : 'Καταχώριση' }}
          </button>
        </div>
      </form>
    </section>

    <section class="card filters-card">
      <div class="card-body filters">
        <input
          [(ngModel)]="filters.search"
          placeholder="Αναζήτηση επωνυμίας / ΑΦΜ / email"
          (ngModelChange)="applyFilters()"
        />
        <select [(ngModel)]="filters.clientCompanyId" (ngModelChange)="applyFilters()">
          <option value="">Όλες οι εταιρείες</option>
          <option *ngFor="let company of companies$ | async" [value]="company.id">
            {{ company.legalName }} - {{ company.vatNumber }}
          </option>
        </select>
        <select [(ngModel)]="filters.type" (ngModelChange)="applyFilters()">
          <option value="">Όλοι οι τύποι</option>
          <option value="CUSTOMER">Πελάτες</option>
          <option value="SUPPLIER">Προμηθευτές</option>
          <option value="BOTH">Και τα δύο</option>
        </select>
      </div>
    </section>

    <section class="table-wrap" *ngIf="counterparties$ | async as counterparties">
      <div class="summary-strip" *ngIf="counterparties.length > 0">
        <div>
          <span>Σύνολο</span>
          <strong>{{ counterparties.length }}</strong>
        </div>
        <div>
          <span>Πελάτες</span>
          <strong>{{ countByType(counterparties, 'CUSTOMER') }}</strong>
        </div>
        <div>
          <span>Προμηθευτές</span>
          <strong>{{ countByType(counterparties, 'SUPPLIER') }}</strong>
        </div>
        <div>
          <span>Χωρίς ΑΦΜ</span>
          <strong>{{ withoutVat(counterparties) }}</strong>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Αντισυμβαλλόμενος</th>
            <th>Τύπος</th>
            <th>Εταιρεία πελάτη</th>
            <th>Επικοινωνία</th>
            <th>Διεύθυνση</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let counterparty of counterparties">
            <td>
              <strong>{{ counterparty.name }}</strong>
              <small>{{ counterparty.vatNumber || '-' }}</small>
            </td>
            <td>
              <span class="badge badge-info">{{ typeLabel(counterparty.type) }}</span>
            </td>
            <td>
              {{ counterparty.clientCompany?.legalName || '-' }}
              <small>{{ counterparty.clientCompany?.vatNumber || '-' }}</small>
            </td>
            <td>
              {{ counterparty.email || '-' }}
              <small>{{ counterparty.phone || '-' }}</small>
            </td>
            <td>
              {{ counterparty.address || '-' }}
              <small>{{ counterparty.taxOffice || counterparty.country }}</small>
            </td>
            <td class="row-actions">
              <button class="btn btn-xs btn-secondary" type="button" (click)="edit(counterparty)">
                Edit
              </button>
              <button class="btn btn-xs btn-danger" type="button" (click)="remove(counterparty)">
                Διαγραφή
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" *ngIf="counterparties.length === 0">
        <span class="material-symbols-outlined">contacts</span>
        Δεν υπάρχουν αντισυμβαλλόμενοι.
      </div>
    </section>
  `,
  styles: [
    `
      .form-card,
      .filters-card {
        margin-bottom: 16px;
      }

      .form-grid,
      .filters {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
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
        align-items: end;
        justify-content: flex-end;
        gap: 8px;
      }

      .summary-strip {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        border-bottom: 1px solid var(--border);
        margin: -1px -1px 12px;
      }

      .summary-strip div {
        display: grid;
        gap: 4px;
        padding: 12px 14px;
        border-right: 1px solid var(--border);
      }

      .summary-strip div:last-child {
        border-right: none;
      }

      .summary-strip span {
        color: var(--muted);
        font-size: 0.72rem;
        font-weight: 700;
      }

      .summary-strip strong {
        font-size: 1.15rem;
      }

      td small {
        display: block;
        margin-top: 3px;
        color: var(--muted);
      }

      @media (max-width: 900px) {
        .form-grid,
        .filters,
        .summary-strip {
          grid-template-columns: 1fr;
        }

        .summary-strip div {
          border-right: none;
          border-bottom: 1px solid var(--border);
        }
      }
    `,
  ],
})
export class CounterpartiesPageComponent {
  private readonly counterpartiesApi = inject(CounterpartiesApiService);
  private readonly reload$ = new BehaviorSubject<void>(undefined);
  private readonly filters$ = new BehaviorSubject<CounterpartyFilters>({});
  private latestCounterparties: Counterparty[] = [];

  readonly companies$ = inject(CompaniesApiService).findAll();
  readonly counterparties$ = combineLatest([this.reload$, this.filters$]).pipe(
    switchMap(([, filters]) => this.counterpartiesApi.findAll(filters)),
    tap((counterparties) => {
      this.latestCounterparties = counterparties;
    }),
  );

  message = '';
  errorMessage = '';
  editingId = '';
  filters: CounterpartyFilters = {};
  form: CounterpartyPayload = emptyForm();

  applyFilters(): void {
    this.filters$.next({ ...this.filters });
  }

  save(): void {
    this.clearMessages();
    const request = this.editingId
      ? this.counterpartiesApi.update(this.editingId, this.form)
      : this.counterpartiesApi.create(this.form);

    request.subscribe({
      next: () => {
        this.message = this.editingId
          ? 'Ο αντισυμβαλλόμενος ενημερώθηκε.'
          : 'Ο αντισυμβαλλόμενος καταχωρίστηκε.';
        this.cancelEdit();
        this.reload$.next();
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  edit(counterparty: Counterparty): void {
    this.editingId = counterparty.id;
    this.form = {
      clientCompanyId: counterparty.clientCompanyId,
      type: counterparty.type,
      name: counterparty.name,
      vatNumber: counterparty.vatNumber ?? '',
      country: counterparty.country,
      taxOffice: counterparty.taxOffice ?? '',
      address: counterparty.address ?? '',
      email: counterparty.email ?? '',
      phone: counterparty.phone ?? '',
      notes: counterparty.notes ?? '',
    };
  }

  cancelEdit(): void {
    this.editingId = '';
    this.form = emptyForm();
  }

  remove(counterparty: Counterparty): void {
    this.clearMessages();
    this.counterpartiesApi.delete(counterparty.id).subscribe({
      next: () => this.reload$.next(),
      error: (error: unknown) => this.showError(error),
    });
  }

  countByType(counterparties: Counterparty[], type: string): number {
    return counterparties.filter((counterparty) =>
      type === 'CUSTOMER'
        ? ['CUSTOMER', 'BOTH'].includes(counterparty.type)
        : ['SUPPLIER', 'BOTH'].includes(counterparty.type),
    ).length;
  }

  withoutVat(counterparties: Counterparty[]): number {
    return counterparties.filter((counterparty) => !counterparty.vatNumber).length;
  }

  typeLabel(type: string): string {
    const labels: Record<string, string> = {
      CUSTOMER: 'Πελάτης',
      SUPPLIER: 'Προμηθευτής',
      BOTH: 'Και τα δύο',
    };

    return labels[type] ?? type;
  }

  exportCsv(): void {
    const header = [
      'company',
      'name',
      'type',
      'vatNumber',
      'taxOffice',
      'address',
      'email',
      'phone',
      'country',
      'notes',
    ];
    const rows = this.latestCounterparties.map((counterparty) => [
      counterparty.clientCompany?.legalName ?? '',
      counterparty.name,
      counterparty.type,
      counterparty.vatNumber ?? '',
      counterparty.taxOffice ?? '',
      counterparty.address ?? '',
      counterparty.email ?? '',
      counterparty.phone ?? '',
      counterparty.country,
      counterparty.notes ?? '',
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'counterparties.csv';
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
      this.errorMessage = Array.isArray(message) ? message.join(' ') : message || error.message;
      return;
    }
    this.errorMessage = 'Request failed.';
  }
}

function emptyForm(): CounterpartyPayload {
  return {
    clientCompanyId: '',
    type: 'SUPPLIER',
    name: '',
    country: 'GR',
  };
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}
