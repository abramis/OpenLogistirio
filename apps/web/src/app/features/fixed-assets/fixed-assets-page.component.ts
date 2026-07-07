import { AsyncPipe, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, switchMap, tap } from 'rxjs';
import { AccountingApiService, JournalEntry } from '../../core/api/accounting-api.service';
import {
  ClientSetupItem,
  CompaniesApiService,
  ClientCompany,
} from '../../core/api/companies-api.service';
import {
  FixedAsset,
  FixedAssetFilters,
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
      <div class="page-actions">
        <button class="btn btn-secondary" type="button" (click)="exportCsv()">
          <span class="material-symbols-outlined">download</span>
          CSV
        </button>
        <button class="btn btn-primary" type="button" (click)="generateDepreciationForVisible()">
          <span class="material-symbols-outlined">functions</span>
          Αποσβέσεις {{ currentYear }}
        </button>
      </div>
    </section>

    <div class="alert alert-success" *ngIf="message">{{ message }}</div>
    <div class="alert alert-danger" *ngIf="errorMessage">{{ errorMessage }}</div>

    <section class="card asset-form-card">
      <div class="card-header">
        <div>
          <h2 class="card-title">
            <span class="material-symbols-outlined">inventory_2</span>
            {{ editingId ? 'Επεξεργασία παγίου' : 'Νέο πάγιο' }}
          </h2>
          <p class="card-subtitle">
            Καταχώριση αγοράς παγίου με καθαρή αξία, ΦΠΑ και συντελεστή απόσβεσης.
          </p>
        </div>
      </div>

      <form class="card-body form-grid" (ngSubmit)="save()">
        <label>
          Πελάτης
          <select
            [(ngModel)]="form.clientCompanyId"
            name="clientCompanyId"
            required
            (ngModelChange)="loadClientSetup($event)"
          >
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
          <select [(ngModel)]="form.category" name="category" (ngModelChange)="applyCategoryRate()">
            <option
              *ngFor="let item of fixedAssetCategoryOptions"
              [value]="fixedAssetCategory(item)"
            >
              {{ item.name }}
            </option>
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
          <button class="btn btn-secondary" type="button" *ngIf="editingId" (click)="cancelEdit()">
            Ακύρωση
          </button>
          <button class="btn btn-primary" type="submit">
            <span class="material-symbols-outlined">save</span>
            {{ editingId ? 'Αποθήκευση' : 'Καταχώριση παγίου' }}
          </button>
        </div>
      </form>
    </section>

    <section class="card filters-card">
      <div class="card-body filters">
        <label>
          Πελάτης
          <select [(ngModel)]="filters.clientCompanyId" (ngModelChange)="applyFilters()">
            <option value="">Όλοι οι πελάτες</option>
            <option *ngFor="let company of companies$ | async" [value]="company.id">
              {{ company.legalName }} - {{ company.vatNumber }}
            </option>
          </select>
        </label>
        <label>
          Κατηγορία
          <select [(ngModel)]="filters.category" (ngModelChange)="applyFilters()">
            <option value="">Όλες</option>
            <option value="EQUIPMENT">Εξοπλισμός</option>
            <option value="SOFTWARE">Λογισμικό</option>
            <option value="VEHICLE">Όχημα</option>
            <option value="FURNITURE">Έπιπλα</option>
            <option value="BUILDING">Κτίριο</option>
            <option value="OTHER">Άλλο</option>
          </select>
        </label>
        <label>
          Κατάσταση
          <select [(ngModel)]="filters.status" (ngModelChange)="applyFilters()">
            <option value="">Όλες</option>
            <option value="ACTIVE">Ενεργά</option>
            <option value="DISPOSED">Πωλημένα / διαγραμμένα</option>
            <option value="FULLY_DEPRECIATED">Πλήρως αποσβεσμένα</option>
          </select>
        </label>
      </div>
    </section>

    <section class="table-wrap" *ngIf="assets$ | async as assets">
      <div class="asset-summary" *ngIf="assets.length > 0">
        <div>
          <span>Πάγια</span>
          <strong>{{ assets.length }}</strong>
        </div>
        <div>
          <span>Καθαρή αξία</span>
          <strong>{{ assetSummary(assets).net | number: '1.2-2' }}</strong>
        </div>
        <div>
          <span>Αποσβέσεις</span>
          <strong>{{ assetSummary(assets).depreciation | number: '1.2-2' }}</strong>
        </div>
        <div>
          <span>Αναπόσβεστη</span>
          <strong>{{ assetSummary(assets).book | number: '1.2-2' }}</strong>
        </div>
      </div>
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
              <small *ngIf="asset.depreciationEntries && asset.depreciationEntries[0]">
                Τελευταία: {{ asset.depreciationEntries[0].fiscalYear }} /
                {{ asset.depreciationEntries[0].amount | number: '1.2-2' }}
                <span
                  class="badge"
                  [class.badge-success]="asset.depreciationEntries[0].posted"
                  [class.badge-warning]="!asset.depreciationEntries[0].posted"
                >
                  {{ asset.depreciationEntries[0].posted ? 'POSTED' : 'OPEN' }}
                </span>
              </small>
            </td>
            <td>{{ bookValue(asset) | number: '1.2-2' }}</td>
            <td class="row-actions">
              <button class="btn btn-xs btn-secondary" type="button" (click)="edit(asset)">
                Edit
              </button>
              <button
                class="btn btn-xs btn-secondary"
                type="button"
                (click)="generateDepreciation(asset)"
              >
                Απόσβεση {{ currentYear }}
              </button>
              <button
                class="btn btn-xs btn-secondary"
                type="button"
                [disabled]="!latestDepreciation(asset) || latestDepreciation(asset)?.posted"
                (click)="postLatestDepreciation(asset)"
              >
                Άρθρο
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

      .filters-card {
        margin-bottom: 16px;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }

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
        grid-column: span 2;
      }

      .form-actions,
      .row-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .asset-summary {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        border-bottom: 1px solid var(--border);
        margin: -1px -1px 12px;
      }

      .asset-summary div {
        display: grid;
        gap: 4px;
        padding: 12px 14px;
        border-right: 1px solid var(--border);
      }

      .asset-summary div:last-child {
        border-right: none;
      }

      .asset-summary span {
        color: var(--muted);
        font-size: 0.72rem;
        font-weight: 700;
      }

      .asset-summary strong {
        font-size: 1.12rem;
      }

      @media (max-width: 1080px) {
        .form-grid,
        .filters,
        .asset-summary {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 680px) {
        .form-grid,
        .filters,
        .asset-summary {
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
  private readonly accountingApi = inject(AccountingApiService);
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly reload$ = new BehaviorSubject<void>(undefined);
  private readonly filters$ = new BehaviorSubject<FixedAssetFilters>({});

  readonly companies$ = this.companiesApi.findAll();
  readonly assets$ = combineLatest([this.reload$, this.filters$]).pipe(
    switchMap(([, filters]) => this.fixedAssetsApi.findAll(filters)),
    tap((assets) => {
      this.latestAssets = assets;
    }),
  );
  readonly currentYear = new Date().getFullYear();
  readonly today = new Date().toISOString().slice(0, 10);
  private latestAssets: FixedAsset[] = [];
  message = '';
  errorMessage = '';
  editingId = '';
  filters: FixedAssetFilters = {};
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
  fixedAssetCategoryOptions: ClientSetupItem[] = defaultFixedAssetCategories();
  depreciationRuleOptions: ClientSetupItem[] = defaultDepreciationRules();

  constructor() {
    this.companies$.subscribe((companies: ClientCompany[]) => {
      if (!this.form.clientCompanyId && companies[0]) {
        this.form.clientCompanyId = companies[0].id;
        this.loadClientSetup(companies[0].id);
      }
    });
  }

  applyFilters(): void {
    this.filters$.next({ ...this.filters });
  }

  save(): void {
    this.clearMessages();
    const request = this.editingId
      ? this.fixedAssetsApi.update(this.editingId, this.form)
      : this.fixedAssetsApi.create(this.form);

    request.subscribe({
      next: () => {
        this.message = this.editingId ? 'Το πάγιο ενημερώθηκε.' : 'Το πάγιο καταχωρίστηκε.';
        this.cancelEdit(false);
        this.reload$.next();
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  edit(asset: FixedAsset): void {
    this.editingId = asset.id;
    this.form = {
      clientCompanyId: asset.clientCompanyId,
      code: asset.code,
      description: asset.description,
      category: asset.category,
      acquisitionDate: asset.acquisitionDate.slice(0, 10),
      depreciationStartDate: asset.depreciationStartDate.slice(0, 10),
      acquisitionDocumentNumber: asset.acquisitionDocumentNumber ?? '',
      supplierName: asset.supplierName ?? '',
      netValue: Number(asset.netValue || 0),
      vatAmount: Number(asset.vatAmount || 0),
      totalValue: Number(asset.totalValue || 0),
      depreciationRate: Number(asset.depreciationRate || 0),
      notes: asset.notes ?? '',
    };
    this.loadClientSetup(asset.clientCompanyId);
  }

  cancelEdit(resetMessage = true): void {
    if (resetMessage) {
      this.clearMessages();
    }
    this.editingId = '';
    this.form = defaultAssetForm(this.today);
  }

  calculateVat(rate: number): void {
    const net = Number(this.form.netValue || 0);
    const vat = Math.round(net * rate) / 100;

    this.form.vatAmount = vat;
    this.form.totalValue = Math.round((net + vat) * 100) / 100;
  }

  loadClientSetup(clientCompanyId: string): void {
    if (!clientCompanyId) {
      this.fixedAssetCategoryOptions = defaultFixedAssetCategories();
      this.depreciationRuleOptions = defaultDepreciationRules();
      return;
    }

    this.companiesApi.findSetupItems(clientCompanyId).subscribe((items) => {
      const categoryOptions = items.filter((item) => item.kind === 'FIXED_ASSET_CATEGORY');
      const depreciationRules = items.filter((item) => item.kind === 'DEPRECIATION_RULE');
      this.fixedAssetCategoryOptions =
        categoryOptions.length > 0 ? categoryOptions : defaultFixedAssetCategories();
      this.depreciationRuleOptions =
        depreciationRules.length > 0 ? depreciationRules : defaultDepreciationRules();

      if (
        !this.fixedAssetCategoryOptions.some(
          (item) => this.fixedAssetCategory(item) === this.form.category,
        )
      ) {
        this.form.category = this.fixedAssetCategory(this.fixedAssetCategoryOptions[0]);
      }
      this.applyCategoryRate();
    });
  }

  applyCategoryRate(): void {
    const selectedCategory = this.form.category ?? 'OTHER';
    const category = this.fixedAssetCategoryOptions.find(
      (item) => this.fixedAssetCategory(item) === selectedCategory,
    );
    const rule = this.depreciationRuleOptions.find(
      (item) => item.metadata?.['fixedAssetCategory'] === selectedCategory,
    );
    const rate = Number(
      rule?.metadata?.['rate'] ?? category?.metadata?.['defaultDepreciationRate'] ?? 20,
    );
    this.form.depreciationRate = rate;
  }

  fixedAssetCategory(item: ClientSetupItem): string {
    return String(item.metadata?.['fixedAssetCategory'] ?? item.code);
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

  postLatestDepreciation(asset: FixedAsset): void {
    const entry = this.latestDepreciation(asset);
    if (!entry) {
      this.message = 'Δεν υπάρχει απόσβεση για posting.';
      return;
    }

    this.clearMessages();
    this.accountingApi.postFixedAssetDepreciation(entry.id).subscribe({
      next: (journalEntry: JournalEntry) => {
        this.message = `Δημιουργήθηκε άρθρο απόσβεσης ${journalEntry.entryNumber}.`;
        this.reload$.next();
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  generateDepreciationForVisible(): void {
    this.clearMessages();
    const activeAssets = this.latestAssets.filter((asset) => asset.status === 'ACTIVE');
    if (activeAssets.length === 0) {
      this.message = 'Δεν υπάρχουν ενεργά πάγια στα φίλτρα.';
      return;
    }

    let completed = 0;
    let failed = 0;
    for (const asset of activeAssets) {
      this.fixedAssetsApi.generateDepreciation(asset.id, this.currentYear).subscribe({
        next: () => {
          completed += 1;
          this.finishBulkDepreciation(activeAssets.length, completed, failed);
        },
        error: () => {
          failed += 1;
          this.finishBulkDepreciation(activeAssets.length, completed, failed);
        },
      });
    }
  }

  assetSummary(assets: FixedAsset[]) {
    return assets.reduce(
      (summary, asset) => ({
        net: summary.net + Number(asset.netValue || 0),
        depreciation: summary.depreciation + Number(asset.accumulatedDepreciation || 0),
        book: summary.book + this.bookValue(asset),
      }),
      { net: 0, depreciation: 0, book: 0 },
    );
  }

  bookValue(asset: FixedAsset): number {
    return Number(asset.netValue || 0) - Number(asset.accumulatedDepreciation || 0);
  }

  latestDepreciation(asset: FixedAsset) {
    return asset.depreciationEntries?.[0];
  }

  exportCsv(): void {
    const header = [
      'company',
      'code',
      'description',
      'category',
      'acquisitionDate',
      'netValue',
      'vatAmount',
      'depreciationRate',
      'accumulatedDepreciation',
      'bookValue',
      'status',
    ];
    const rows = this.latestAssets.map((asset) => [
      asset.clientCompany?.legalName ?? '',
      asset.code,
      asset.description,
      asset.category,
      asset.acquisitionDate,
      asset.netValue,
      asset.vatAmount,
      asset.depreciationRate,
      asset.accumulatedDepreciation,
      this.bookValue(asset),
      asset.status,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fixed-assets-${this.currentYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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

  private finishBulkDepreciation(total: number, completed: number, failed: number): void {
    if (completed + failed !== total) {
      return;
    }

    this.message = `Ολοκληρώθηκαν ${completed} αποσβέσεις για ${this.currentYear}.`;
    if (failed > 0) {
      this.errorMessage = `${failed} πάγια δεν υπολογίστηκαν.`;
    }
    this.reload$.next();
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

function defaultFixedAssetCategories(): ClientSetupItem[] {
  return [
    {
      id: 'default-asset-equipment',
      clientCompanyId: '',
      kind: 'FIXED_ASSET_CATEGORY',
      code: 'EQUIPMENT',
      name: 'Εξοπλισμός',
      metadata: { fixedAssetCategory: 'EQUIPMENT', defaultDepreciationRate: 10 },
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'default-asset-software',
      clientCompanyId: '',
      kind: 'FIXED_ASSET_CATEGORY',
      code: 'SOFTWARE',
      name: 'Λογισμικό',
      metadata: { fixedAssetCategory: 'SOFTWARE', defaultDepreciationRate: 20 },
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'default-asset-vehicle',
      clientCompanyId: '',
      kind: 'FIXED_ASSET_CATEGORY',
      code: 'VEHICLE',
      name: 'Όχημα',
      metadata: { fixedAssetCategory: 'VEHICLE', defaultDepreciationRate: 16 },
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'default-asset-other',
      clientCompanyId: '',
      kind: 'FIXED_ASSET_CATEGORY',
      code: 'OTHER',
      name: 'Άλλο',
      metadata: { fixedAssetCategory: 'OTHER', defaultDepreciationRate: 20 },
      createdAt: '',
      updatedAt: '',
    },
  ];
}

function defaultDepreciationRules(): ClientSetupItem[] {
  return [
    {
      id: 'default-depr-equipment',
      clientCompanyId: '',
      kind: 'DEPRECIATION_RULE',
      code: 'EQUIPMENT_10',
      name: 'Απόσβεση εξοπλισμού 10%',
      metadata: { fixedAssetCategory: 'EQUIPMENT', rate: 10 },
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'default-depr-software',
      clientCompanyId: '',
      kind: 'DEPRECIATION_RULE',
      code: 'SOFTWARE_20',
      name: 'Απόσβεση λογισμικού 20%',
      metadata: { fixedAssetCategory: 'SOFTWARE', rate: 20 },
      createdAt: '',
      updatedAt: '',
    },
  ];
}

function defaultAssetForm(today: string): FixedAssetPayload {
  return {
    clientCompanyId: '',
    code: `FA-${new Date().getFullYear()}-001`,
    description: '',
    category: 'EQUIPMENT',
    acquisitionDate: today,
    netValue: 1000,
    vatAmount: 240,
    totalValue: 1240,
    depreciationRate: 20,
  };
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}
