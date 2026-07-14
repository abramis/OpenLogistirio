import { AsyncPipe, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BehaviorSubject, map, switchMap } from 'rxjs';
import { CompaniesApiService } from '../../core/api/companies-api.service';
import { DocumentListItem, DocumentsApiService } from '../../core/api/documents-api.service';
import { MyDataApiService } from '../../core/api/mydata-api.service';

@Component({
  selector: 'ol-company-details-page',
  standalone: true,
  imports: [AsyncPipe, DatePipe, DecimalPipe, FormsModule, NgFor, NgIf, RouterLink],
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

        <div class="card detail-section classification-section">
          <div class="card-header">
            <h2 class="card-title">
              <span class="material-symbols-outlined">category</span>
              Προφίλ χαρακτηρισμών myDATA
            </h2>
          </div>
          <p class="section-note">
            Εφαρμόζονται αυτόματα στις γραμμές που δεν έχουν ρητό χαρακτηρισμό. Όσο πιο συγκεκριμένο
            το προφίλ, τόσο υψηλότερη η προτεραιότητά του.
          </p>
          <div class="profile-form">
            <label class="field">
              <span class="field-label">Κωδικός *</span>
              <input [(ngModel)]="profileCode" placeholder="π.χ. CONSULTING_24" />
            </label>
            <label class="field">
              <span class="field-label">Ονομασία *</span>
              <input [(ngModel)]="profileName" placeholder="π.χ. Υπηρεσίες συμβουλευτικής" />
            </label>
            <label class="field">
              <span class="field-label">Τύπος παραστατικού</span>
              <select [(ngModel)]="profileDocumentType">
                <option value="">Κάθε τύπος</option>
                <option value="SALES_INVOICE">Τιμολόγιο πώλησης</option>
                <option value="PURCHASE_INVOICE">Τιμολόγιο αγοράς</option>
                <option value="CREDIT_NOTE">Πιστωτικό</option>
                <option value="RETAIL_RECEIPT">Λιανική</option>
              </select>
            </label>
            <label class="field">
              <span class="field-label">Κωδικός κίνησης</span>
              <input [(ngModel)]="profileMovementCode" placeholder="π.χ. SALE_INVOICE" />
            </label>
            <label class="field">
              <span class="field-label">Κατηγορία ΦΠΑ</span>
              <select [(ngModel)]="profileVatCategory">
                <option value="">Κάθε ΦΠΑ</option>
                <option value="VAT_24">VAT_24</option>
                <option value="VAT_13">VAT_13</option>
                <option value="VAT_6">VAT_6</option>
                <option value="VAT_0">VAT_0</option>
                <option value="NO_VAT">NO_VAT</option>
              </select>
            </label>
            <label class="field">
              <span class="field-label">Κωδικός είδους γραμμής</span>
              <input [(ngModel)]="profileItemCode" placeholder="π.χ. CONSULTING" />
            </label>
            <label class="field">
              <span class="field-label">Έσοδο — type</span>
              <input [(ngModel)]="profileIncomeType" placeholder="E3_561_001" />
            </label>
            <label class="field">
              <span class="field-label">Έσοδο — category</span>
              <input [(ngModel)]="profileIncomeCategory" placeholder="category1_1" />
            </label>
            <label class="field">
              <span class="field-label">Έξοδο — type</span>
              <input [(ngModel)]="profileExpenseType" placeholder="E3_102_001" />
            </label>
            <label class="field">
              <span class="field-label">Έξοδο — category</span>
              <input [(ngModel)]="profileExpenseCategory" placeholder="category2_4" />
            </label>
            <label class="field">
              <span class="field-label">VAT classification</span>
              <input [(ngModel)]="profileVatClassificationType" placeholder="VAT_361" />
            </label>
            <label class="field">
              <span class="field-label">Προτεραιότητα</span>
              <input [(ngModel)]="profilePriority" type="number" min="-1000" max="1000" />
            </label>
            <div class="profile-actions">
              <button class="btn btn-primary" type="button" (click)="saveProfile(company.id)">
                <span class="material-symbols-outlined">save</span>
                Αποθήκευση προφίλ
              </button>
              <span class="field-note" *ngIf="profileStatus">{{ profileStatus }}</span>
              <span class="field-error" *ngIf="profileError">{{ profileError }}</span>
            </div>
          </div>
          <ng-container *ngIf="classificationProfiles$ | async as profiles">
            <div class="setup-empty" *ngIf="profiles.length === 0">
              Δεν υπάρχουν custom profiles. Τα προεπιλεγμένα προστίθενται με την εφαρμογή setup
              template.
            </div>
            <div class="profile-list" *ngIf="profiles.length > 0">
              <div class="profile-row" *ngFor="let profile of profiles">
                <strong>{{ profile.name }}</strong>
                <code>{{ profile.code }}</code>
                <span>{{ profileScope(profile.metadata) }}</span>
                <small>{{ profileClassification(profile.metadata) }}</small>
              </div>
            </div>
          </ng-container>
        </div>

        <div class="card detail-section reconciliation-section">
          <div class="card-header">
            <h2 class="card-title">
              <span class="material-symbols-outlined">sync_alt</span>
              Συμφωνία myDATA με ΑΑΔΕ
            </h2>
          </div>
          <div class="reconciliation-controls">
            <label class="field">
              <span class="field-label">Ροή</span>
              <select [(ngModel)]="myDataSyncSource">
                <option value="REQUEST_DOCS">Παραστατικά που με αφορούν</option>
                <option value="REQUEST_TRANSMITTED_DOCS">Παραστατικά που έχω διαβιβάσει</option>
              </select>
            </label>
            <label class="field">
              <span class="field-label">Από</span>
              <input type="date" [(ngModel)]="myDataDateFrom" />
            </label>
            <label class="field">
              <span class="field-label">Έως</span>
              <input type="date" [(ngModel)]="myDataDateTo" />
            </label>
            <button
              type="button"
              class="btn btn-primary"
              [disabled]="isSyncingMyData"
              (click)="syncMyData(company.id)"
            >
              <span class="material-symbols-outlined">cloud_sync</span>
              {{ isSyncingMyData ? 'Συγχρονισμός...' : 'Συγχρονισμός από ΑΑΔΕ' }}
            </button>
            <p class="field-note" *ngIf="myDataSyncStatus">{{ myDataSyncStatus }}</p>
            <p class="field-error" *ngIf="myDataSyncError">{{ myDataSyncError }}</p>
          </div>

          <ng-container *ngIf="reconciliation$ | async as reconciliation">
            <div class="movement-summary">
              <div>
                <span>Εγγραφές ΑΑΔΕ</span>
                <strong>{{ reconciliation.length }}</strong>
              </div>
              <div>
                <span>Ταιριασμένα</span>
                <strong>{{ reconciliationStatusCount(reconciliation, 'MATCHED') }}</strong>
              </div>
              <div>
                <span>Λείπουν στο ERP</span>
                <strong>{{ reconciliationStatusCount(reconciliation, 'MISSING_INTERNAL') }}</strong>
              </div>
              <div>
                <span>Διαφορές</span>
                <strong>{{ reconciliationMismatchCount(reconciliation) }}</strong>
              </div>
            </div>
            <div class="setup-empty" *ngIf="reconciliation.length === 0">
              Δεν υπάρχει ακόμα συγχρονισμένο snapshot από ΑΑΔΕ για αυτόν τον πελάτη.
            </div>
            <div class="movement-table" *ngIf="reconciliation.length > 0">
              <table>
                <thead>
                  <tr>
                    <th>Ημερ.</th>
                    <th>Παραστατικό ΑΑΔΕ</th>
                    <th>Αντισυμβαλλόμενος</th>
                    <th class="tr">Σύνολο ΑΑΔΕ</th>
                    <th>Κατάσταση</th>
                    <th>ERP match</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let item of reconciliation">
                    <td>{{ item.issueDate | date: 'dd/MM/yy' }}</td>
                    <td>
                      <strong>{{ item.series || '-' }}/{{ item.documentNumber }}</strong>
                      <small>MARK {{ item.mark }}</small>
                    </td>
                    <td>
                      {{ item.issuerVatNumber || item.counterpartyVatNumber || '-' }}
                      <small>{{ item.invoiceType || '-' }}</small>
                    </td>
                    <td class="tr">{{ item.totalAmount | number: '1.2-2' }}</td>
                    <td>
                      <span
                        class="badge"
                        [class.badge-success]="item.reconciliationStatus === 'MATCHED'"
                        [class.badge-warning]="item.reconciliationStatus !== 'MATCHED'"
                      >
                        {{ reconciliationStatusLabel(item.reconciliationStatus) }}
                      </span>
                      <small *ngIf="item.reconciliationIssues?.fields?.length">
                        {{ item.reconciliationIssues.fields.join(', ') }}
                      </small>
                    </td>
                    <td>
                      <ng-container *ngIf="item.matchedDocument; else noMatch">
                        <strong>
                          {{ item.matchedDocument.series || '-' }}/{{
                            item.matchedDocument.documentNumber
                          }}
                        </strong>
                        <small>{{ documentTypeLabel(item.matchedDocument.documentType) }}</small>
                      </ng-container>
                      <ng-template #noMatch>
                        <span class="muted">Δεν βρέθηκε</span>
                      </ng-template>
                    </td>
                  </tr>
                </tbody>
              </table>
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

      .section-note {
        margin: 0 18px 14px;
        color: var(--muted);
        font-size: 0.78rem;
        line-height: 1.45;
      }
      .profile-form {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px 12px;
        padding: 0 18px 16px;
      }
      .profile-actions {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
      }
      .profile-list {
        border-top: 1px solid var(--border);
      }
      .profile-row {
        display: grid;
        grid-template-columns: minmax(120px, 1fr) minmax(110px, auto);
        gap: 3px 12px;
        padding: 10px 18px;
        border-bottom: 1px solid var(--border);
        font-size: 0.8rem;
      }
      .profile-row code {
        color: var(--muted);
      }
      .profile-row span,
      .profile-row small {
        color: var(--muted);
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
      .movements-section,
      .reconciliation-section {
        grid-column: 1 / -1;
      }

      .setup-panel,
      .reconciliation-controls {
        display: grid;
        grid-template-columns: minmax(260px, 1fr) auto;
        gap: 12px;
        align-items: end;
        padding: 16px 18px;
        border-bottom: 1px solid var(--border);
      }

      .reconciliation-controls {
        grid-template-columns: 1.3fr repeat(2, minmax(140px, 0.5fr)) auto;
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

      .muted {
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
        .reconciliation-controls,
        .setup-list,
        .setup-row,
        .movement-summary {
          grid-template-columns: 1fr;
        }

        .profile-form,
        .profile-row {
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
  private readonly myDataApi = inject(MyDataApiService);
  private readonly setupReload$ = new BehaviorSubject<void>(undefined);
  private readonly classificationProfilesReload$ = new BehaviorSubject<void>(undefined);
  private readonly reconciliationReload$ = new BehaviorSubject<void>(undefined);

  selectedTemplateId = '';
  isApplyingSetup = false;
  setupStatus = '';
  setupError = '';
  profileCode = '';
  profileName = '';
  profileDocumentType = '';
  profileMovementCode = '';
  profileVatCategory = '';
  profileItemCode = '';
  profileIncomeType = '';
  profileIncomeCategory = '';
  profileExpenseType = '';
  profileExpenseCategory = '';
  profileVatClassificationType = '';
  profilePriority = 0;
  profileStatus = '';
  profileError = '';
  isSyncingMyData = false;
  myDataSyncStatus = '';
  myDataSyncError = '';
  myDataSyncSource: 'REQUEST_DOCS' | 'REQUEST_TRANSMITTED_DOCS' = 'REQUEST_DOCS';
  myDataDateFrom = firstDayOfCurrentMonth();
  myDataDateTo = today();

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

  readonly classificationProfiles$ = this.classificationProfilesReload$.pipe(
    switchMap(() => this.route.paramMap),
    map((params) => params.get('id') ?? ''),
    switchMap((id) => this.companiesApi.findMyDataClassificationProfiles(id)),
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

  readonly reconciliation$ = this.reconciliationReload$.pipe(
    switchMap(() => this.route.paramMap),
    map((params) => params.get('id') ?? ''),
    switchMap((id) => this.myDataApi.findReconciliation(id)),
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
        this.classificationProfilesReload$.next();
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

  saveProfile(companyId: string): void {
    this.profileStatus = '';
    this.profileError = '';
    if (!this.profileCode.trim() || !this.profileName.trim()) {
      this.profileError = 'Συμπλήρωσε κωδικό και ονομασία.';
      return;
    }
    this.companiesApi
      .upsertMyDataClassificationProfile(companyId, {
        code: this.profileCode.trim(),
        name: this.profileName.trim(),
        documentType: emptyToUndefined(this.profileDocumentType),
        movementCode: emptyToUndefined(this.profileMovementCode),
        vatCategory: emptyToUndefined(this.profileVatCategory),
        itemCode: emptyToUndefined(this.profileItemCode),
        incomeClassificationType: emptyToUndefined(this.profileIncomeType),
        incomeClassificationCategory: emptyToUndefined(this.profileIncomeCategory),
        expenseClassificationType: emptyToUndefined(this.profileExpenseType),
        expenseClassificationCategory: emptyToUndefined(this.profileExpenseCategory),
        vatClassificationType: emptyToUndefined(this.profileVatClassificationType),
        priority: Number(this.profilePriority),
      })
      .subscribe({
        next: () => {
          this.profileStatus = 'Το προφίλ αποθηκεύτηκε.';
          this.classificationProfilesReload$.next();
        },
        error: (error: { error?: { message?: string | string[] }; message?: string }) => {
          const message = error.error?.message ?? error.message;
          this.profileError = Array.isArray(message)
            ? message.join(', ')
            : (message ?? 'Δεν αποθηκεύτηκε το προφίλ.');
        },
      });
  }

  syncMyData(companyId: string): void {
    this.isSyncingMyData = true;
    this.myDataSyncStatus = '';
    this.myDataSyncError = '';

    this.myDataApi
      .sync({
        clientCompanyId: companyId,
        source: this.myDataSyncSource,
        mark: '0',
        dateFrom: this.myDataDateFrom,
        dateTo: this.myDataDateTo,
      })
      .subscribe({
        next: (result) => {
          this.isSyncingMyData = false;
          this.myDataSyncStatus = `Λήφθηκαν ${result.fetchedCount}, ταιριάστηκαν ${result.matchedCount}, διαφορές ${result.mismatchCount}.`;
          this.reconciliationReload$.next();
        },
        error: (error: { error?: { message?: string | string[] }; message?: string }) => {
          this.isSyncingMyData = false;
          const message = error.error?.message ?? error.message;
          this.myDataSyncError = Array.isArray(message)
            ? message.join(', ')
            : (message ?? 'Δεν ολοκληρώθηκε ο συγχρονισμός myDATA.');
        },
      });
  }

  reconciliationStatusCount(items: { reconciliationStatus: string }[], status: string): number {
    return items.filter((item) => item.reconciliationStatus === status).length;
  }

  reconciliationMismatchCount(items: { reconciliationStatus: string }[]): number {
    return items.filter(
      (item) => !['MATCHED', 'MISSING_INTERNAL'].includes(item.reconciliationStatus),
    ).length;
  }

  reconciliationStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      MATCHED: 'Ταιριάζει',
      MISSING_INTERNAL: 'Λείπει στο ERP',
      AMOUNT_MISMATCH: 'Διαφορά ποσών',
      DATE_MISMATCH: 'Διαφορά ημερομηνίας',
      TYPE_MISMATCH: 'Διαφορά τύπου',
      COUNTERPARTY_MISMATCH: 'Διαφορά ΑΦΜ',
    };

    return labels[status] ?? status;
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
      MYDATA_CLASSIFICATION_PROFILE: 'Χαρακτηρισμοί myDATA',
    };

    return labels[kind] ?? kind;
  }

  profileScope(metadata: Record<string, unknown> | null | undefined): string {
    if (!metadata) return 'Χωρίς περιορισμό';
    return (
      [
        metadata['documentType'],
        metadata['movementCode'],
        metadata['vatCategory'],
        metadata['itemCode'],
      ]
        .filter((value) => typeof value === 'string' && value.length > 0)
        .join(' · ') || 'Χωρίς περιορισμό'
    );
  }

  profileClassification(metadata: Record<string, unknown> | null | undefined): string {
    if (!metadata) return '';
    return [
      metadata['incomeClassificationType'],
      metadata['incomeClassificationCategory'],
      metadata['expenseClassificationType'],
      metadata['expenseClassificationCategory'],
      metadata['vatClassificationType'],
    ]
      .filter((value) => typeof value === 'string' && value.length > 0)
      .join(' · ');
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
      ACCOUNTING_OFFICE_AUTHORIZED: 'Με myDATA API credentials λογιστικού γραφείου',
      OWN_API_CREDENTIALS_ENV_REF: 'Με ξεχωριστά API credentials πελάτη',
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

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function firstDayOfCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}
