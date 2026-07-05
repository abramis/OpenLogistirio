import { AsyncPipe, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { ClientCompany, CompaniesApiService } from '../../core/api/companies-api.service';
import { DocumentListItem, DocumentsApiService } from '../../core/api/documents-api.service';

interface CockpitMetric {
  label: string;
  value: number;
  suffix?: string;
  icon: string;
  tone?: 'danger' | 'warning' | 'ok';
}

interface CockpitVm {
  metrics: CockpitMetric[];
  monthNet: number;
  monthVat: number;
  payableVat: number;
  failedDocuments: DocumentListItem[];
  pendingDocuments: DocumentListItem[];
  clientsMissingMyData: ClientCompany[];
  recentDocuments: DocumentListItem[];
}

@Component({
  selector: 'ol-dashboard-page',
  standalone: true,
  imports: [AsyncPipe, DatePipe, DecimalPipe, NgFor, NgIf, RouterLink],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Cockpit</h1>
        <p class="page-subtitle">Καθημερινή εικόνα γραφείου — πελάτες, παραστατικά, ΦΠΑ, myDATA</p>
      </div>
      <div class="page-actions">
        <a class="btn btn-secondary" routerLink="/companies/new">
          <span class="material-symbols-outlined">person_add</span>
          Νέος πελάτης
        </a>
        <a class="btn btn-primary" routerLink="/documents/new">
          <span class="material-symbols-outlined">add</span>
          Νέο παραστατικό
        </a>
      </div>
    </section>

    <ng-container *ngIf="vm$ | async as vm">
      <!-- KPI strip -->
      <section class="kpi-strip" aria-label="Μετρικές γραφείου">
        <article
          *ngFor="let m of vm.metrics"
          class="kpi-card"
          [class.kpi-danger]="m.tone === 'danger'"
          [class.kpi-warning]="m.tone === 'warning'"
        >
          <span class="kpi-icon material-symbols-outlined">{{ m.icon }}</span>
          <div>
            <span class="kpi-label">{{ m.label }}</span>
            <strong class="kpi-value">{{ m.value | number: '1.0-0' }}{{ m.suffix || '' }}</strong>
          </div>
        </article>
      </section>

      <!-- Row 1: Priority queue + Month summary -->
      <section class="dash-row">
        <article class="card flex-2">
          <div class="card-header">
            <div>
              <h2 class="card-title">
                <span class="material-symbols-outlined">priority_high</span>
                Θέλουν χειρισμό
              </h2>
              <p class="card-subtitle">Εκκρεμότητες που αξίζει να ελεγχθούν πρώτα</p>
            </div>
            <a class="btn btn-ghost btn-sm" routerLink="/documents">
              Όλα τα παραστατικά
              <span class="material-symbols-outlined">arrow_forward</span>
            </a>
          </div>
          <div class="card-body queue">
            <a
              class="queue-item queue-danger"
              routerLink="/documents"
              *ngIf="vm.failedDocuments.length > 0"
            >
              <span class="material-symbols-outlined qi-icon">error</span>
              <span class="qi-text">
                <strong>{{ vm.failedDocuments.length }} αποτυχημένες διαβιβάσεις myDATA</strong>
                <small>Άνοιγμα λίστας για έλεγχο και retry</small>
              </span>
              <span class="material-symbols-outlined qi-arrow">chevron_right</span>
            </a>

            <a
              class="queue-item queue-warning"
              routerLink="/companies"
              *ngIf="vm.clientsMissingMyData.length > 0"
            >
              <span class="material-symbols-outlined qi-icon">warning</span>
              <span class="qi-text">
                <strong>{{ vm.clientsMissingMyData.length }} πελάτες θέλουν ρύθμιση AADE</strong>
                <small>Λείπει εξουσιοδότηση, mode ή env reference</small>
              </span>
              <span class="material-symbols-outlined qi-arrow">chevron_right</span>
            </a>

            <a class="queue-item" routerLink="/documents" *ngIf="vm.pendingDocuments.length > 0">
              <span class="material-symbols-outlined qi-icon">schedule</span>
              <span class="qi-text">
                <strong>{{ vm.pendingDocuments.length }} παραστατικά σε εκκρεμότητα</strong>
                <small>Draft ή έτοιμα προς αποστολή</small>
              </span>
              <span class="material-symbols-outlined qi-arrow">chevron_right</span>
            </a>

            <div
              class="queue-ok"
              *ngIf="
                vm.failedDocuments.length +
                  vm.clientsMissingMyData.length +
                  vm.pendingDocuments.length ===
                0
              "
            >
              <span class="material-symbols-outlined">check_circle</span>
              Δεν υπάρχουν άμεσες εκκρεμότητες.
            </div>
          </div>
        </article>

        <article class="card flex-1">
          <div class="card-header">
            <div>
              <h2 class="card-title">
                <span class="material-symbols-outlined">calendar_month</span>
                Τρέχων μήνας
              </h2>
              <p class="card-subtitle">Σύνοψη παραστατικών</p>
            </div>
            <a class="btn btn-ghost btn-sm" routerLink="/vat-book">
              Βιβλίο ΦΠΑ <span class="material-symbols-outlined">arrow_forward</span>
            </a>
          </div>
          <div class="card-body">
            <dl class="month-dl">
              <div class="month-row">
                <dt>Καθαρή αξία</dt>
                <dd>{{ vm.monthNet | number: '1.2-2' }} €</dd>
              </div>
              <div class="month-row">
                <dt>ΦΠΑ εκροών</dt>
                <dd>{{ vm.monthVat | number: '1.2-2' }} €</dd>
              </div>
              <div class="month-row month-highlight">
                <dt>Εκτίμηση πληρωτέου ΦΠΑ</dt>
                <dd [class.credit]="vm.payableVat < 0">{{ vm.payableVat | number: '1.2-2' }} €</dd>
              </div>
            </dl>
          </div>
        </article>
      </section>

      <!-- Row 2: Recent docs + Quick actions -->
      <section class="dash-row">
        <article class="card flex-2">
          <div class="card-header">
            <div>
              <h2 class="card-title">
                <span class="material-symbols-outlined">receipt_long</span>
                Πρόσφατα παραστατικά
              </h2>
              <p class="card-subtitle">Τελευταίες κινήσεις στο γραφείο</p>
            </div>
            <a class="btn btn-ghost btn-sm" routerLink="/documents/new">
              <span class="material-symbols-outlined">add</span>
              Καταχώριση
            </a>
          </div>

          <div *ngIf="vm.recentDocuments.length > 0; else noDocuments">
            <table>
              <thead>
                <tr>
                  <th>Παραστατικό</th>
                  <th>Πελάτης</th>
                  <th>Ημερομηνία</th>
                  <th class="tr">Σύνολο</th>
                  <th>myDATA</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let doc of vm.recentDocuments">
                  <td>
                    <strong>{{ doc.series || '-' }}/{{ doc.documentNumber }}</strong>
                    <small>{{ documentTypeLabel(doc.documentType) }}</small>
                  </td>
                  <td>
                    {{ doc.clientCompany.legalName }}
                    <small>{{ doc.clientCompany.vatNumber }}</small>
                  </td>
                  <td>{{ doc.issueDate | date: 'dd/MM/yy' }}</td>
                  <td class="tr">
                    <strong>{{ doc.totalAmount | number: '1.2-2' }}</strong>
                  </td>
                  <td>
                    <span
                      class="badge"
                      [class.badge-success]="doc.myDataStatus === 'SENT'"
                      [class.badge-danger]="doc.myDataStatus === 'FAILED'"
                      [class.badge-warning]="doc.myDataStatus === 'READY_TO_SEND'"
                      [class.badge-neutral]="
                        doc.myDataStatus === 'DRAFT' || doc.myDataStatus === 'CANCELLED'
                      "
                      >{{ myDataStatusLabel(doc.myDataStatus) }}</span
                    >
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <ng-template #noDocuments>
            <div class="empty-state">
              <span class="material-symbols-outlined">receipt_long</span>
              <p>Δεν υπάρχουν παραστατικά ακόμα.</p>
            </div>
          </ng-template>
        </article>

        <article class="card flex-1">
          <div class="card-header">
            <div>
              <h2 class="card-title">
                <span class="material-symbols-outlined">bolt</span>
                Γρήγορες εργασίες
              </h2>
              <p class="card-subtitle">Άμεση πρόσβαση</p>
            </div>
          </div>
          <nav class="quick-nav" aria-label="Γρήγορες εργασίες">
            <a class="quick-link" routerLink="/companies">
              <span class="material-symbols-outlined ql-icon">groups</span>
              <span>Μητρώο πελατών</span>
              <span class="material-symbols-outlined ql-arr">chevron_right</span>
            </a>
            <a class="quick-link" routerLink="/companies/new">
              <span class="material-symbols-outlined ql-icon">person_add</span>
              <span>Νέος πελάτης</span>
              <span class="material-symbols-outlined ql-arr">chevron_right</span>
            </a>
            <a class="quick-link" routerLink="/documents">
              <span class="material-symbols-outlined ql-icon">receipt_long</span>
              <span>Παραστατικά &amp; myDATA</span>
              <span class="material-symbols-outlined ql-arr">chevron_right</span>
            </a>
            <a class="quick-link" routerLink="/documents/new">
              <span class="material-symbols-outlined ql-icon">add_circle</span>
              <span>Νέο παραστατικό</span>
              <span class="material-symbols-outlined ql-arr">chevron_right</span>
            </a>
            <a class="quick-link" routerLink="/vat-book">
              <span class="material-symbols-outlined ql-icon">calculate</span>
              <span>Βιβλίο ΦΠΑ</span>
              <span class="material-symbols-outlined ql-arr">chevron_right</span>
            </a>
          </nav>
        </article>
      </section>
    </ng-container>
  `,
  styles: [
    `
      /* KPI strip */
      .kpi-strip {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 12px;
        margin-bottom: 16px;
      }

      .kpi-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface);
        box-shadow: var(--shadow-sm);
      }

      .kpi-card.kpi-danger {
        border-left: 3px solid var(--err);
      }
      .kpi-card.kpi-warning {
        border-left: 3px solid var(--warn);
      }

      .kpi-icon {
        font-size: 22px;
        color: var(--muted-2);
        flex-shrink: 0;
      }
      .kpi-danger .kpi-icon {
        color: var(--err);
      }
      .kpi-warning .kpi-icon {
        color: var(--warn);
      }

      .kpi-label {
        display: block;
        font-size: 0.6875rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 2px;
      }
      .kpi-value {
        font-size: 1.4rem;
        font-weight: 700;
        line-height: 1;
      }

      /* Dashboard rows */
      .dash-row {
        display: grid;
        grid-template-columns: 1.35fr 0.65fr;
        gap: 16px;
        margin-bottom: 16px;
      }

      .flex-1 {
        min-width: 0;
      }
      .flex-2 {
        min-width: 0;
      }

      /* Queue */
      .queue {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .queue-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border: 1px solid var(--border);
        border-radius: 8px;
        transition: background 100ms;
      }
      .queue-item:hover {
        background: var(--surface-2);
      }

      .queue-danger {
        border-color: var(--err-bd);
        background: var(--err-bg);
      }
      .queue-warning {
        border-color: var(--warn-bd);
        background: var(--warn-bg);
      }

      .qi-icon {
        font-size: 22px;
        color: var(--muted);
        flex-shrink: 0;
      }
      .queue-danger .qi-icon {
        color: var(--err);
      }
      .queue-warning .qi-icon {
        color: var(--warn);
      }

      .qi-text {
        flex: 1;
      }
      .qi-text strong {
        display: block;
        font-size: 0.875rem;
        color: var(--text);
        font-weight: 600;
      }
      .qi-text small {
        font-size: 0.75rem;
      }

      .qi-arrow {
        font-size: 18px;
        color: var(--muted-2);
        flex-shrink: 0;
      }

      .queue-ok {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        border: 1px solid var(--ok-bd);
        border-radius: 8px;
        background: var(--ok-bg);
        color: var(--ok);
        font-size: 0.875rem;
        font-weight: 500;
      }
      .queue-ok .material-symbols-outlined {
        font-size: 20px;
      }

      /* Month DL */
      .month-dl {
        margin: 0;
        display: flex;
        flex-direction: column;
      }
      .month-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 12px;
        padding: 11px 0;
        border-bottom: 1px solid var(--border);
        font-size: 0.875rem;
      }
      .month-row:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }
      .month-row dt {
        color: var(--muted);
      }
      .month-row dd {
        margin: 0;
        font-weight: 700;
      }

      .month-highlight {
        margin: 0 -18px -18px;
        padding: 12px 18px;
        background: var(--surface-2);
        border-bottom: none !important;
      }
      .credit {
        color: var(--ok);
      }

      /* Table alignment */
      .tr {
        text-align: right;
      }

      /* Quick nav */
      .quick-nav {
        display: flex;
        flex-direction: column;
      }
      .quick-link {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 11px 18px;
        border-bottom: 1px solid var(--border);
        font-size: 0.875rem;
        color: var(--text-2);
        transition:
          background 100ms,
          color 100ms;
      }
      .quick-link:last-child {
        border-bottom: none;
      }
      .quick-link:hover {
        background: var(--primary-bg);
        color: var(--primary);
      }
      .quick-link:hover .ql-icon {
        color: var(--primary);
      }

      .ql-icon {
        font-size: 18px;
        color: var(--muted);
        flex-shrink: 0;
      }
      .ql-arr {
        margin-left: auto;
        font-size: 16px;
        color: var(--muted-2);
        flex-shrink: 0;
      }

      @media (max-width: 1100px) {
        .kpi-strip {
          grid-template-columns: repeat(3, 1fr);
        }
        .dash-row {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 680px) {
        .kpi-strip {
          grid-template-columns: 1fr 1fr;
        }
      }
    `,
  ],
})
export class DashboardPageComponent {
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly documentsApi = inject(DocumentsApiService);

  readonly vm$ = combineLatest([this.companiesApi.findAll(), this.documentsApi.findAll()]).pipe(
    map(([companies, documents]) => toCockpitVm(companies, documents)),
  );

  documentTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      SALES_INVOICE: 'Τιμολόγιο πώλησης',
      PURCHASE_INVOICE: 'Τιμολόγιο αγοράς',
      CREDIT_NOTE: 'Πιστωτικό',
      RETAIL_RECEIPT: 'Απόδειξη λιανικής',
    };

    return labels[type] ?? type;
  }

  myDataStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      DRAFT: 'Πρόχειρο',
      READY_TO_SEND: 'Έτοιμο',
      SENT: 'Στάλθηκε',
      FAILED: 'Αποτυχία',
      CANCELLED: 'Ακυρωμένο',
    };

    return labels[status] ?? status;
  }
}

function toCockpitVm(companies: ClientCompany[], documents: DocumentListItem[]): CockpitVm {
  const month = new Date().toISOString().slice(0, 7);
  const monthDocuments = documents.filter((document) => document.issueDate.startsWith(month));
  const failedDocuments = documents.filter((document) => document.myDataStatus === 'FAILED');
  const pendingDocuments = documents.filter((document) =>
    ['DRAFT', 'READY_TO_SEND'].includes(document.myDataStatus),
  );
  const clientsMissingMyData = companies.filter(needsMyDataSetup);
  const salesVat = monthDocuments
    .filter((document) => document.documentType !== 'PURCHASE_INVOICE')
    .reduce((sum, document) => sum + Number(document.vatAmount || 0), 0);
  const purchasesVat = monthDocuments
    .filter((document) => document.documentType === 'PURCHASE_INVOICE')
    .reduce((sum, document) => sum + Number(document.vatAmount || 0), 0);

  return {
    metrics: [
      { label: 'Πελάτες', value: companies.length, icon: 'groups' },
      { label: 'Παραστατικά', value: documents.length, icon: 'receipt_long' },
      {
        label: 'Εκκρεμή myDATA',
        value: pendingDocuments.length,
        icon: 'schedule',
        tone: 'warning',
      },
      {
        label: 'Αποτυχίες myDATA',
        value: failedDocuments.length,
        icon: 'error',
        tone: failedDocuments.length ? 'danger' : 'ok',
      },
      {
        label: 'AADE setup λείπει',
        value: clientsMissingMyData.length,
        icon: 'warning',
        tone: clientsMissingMyData.length ? 'warning' : 'ok',
      },
    ],
    monthNet: monthDocuments.reduce((sum, document) => sum + Number(document.netAmount || 0), 0),
    monthVat: monthDocuments.reduce((sum, document) => sum + Number(document.vatAmount || 0), 0),
    payableVat: salesVat - purchasesVat,
    failedDocuments: failedDocuments.slice(0, 5),
    pendingDocuments: pendingDocuments.slice(0, 5),
    clientsMissingMyData: clientsMissingMyData.slice(0, 5),
    recentDocuments: documents.slice(0, 6),
  };
}

function needsMyDataSetup(company: ClientCompany): boolean {
  if (company.myDataMode === 'ACCOUNTING_OFFICE_AUTHORIZED') {
    return !company.myDataAuthorized;
  }

  if (company.myDataMode === 'OWN_API_CREDENTIALS_ENV_REF') {
    return !company.myDataCredentialRef;
  }

  return company.myDataMode === 'NOT_CONFIGURED';
}
