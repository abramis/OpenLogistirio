import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, switchMap } from 'rxjs';
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
    </section>

    <div class="alert alert-success" *ngIf="message">{{ message }}</div>
    <div class="alert alert-danger" *ngIf="errorMessage">{{ errorMessage }}</div>

    <section class="card form-card">
      <div class="card-header">
        <div>
          <h2 class="card-title">
            <span class="material-symbols-outlined">person_add</span> Νέος αντισυμβαλλόμενος
          </h2>
          <p class="card-subtitle">Master data για γρήγορη και συνεπή καταχώριση παραστατικών.</p>
        </div>
      </div>
      <form class="card-body form-grid" (ngSubmit)="create()">
        <label>
          Εταιρεία πελάτη
          <select [(ngModel)]="form.clientCompanyId" name="clientCompanyId" required>
            <option value="">Επιλογή</option>
            <option *ngFor="let company of companies$ | async" [value]="company.id">
              {{ company.legalName }}
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
          Email
          <input [(ngModel)]="form.email" name="email" type="email" />
        </label>
        <label>
          Τηλέφωνο
          <input [(ngModel)]="form.phone" name="phone" />
        </label>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">
            <span class="material-symbols-outlined">save</span>
            Καταχώριση
          </button>
        </div>
      </form>
    </section>

    <section class="card filters-card">
      <div class="card-body filters">
        <input
          [(ngModel)]="filters.search"
          placeholder="Αναζήτηση επωνυμίας / ΑΦΜ"
          (ngModelChange)="applyFilters()"
        />
        <select [(ngModel)]="filters.type" (ngModelChange)="applyFilters()">
          <option value="">Όλοι οι τύποι</option>
          <option value="CUSTOMER">Πελάτες</option>
          <option value="SUPPLIER">Προμηθευτές</option>
          <option value="BOTH">Και τα δύο</option>
        </select>
      </div>
    </section>

    <section class="table-wrap" *ngIf="counterparties$ | async as counterparties">
      <table>
        <thead>
          <tr>
            <th>Αντισυμβαλλόμενος</th>
            <th>Τύπος</th>
            <th>Εταιρεία πελάτη</th>
            <th>Επικοινωνία</th>
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
            <td class="row-actions">
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

      .form-actions,
      .row-actions {
        display: flex;
        align-items: end;
        justify-content: flex-end;
      }

      @media (max-width: 900px) {
        .form-grid,
        .filters {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class CounterpartiesPageComponent {
  private readonly counterpartiesApi = inject(CounterpartiesApiService);
  private readonly reload$ = new BehaviorSubject<void>(undefined);
  private readonly filters$ = new BehaviorSubject<CounterpartyFilters>({});

  readonly companies$ = inject(CompaniesApiService).findAll();
  readonly counterparties$ = combineLatest([this.reload$, this.filters$]).pipe(
    switchMap(([, filters]) => this.counterpartiesApi.findAll(filters)),
  );

  message = '';
  errorMessage = '';
  filters: CounterpartyFilters = {};
  form: CounterpartyPayload = {
    clientCompanyId: '',
    type: 'SUPPLIER',
    name: '',
    country: 'GR',
  };

  applyFilters(): void {
    this.filters$.next({ ...this.filters });
  }

  create(): void {
    this.clearMessages();
    this.counterpartiesApi.create(this.form).subscribe({
      next: () => {
        this.message = 'Ο αντισυμβαλλόμενος καταχωρίστηκε.';
        this.form.name = '';
        this.form.vatNumber = '';
        this.reload$.next();
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  remove(counterparty: Counterparty): void {
    this.clearMessages();
    this.counterpartiesApi.delete(counterparty.id).subscribe({
      next: () => this.reload$.next(),
      error: (error: unknown) => this.showError(error),
    });
  }

  typeLabel(type: string): string {
    const labels: Record<string, string> = {
      CUSTOMER: 'Πελάτης',
      SUPPLIER: 'Προμηθευτής',
      BOTH: 'Και τα δύο',
    };

    return labels[type] ?? type;
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
