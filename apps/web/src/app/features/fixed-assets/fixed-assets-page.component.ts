import { AsyncPipe, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, switchMap } from 'rxjs';
import { CompaniesApiService } from '../../core/api/companies-api.service';
import {
  FixedAsset,
  FixedAssetPayload,
  FixedAssetsApiService,
} from '../../core/api/fixed-assets-api.service';

@Component({
  selector: 'ol-fixed-assets-page',
  standalone: true,
  imports: [AsyncPipe, DatePipe, DecimalPipe, FormsModule, NgFor, NgIf],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Πάγια</h1>
        <p class="page-subtitle">Μητρώο παγίων και ετήσιες αποσβέσεις ανά πελάτη.</p>
      </div>
    </section>

    <div class="alert alert-success" *ngIf="message">{{ message }}</div>
    <div class="alert alert-danger" *ngIf="errorMessage">{{ errorMessage }}</div>

    <section class="card asset-form-card">
      <div class="card-header">
        <div>
          <h2 class="card-title">
            <span class="material-symbols-outlined">inventory_2</span>
            Νέο πάγιο
          </h2>
          <p class="card-subtitle">
            Καταχώριση αγοράς παγίου με καθαρή αξία, ΦΠΑ και συντελεστή απόσβεσης.
          </p>
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
          Κωδικός
          <input [(ngModel)]="form.code" name="code" required />
        </label>

        <label class="wide">
          Περιγραφή
          <input [(ngModel)]="form.description" name="description" required />
        </label>

        <label>
          Κατηγορία
          <select [(ngModel)]="form.category" name="category">
            <option value="EQUIPMENT">Εξοπλισμός</option>
            <option value="SOFTWARE">Λογισμικό</option>
            <option value="VEHICLE">Όχημα</option>
            <option value="FURNITURE">Έπιπλα</option>
            <option value="BUILDING">Κτίριο</option>
            <option value="OTHER">Άλλο</option>
          </select>
        </label>

        <label>
          Ημερομηνία αγοράς
          <input [(ngModel)]="form.acquisitionDate" name="acquisitionDate" type="date" required />
        </label>

        <label>
          Παραστατικό
          <input [(ngModel)]="form.acquisitionDocumentNumber" name="acquisitionDocumentNumber" />
        </label>

        <label>
          Προμηθευτής
          <input [(ngModel)]="form.supplierName" name="supplierName" />
        </label>

        <label>
          Καθαρή αξία
          <input [(ngModel)]="form.netValue" name="netValue" type="number" step="0.01" min="0" />
        </label>

        <label>
          ΦΠΑ
          <input [(ngModel)]="form.vatAmount" name="vatAmount" type="number" step="0.01" min="0" />
        </label>

        <label>
          Σύνολο
          <input
            [(ngModel)]="form.totalValue"
            name="totalValue"
            type="number"
            step="0.01"
            min="0"
          />
        </label>

        <label>
          Συντελεστής απόσβεσης %
          <input
            [(ngModel)]="form.depreciationRate"
            name="depreciationRate"
            type="number"
            step="0.01"
            min="0"
            max="100"
          />
        </label>

        <div class="wide form-actions">
          <button class="btn btn-secondary" type="button" (click)="calculateVat(24)">
            ΦΠΑ 24%
          </button>
          <button class="btn btn-primary" type="submit">
            <span class="material-symbols-outlined">save</span>
            Καταχώριση παγίου
          </button>
        </div>
      </form>
    </section>

    <section class="table-wrap" *ngIf="assets$ | async as assets">
      <table>
        <thead>
          <tr>
            <th>Πάγιο</th>
            <th>Πελάτης</th>
            <th>Αγορά</th>
            <th>Αξία</th>
            <th>Αποσβέσεις</th>
            <th>Αναπόσβεστη</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let asset of assets">
            <td>
              <strong>{{ asset.code }} - {{ asset.description }}</strong>
              <small>{{ categoryLabel(asset.category) }}</small>
            </td>
            <td>
              {{ asset.clientCompany?.legalName || '-' }}
              <small>{{ asset.clientCompany?.vatNumber || '-' }}</small>
            </td>
            <td>
              {{ asset.acquisitionDate | date: 'dd/MM/yyyy' }}
              <small>{{ asset.acquisitionDocumentNumber || asset.supplierName || '-' }}</small>
            </td>
            <td>
              {{ asset.netValue | number: '1.2-2' }}
              <small>ΦΠΑ {{ asset.vatAmount | number: '1.2-2' }}</small>
            </td>
            <td>
              {{ asset.accumulatedDepreciation | number: '1.2-2' }}
              <small>{{ asset.depreciationRate | number: '1.2-2' }}%</small>
            </td>
            <td>{{ bookValue(asset) | number: '1.2-2' }}</td>
            <td class="row-actions">
              <button
                class="btn btn-xs btn-secondary"
                type="button"
                (click)="generateDepreciation(asset)"
              >
                Απόσβεση {{ currentYear }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" *ngIf="assets.length === 0">
        <span class="material-symbols-outlined">inventory_2</span>
        Δεν υπάρχουν πάγια ακόμα.
      </div>
    </section>
  `,
  styles: [
    `
      .asset-form-card {
        margin-bottom: 16px;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
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
        grid-column: span 2;
      }

      .form-actions,
      .row-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      @media (max-width: 1080px) {
        .form-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 680px) {
        .form-grid {
          grid-template-columns: 1fr;
        }

        .wide {
          grid-column: 1;
        }
      }
    `,
  ],
})
export class FixedAssetsPageComponent {
  private readonly fixedAssetsApi = inject(FixedAssetsApiService);
  private readonly reload$ = new BehaviorSubject<void>(undefined);

  readonly companies$ = inject(CompaniesApiService).findAll();
  readonly assets$ = this.reload$.pipe(switchMap(() => this.fixedAssetsApi.findAll()));
  readonly currentYear = new Date().getFullYear();
  readonly today = new Date().toISOString().slice(0, 10);
  message = '';
  errorMessage = '';
  form: FixedAssetPayload = {
    clientCompanyId: '',
    code: `FA-${new Date().getFullYear()}-001`,
    description: '',
    category: 'EQUIPMENT',
    acquisitionDate: this.today,
    netValue: 1000,
    vatAmount: 240,
    totalValue: 1240,
    depreciationRate: 20,
  };

  create(): void {
    this.clearMessages();
    this.fixedAssetsApi.create(this.form).subscribe({
      next: () => {
        this.message = 'Το πάγιο καταχωρίστηκε.';
        this.reload$.next();
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  calculateVat(rate: number): void {
    const net = Number(this.form.netValue || 0);
    const vat = Math.round(net * rate) / 100;

    this.form.vatAmount = vat;
    this.form.totalValue = Math.round((net + vat) * 100) / 100;
  }

  generateDepreciation(asset: FixedAsset): void {
    this.clearMessages();
    this.fixedAssetsApi.generateDepreciation(asset.id, this.currentYear).subscribe({
      next: (entry) => {
        this.message = `Υπολογίστηκε απόσβεση ${entry.fiscalYear}: ${entry.amount}.`;
        this.reload$.next();
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  bookValue(asset: FixedAsset): number {
    return Number(asset.netValue || 0) - Number(asset.accumulatedDepreciation || 0);
  }

  categoryLabel(category: string): string {
    const labels: Record<string, string> = {
      EQUIPMENT: 'Εξοπλισμός',
      SOFTWARE: 'Λογισμικό',
      VEHICLE: 'Όχημα',
      FURNITURE: 'Έπιπλα',
      BUILDING: 'Κτίριο',
      OTHER: 'Άλλο',
    };

    return labels[category] ?? category;
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
