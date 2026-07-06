import { AsyncPipe, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BehaviorSubject, map, switchMap } from 'rxjs';
import { CompaniesApiService } from '../../core/api/companies-api.service';
import { DocumentListItem, DocumentsApiService } from '../../core/api/documents-api.service';

@Component({
  selector: 'ol-company-details-page',
  standalone: true,
  imports: [AsyncPipe, DatePipe, DecimalPipe, NgFor, NgIf, RouterLink],
  template: `
    <ng-container *ngIf="company$ | async as company">
      <section class="page-header">
        <div>
          <h1 class="page-title">{{ company.legalName }}</h1>
          <p class="page-subtitle">
            {{ entityTypeLabel(company.entityType) }}
            <span *ngIf="company.professionLabel"> — {{ company.professionLabel }}</span>
          </p>
        </div>
        <div class="page-actions">
          <a class="btn btn-secondary" routerLink="/companies">
            <span class="material-symbols-outlined">arrow_back</span>
            Πίσω
          </a>
          <a class="btn btn-primary" [routerLink]="['/companies', company.id, 'edit']">
            <span class="material-symbols-outlined">edit</span>
            Επεξεργασία
          </a>
        </div>
      </section>

      <div class="details-grid">
        <div class="card detail-section">
          <div class="card-header">
            <h2 class="card-title">
              <span class="material-symbols-outlined">badge</span>
              Ταυτότητα
            </h2>
          </div>
          <dl class="detail-dl">
            <div class="detail-row">
              <dt>Επωνυμία</dt>
              <dd>{{ company.legalName }}</dd>
            </div>
            <div class="detail-row">
              <dt>Διακριτικός τίτλος</dt>
              <dd>{{ company.tradeName || '—' }}</dd>
            </div>
            <div class="detail-row">
              <dt>Τύπος</dt>
              <dd>{{ entityTypeLabel(company.entityType) }}</dd>
            </div>
            <div class="detail-row">
              <dt>Επάγγελμα</dt>
              <dd>{{ company.professionLabel || '—' }}</dd>
            </div>
          </dl>
        </div>

        <div class="card detail-section">
          <div class="card-header">
            <h2 class="card-title">
              <span class="material-symbols-outlined">account_balance</span>
              Φορολογικά
            </h2>
          </div>
          <dl class="detail-dl">
            <div class="detail-row">
              <dt>ΑΦΜ</dt>
              <dd class="mono">{{ company.vatNumber }}</dd>
            </div>
            <div class="detail-row">
              <dt>ΔΟΥ</dt>
              <dd>{{ company.taxOffice || '—' }}</dd>
            </div>
            <div class="detail-row">
              <dt>ΚΑΔ</dt>
              <dd>{{ company.activityCodes?.join(', ') || '—' }}</dd>
            </div>
            <div class="detail-row">
              <dt>Καθεστώς ΦΠΑ</dt>
              <dd>{{ vatRegimeLabel(company.vatRegime) }}</dd>
            </div>
            <div class="detail-row">
              <dt>Κατηγορία βιβλίων</dt>
              <dd>{{ accountingCategoryLabel(company.accountingCategory) }}</dd>
            </div>
            <div class="detail-row">
              <dt>Φορολογικό έτος</dt>
              <dd>{{ company.fiscalYearStart }} – {{ company.fiscalYearEnd }}</dd>
            </div>
          </dl>
        </div>

        <div class="card detail-section">
          <div class="card-header">
            <h2 class="card-title">
              <span class="material-symbols-outlined">cloud_sync</span>
              AADE myDATA
            </h2>
          </div>
          <dl class="detail-dl">
            <div class="detail-row">
              <dt>Τρόπος διαβίβασης</dt>
              <dd>{{ myDataModeLabel(company.myDataMode) }}</dd>
            </div>
            <div class="detail-row">
              <dt>Εξουσιοδότηση λογιστή</dt>
              <dd>
                <span
                  class="badge"
                  [class.badge-success]="company.myDataAuthorized"
                  [class.badge-neutral]="!company.myDataAuthorized"
                >
                  {{ company.myDataAuthorized ? 'Ενεργή' : 'Δεν έχει σημειωθεί' }}
                </span>
              </dd>
            </div>
            <div class="detail-row">
              <dt>Env credentials ref</dt>
              <dd class="mono">{{ company.myDataCredentialRef || '—' }}</dd>
            </div>
          </dl>
        </div>

        <div class="card detail-section">
          <div class="card-header">
            <h2 class="card-title">
              <span class="material-symbols-outlined">contact_mail</span>
              Επικοινωνία
            </h2>
          </div>
          <dl class="detail-dl">
            <div class="detail-row">
              <dt>Διεύθυνση</dt>
              <dd>{{ company.address || '—' }}</dd>
            </div>
            <div class="detail-row">
              <dt>Email</dt>
              <dd>{{ company.email || '—' }}</dd>
            </div>
            <div class="detail-row">
              <dt>Τηλέφωνο</dt>
              <dd>{{ company.phone || '—' }}</dd>
            </div>
            <div class="detail-row">
              <dt>Τελευταία ενημέρωση</dt>
              <dd>{{ company.updatedAt | date: 'dd/MM/yyyy HH:mm' }}</dd>
            </div>
          </dl>
        </div>

        <div class="card detail-section setup-section">
          <div class="card-header">
            <h2 class="card-title">
              <span class="material-symbols-outlined">rule_settings</span>
              Παραμετροποίηση
            </h2>
          </div>
          <div class="setup-panel">
            <label class="field">
              <span class="field-label">Πρότυπο</span>
              <select
                [value]="selectedTemplateId"
                (change)="selectedTemplateId = $any($event.target).value"
              >
                <option value="">Επιλέξτε πρότυπο</option>
                <option *ngFor="let template of setupTemplates$ | async" [value]="template.id">
                  {{ template.name }} ({{ template.itemCount }})
                </option>
              </select>
            </label>
            <button
              type="button"
              class="btn btn-primary"
              [disabled]="!selectedTemplateId || isApplyingSetup"
              (click)="applySetupTemplate(company.id)"
            >
              <span class="material-symbols-outlined">playlist_add_check</span>
              {{ isApplyingSetup ? 'Εφαρμογή...' : 'Εφαρμογή προτύπου' }}
            </button>
            <p class="field-note" *ngIf="setupStatus">{{ setupStatus }}</p>
            <p class="field-error" *ngIf="setupError">{{ setupError }}</p>
          </div>

          <ng-container *ngIf="setupItems$ | async as setupItems">
            <div class="setup-empty" *ngIf="setupItems.length === 0">
              Δεν έχει εφαρμοστεί ακόμα πρότυπο παραμετροποίησης.
            </div>
            <div class="setup-list" *ngIf="setupItems.length > 0">
              <div class="setup-row" *ngFor="let item of setupItems">
                <span class="badge badge-neutral">{{ setupKindLabel(item.kind) }}</span>
                <div>
                  <strong>{{ item.name }}</strong>
                  <small>{{ item.code }}</small>
                </div>
              </div>
            </div>
          </ng-container>
        </div>

        <div class="card detail-section movements-section">
          <div class="card-header">
            <h2 class="card-title">
              <span class="material-symbols-outlined">receipt_long</span>
              Κινήσεις / Βιβλία
            </h2>
          </div>
          <ng-container *ngIf="movementBook$ | async as book">
            <div class="movement-summary">
              <div>
                <span>Παραστατικά</span>
                <strong>{{ book.documents.length }}</strong>
              </div>
              <div>
                <span>Πωλήσεις</span>
                <strong>{{ book.salesTotal | number: '1.2-2' }}</strong>
              </div>
              <div>
                <span>Αγορές / Δαπάνες</span>
                <strong>{{ book.purchasesTotal | number: '1.2-2' }}</strong>
              </div>
              <div>
                <span>ΦΠΑ</span>
                <strong>{{ book.vatTotal | number: '1.2-2' }}</strong>
              </div>
            </div>

            <div class="setup-empty" *ngIf="book.documents.length === 0">
              Δεν υπάρχουν ακόμα κινήσεις για τον πελάτη.
            </div>
            <div class="movement-table" *ngIf="book.documents.length > 0">
              <table>
                <thead>
                  <tr>
                    <th>Ημερ.</th>
                    <th>Παραστατικό</th>
                    <th>Κίνηση</th>
                    <th>Ημερολόγιο</th>
                    <th>Αντισυμβαλλόμενος</th>
                    <th class="tr">Καθαρή</th>
                    <th class="tr">ΦΠΑ</th>
                    <th class="tr">Σύνολο</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let document of book.documents">
                    <td>{{ document.issueDate | date: 'dd/MM/yy' }}</td>
                    <td>
                      <strong>{{ document.series || '-' }}/{{ document.documentNumber }}</strong>
                      <small>{{ documentTypeLabel(document.documentType) }}</small>
                    </td>
                    <td>{{ movementLabel(document.movementCode) }}</td>
                    <td>{{ journalLabel(document.journalCode) }}</td>
                    <td>{{ document.counterpartyName || '-' }}</td>
                    <td class="tr">{{ document.netAmount | number: '1.2-2' }}</td>
                    <td class="tr">{{ document.vatAmount | number: '1.2-2' }}</td>
                    <td class="tr">
                      <strong>{{ document.totalAmount | number: '1.2-2' }}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </ng-container>
        </div>
      </div>
    </ng-container>
  `,
  styles: [
    `
      .details-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }

      .detail-section {
        min-width: 0;
      }

      .detail-dl {
        margin: 0;
      }

      .detail-row {
        display: grid;
        grid-template-columns: 140px 1fr;
        gap: 8px;
        padding: 10px 18px;
        border-bottom: 1px solid var(--border);
        font-size: 0.875rem;
        align-items: baseline;
      }
      .detail-row:last-child {
        border-bottom: none;
      }

      dt {
        color: var(--muted);
        font-size: 0.8rem;
        font-weight: 600;
      }
      dd {
        margin: 0;
        font-weight: 500;
      }

      .mono {
        font-family: ui-monospace, monospace;
        font-size: 0.8125rem;
      }

      .setup-section,
      .movements-section {
        grid-column: 1 / -1;
      }

      .setup-panel {
        display: grid;
        grid-template-columns: minmax(260px, 1fr) auto;
        gap: 12px;
        align-items: end;
        padding: 16px 18px;
        border-bottom: 1px solid var(--border);
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      .field-label {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--text-2);
      }

      .field-note,
      .field-error {
        grid-column: 1 / -1;
        margin: 0;
        font-size: 0.8125rem;
      }

      .field-note {
        color: var(--ok);
      }

      .field-error {
        color: var(--err);
      }

      .setup-empty {
        padding: 16px 18px;
        color: var(--muted);
        font-size: 0.875rem;
      }

      .setup-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .setup-row {
        display: grid;
        grid-template-columns: 150px minmax(0, 1fr);
        gap: 10px;
        padding: 12px 18px;
        border-bottom: 1px solid var(--border);
        align-items: start;
      }

      .setup-row:nth-child(odd) {
        border-right: 1px solid var(--border);
      }

      .setup-row strong,
      .setup-row small {
        display: block;
      }

      .setup-row small {
        margin-top: 3px;
        color: var(--muted);
        font-family: ui-monospace, monospace;
        font-size: 0.75rem;
      }

      .movement-summary {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        border-bottom: 1px solid var(--border);
      }

      .movement-summary div {
        display: grid;
        gap: 4px;
        padding: 14px 18px;
        border-right: 1px solid var(--border);
      }

      .movement-summary div:last-child {
        border-right: none;
      }

      .movement-summary span {
        color: var(--muted);
        font-size: 0.75rem;
        font-weight: 700;
      }

      .movement-table {
        overflow-x: auto;
      }

      .movement-table td strong,
      .movement-table td small {
        display: block;
      }

      .movement-table td small {
        margin-top: 3px;
        color: var(--muted);
      }

      .tr {
        text-align: right;
      }

      @media (max-width: 900px) {
        .details-grid {
          grid-template-columns: 1fr;
        }

        .setup-panel,
        .setup-list,
        .setup-row,
        .movement-summary {
          grid-template-columns: 1fr;
        }

        .setup-row:nth-child(odd) {
          border-right: none;
        }
      }
    `,
  ],
})
export class CompanyDetailsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly documentsApi = inject(DocumentsApiService);
  private readonly setupReload$ = new BehaviorSubject<void>(undefined);

  selectedTemplateId = '';
  isApplyingSetup = false;
  setupStatus = '';
  setupError = '';

  readonly company$ = this.route.paramMap.pipe(
    map((params) => params.get('id') ?? ''),
    switchMap((id) => this.companiesApi.findOne(id)),
  );

  readonly setupTemplates$ = this.route.paramMap.pipe(
    map((params) => params.get('id') ?? ''),
    switchMap((id) => this.companiesApi.listSetupTemplates(id)),
  );

  readonly setupItems$ = this.setupReload$.pipe(
    switchMap(() => this.route.paramMap),
    map((params) => params.get('id') ?? ''),
    switchMap((id) => this.companiesApi.findSetupItems(id)),
  );

  readonly movementBook$ = this.setupReload$.pipe(
    switchMap(() => this.route.paramMap),
    map((params) => params.get('id') ?? ''),
    switchMap((id) => this.documentsApi.findAll({ clientCompanyId: id })),
    map((documents) => ({
      documents,
      salesTotal: sumByMovement(documents, ['SALE_INVOICE', 'CREDIT_NOTE']),
      purchasesTotal: sumByMovement(documents, ['PURCHASE_INVOICE']),
      vatTotal: documents.reduce((sum, document) => sum + Number(document.vatAmount || 0), 0),
    })),
  );

  applySetupTemplate(companyId: string): void {
    if (!this.selectedTemplateId) {
      return;
    }

    this.isApplyingSetup = true;
    this.setupStatus = '';
    this.setupError = '';

    this.companiesApi.applySetupTemplate(companyId, this.selectedTemplateId).subscribe({
      next: (result) => {
        this.isApplyingSetup = false;
        this.setupStatus = `Εφαρμόστηκαν ${result.appliedCount} στοιχεία παραμετροποίησης.`;
        this.setupReload$.next();
      },
      error: (error: { error?: { message?: string | string[] }; message?: string }) => {
        this.isApplyingSetup = false;
        const message = error.error?.message ?? error.message;
        this.setupError = Array.isArray(message)
          ? message.join(', ')
          : (message ?? 'Δεν ολοκληρώθηκε η εφαρμογή προτύπου.');
      },
    });
  }

  setupKindLabel(kind: string): string {
    const labels: Record<string, string> = {
      BOOK_SYSTEM: 'Σύστημα βιβλίων',
      ACCOUNTING_PLAN: 'Λογιστικό σχέδιο',
      ACCOUNT_TYPE: 'Είδη λογαριασμών',
      MOVEMENT_CODE: 'Κωδικοί κίνησης',
      JOURNAL: 'Ημερολόγια',
      VAT_SETUP: 'ΦΠΑ',
      FIXED_ASSET_CATEGORY: 'Κατηγορίες παγίων',
      DEPRECIATION_RULE: 'Κανόνες απόσβεσης',
      TAX_ADJUSTMENT: 'Αναμόρφωση',
      INTRASTAT: 'Intrastat',
    };

    return labels[kind] ?? kind;
  }

  movementLabel(code?: string | null): string {
    const labels: Record<string, string> = {
      SALE_INVOICE: 'Πώληση',
      PURCHASE_INVOICE: 'Αγορά / δαπάνη',
      CREDIT_NOTE: 'Πιστωτικό',
    };

    return code ? (labels[code] ?? code) : '-';
  }

  journalLabel(code?: string | null): string {
    const labels: Record<string, string> = {
      SALES: 'Πωλήσεων',
      PURCHASES: 'Αγορών',
      CASH_BANK: 'Ταμείο / τράπεζες',
      GENERAL: 'Γενικό',
    };

    return code ? (labels[code] ?? code) : '-';
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

  entityTypeLabel(entityType: string): string {
    const labels: Record<string, string> = {
      COMPANY: 'Εταιρεία',
      FREELANCER: 'Ελεύθερος επαγγελματίας',
      SOLE_PROPRIETOR: 'Ατομική επιχείρηση',
      NON_PROFIT: 'Μη κερδοσκοπικός φορέας',
      OTHER: 'Άλλο',
    };

    return labels[entityType] ?? entityType;
  }

  accountingCategoryLabel(value?: string | null): string {
    const labels: Record<string, string> = {
      SIMPLE_BOOKS: 'Απλογραφικά',
      DOUBLE_ENTRY: 'Διπλογραφικά',
      EXEMPT_BOOKS: 'Χωρίς τήρηση βιβλίων',
    };

    return value ? (labels[value] ?? value) : '-';
  }

  vatRegimeLabel(value?: string | null): string {
    const labels: Record<string, string> = {
      NORMAL: 'Κανονικό',
      EXEMPT: 'Απαλλασσόμενο',
      SMALL_BUSINESS: 'Μικρών επιχειρήσεων',
      ARTICLE_39: 'Άρθρο 39',
      INTRA_COMMUNITY: 'Ενδοκοινοτικές συναλλαγές',
    };

    return value ? (labels[value] ?? value) : '-';
  }

  myDataModeLabel(value: string): string {
    const labels: Record<string, string> = {
      ACCOUNTING_OFFICE_AUTHORIZED: 'Με εξουσιοδότηση λογιστικού γραφείου',
      OWN_API_CREDENTIALS_ENV_REF: 'Με δικά του API credentials από env',
      MANUAL_UPLOAD: 'Χειροκίνητη αποστολή/ανέβασμα',
      NOT_CONFIGURED: 'Δεν έχει ρυθμιστεί',
    };

    return labels[value] ?? value;
  }
}

function sumByMovement(documents: DocumentListItem[], movementCodes: string[]): number {
  return documents
    .filter((document) => movementCodes.includes(document.movementCode ?? ''))
    .reduce((sum, document) => sum + Number(document.netAmount || 0), 0);
}
