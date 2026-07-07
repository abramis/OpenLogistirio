import { AsyncPipe, DatePipe, DecimalPipe, NgClass, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, of, switchMap, tap } from 'rxjs';
import {
  AccountingApiService,
  AccountingPeriod,
  AccountingCoverage,
  ChartAccount,
  DocumentPostingRule,
  FinancialStatements,
  JournalEntry,
  LedgerRow,
  TrialBalanceRow,
  UnpostedAccountingDocument,
  VatReconciliationRow,
} from '../../core/api/accounting-api.service';
import { ClientCompany, CompaniesApiService } from '../../core/api/companies-api.service';
import { DocumentListItem, DocumentsApiService } from '../../core/api/documents-api.service';

@Component({
  selector: 'ol-accounting-page',
  standalone: true,
  imports: [AsyncPipe, DatePipe, DecimalPipe, FormsModule, NgClass, NgFor, NgIf],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Λογιστική</h1>
        <p class="page-subtitle">Λογαριασμοί, άρθρα από παραστατικά, ισοζύγιο και καρτέλες.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" type="button" (click)="reloadAll()">
          <span class="material-symbols-outlined">refresh</span>
          Ανανέωση
        </button>
      </div>
    </section>

    <section class="toolbar">
      <label>
        Πελάτης
        <select [(ngModel)]="clientCompanyId" (ngModelChange)="onClientChange()">
          <option value="">Επιλογή πελάτη</option>
          <option *ngFor="let company of companies$ | async" [value]="company.id">
            {{ company.legalName }} - {{ company.vatNumber }}
          </option>
        </select>
      </label>
      <label>
        Από
        <input [(ngModel)]="dateFrom" type="date" />
      </label>
      <label>
        Έως
        <input [(ngModel)]="dateTo" type="date" />
      </label>
      <button
        class="btn btn-primary"
        type="button"
        [disabled]="!clientCompanyId"
        (click)="reloadAll()"
      >
        <span class="material-symbols-outlined">analytics</span>
        Reports
      </button>
      <button
        class="btn btn-secondary"
        type="button"
        [disabled]="!clientCompanyId || busy"
        (click)="seedChart()"
      >
        <span class="material-symbols-outlined">account_tree</span>
        Setup
      </button>
    </section>

    <div class="alert alert-success" *ngIf="message">{{ message }}</div>

    <section class="metrics">
      <article class="card metric">
        <span>Λογαριασμοί</span>
        <strong>{{ latestAccounts.length }}</strong>
      </article>
      <article class="card metric">
        <span>Κανόνες</span>
        <strong>{{ latestPostingRules.length }}</strong>
      </article>
      <article class="card metric">
        <span>Χρεώσεις</span>
        <strong>{{ totals(latestTrial).debit | number: '1.2-2' }}</strong>
      </article>
      <article class="card metric">
        <span>Πιστώσεις</span>
        <strong>{{ totals(latestTrial).credit | number: '1.2-2' }}</strong>
      </article>
      <article class="card metric" [class.danger]="totals(latestTrial).difference !== 0">
        <span>Διαφορά</span>
        <strong>{{ totals(latestTrial).difference | number: '1.2-2' }}</strong>
      </article>
    </section>

    <section class="statement-grid" *ngIf="statements$ | async as statements">
      <article class="card statement">
        <span>Έσοδα</span>
        <strong>{{ statements.incomeStatement.revenue | number: '1.2-2' }}</strong>
      </article>
      <article class="card statement">
        <span>Έξοδα</span>
        <strong>{{ statements.incomeStatement.expenses | number: '1.2-2' }}</strong>
      </article>
      <article class="card statement" [class.credit]="statements.incomeStatement.netIncome >= 0">
        <span>Αποτέλεσμα</span>
        <strong>{{ statements.incomeStatement.netIncome | number: '1.2-2' }}</strong>
      </article>
      <article class="card statement">
        <span>Ενεργητικό</span>
        <strong>{{ statements.balanceSheet.assets | number: '1.2-2' }}</strong>
      </article>
      <article class="card statement" [class.danger]="statements.balanceSheet.difference !== 0">
        <span>Balance check</span>
        <strong>{{ statements.balanceSheet.difference | number: '1.2-2' }}</strong>
      </article>
    </section>

    <section class="coverage-grid" *ngIf="coverage$ | async as coverage">
      <article class="card statement">
        <span>Παραστατικά</span>
        <strong>{{ coverage.documents }}</strong>
      </article>
      <article class="card statement">
        <span>Posted</span>
        <strong>{{ coverage.postedDocuments }}</strong>
      </article>
      <article class="card statement" [class.danger]="coverage.unpostedDocuments > 0">
        <span>Unposted</span>
        <strong>{{ coverage.unpostedDocuments }}</strong>
      </article>
      <article class="card statement">
        <span>Άρθρα</span>
        <strong>{{ coverage.journalEntries }}</strong>
      </article>
      <article class="card statement">
        <span>Coverage</span>
        <strong>{{ coverage.postedRatio | number: '1.0-2' }}%</strong>
      </article>
    </section>

    <section class="table-section">
      <div class="section-head">
        <h2>Κανόνες άρθρωσης</h2>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Κανόνας</th>
              <th>Κίνηση</th>
              <th>Ημερ.</th>
              <th>Αντισυμβ.</th>
              <th>Καθαρή</th>
              <th>ΦΠΑ</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let rule of postingRules$ | async">
              <td>
                <strong>{{ rule.code }}</strong>
                <small>{{ rule.name }}</small>
              </td>
              <td>{{ rule.movementCode || rule.documentType || '-' }}</td>
              <td>{{ rule.journalCode || '-' }}</td>
              <td>{{ rule.counterpartySide }} {{ rule.counterpartyAccountCode }}</td>
              <td>{{ rule.netSide }} {{ rule.netAccountCode }}</td>
              <td>{{ rule.vatSide || '-' }} {{ rule.vatAccountCode || '' }}</td>
            </tr>
          </tbody>
        </table>
        <div class="empty-state" *ngIf="latestPostingRules.length === 0">
          Δεν υπάρχουν κανόνες άρθρωσης.
        </div>
      </div>
    </section>

    <section class="workspace">
      <article class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">
              <span class="material-symbols-outlined">receipt_long</span>
              Posting παραστατικών
            </h2>
            <p class="card-subtitle">Μετατρέπει παραστατικό σε λογιστικό άρθρο.</p>
          </div>
        </div>
        <div class="card-body post-panel">
          <label>
            Παραστατικό
            <select [(ngModel)]="documentId" [disabled]="!clientCompanyId">
              <option value="">Επιλογή παραστατικού</option>
              <option *ngFor="let document of documents$ | async" [value]="document.id">
                {{ documentLabel(document) }}
              </option>
            </select>
          </label>
          <button
            class="btn btn-primary"
            type="button"
            [disabled]="!documentId || busy"
            (click)="postDocument()"
          >
            <span class="material-symbols-outlined">post_add</span>
            Καταχώριση
          </button>
          <p class="status-line" *ngIf="message">{{ message }}</p>
        </div>
      </article>

      <article class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">
              <span class="material-symbols-outlined">edit_note</span>
              Manual άρθρο
            </h2>
            <p class="card-subtitle">Γρήγορη διγραμμική τακτοποιητική εγγραφή.</p>
          </div>
        </div>
        <div class="card-body manual-entry">
          <label>
            Ημερομηνία
            <input [(ngModel)]="manualEntryDate" type="date" />
          </label>
          <label>
            Ποσό
            <input [(ngModel)]="manualAmount" type="number" min="0" step="0.01" />
          </label>
          <label class="wide-field">
            Περιγραφή
            <input [(ngModel)]="manualDescription" />
          </label>
          <label>
            Χρέωση
            <select [(ngModel)]="debitAccountCode">
              <option value="">Λογαριασμός</option>
              <option *ngFor="let account of accounts$ | async" [value]="account.code">
                {{ account.code }} - {{ account.name }}
              </option>
            </select>
          </label>
          <label>
            Πίστωση
            <select [(ngModel)]="creditAccountCode">
              <option value="">Λογαριασμός</option>
              <option *ngFor="let account of accounts$ | async" [value]="account.code">
                {{ account.code }} - {{ account.name }}
              </option>
            </select>
          </label>
          <label>
            Παραπομπή
            <input [(ngModel)]="manualReference" />
          </label>
          <button
            class="btn btn-primary"
            type="button"
            [disabled]="!canCreateManualEntry() || busy"
            (click)="createManualEntry()"
          >
            <span class="material-symbols-outlined">add</span>
            Άρθρο
          </button>
        </div>
      </article>

      <article class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">
              <span class="material-symbols-outlined">list_alt</span>
              Καρτέλα
            </h2>
            <p class="card-subtitle">Φίλτρο ανά λογαριασμό για κινήσεις.</p>
          </div>
        </div>
        <div class="card-body post-panel">
          <label>
            Λογαριασμός
            <select [(ngModel)]="accountCode">
              <option value="">Όλοι οι λογαριασμοί</option>
              <option *ngFor="let account of accounts$ | async" [value]="account.code">
                {{ account.code }} - {{ account.name }}
              </option>
            </select>
          </label>
          <button
            class="btn btn-secondary"
            type="button"
            [disabled]="!clientCompanyId"
            (click)="reloadAll()"
          >
            <span class="material-symbols-outlined">search</span>
            Προβολή
          </button>
        </div>
      </article>
    </section>

    <section class="table-section">
      <div class="section-head">
        <h2>Unposted παραστατικά</h2>
        <button
          class="btn btn-secondary"
          type="button"
          [disabled]="!clientCompanyId || latestUnpostedDocuments.length === 0 || busy"
          (click)="bulkPostDocuments()"
        >
          <span class="material-symbols-outlined">done_all</span>
          Bulk post
        </button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ημερομηνία</th>
              <th>Παραστατικό</th>
              <th>Πελάτης</th>
              <th>Κίνηση</th>
              <th class="tr">Καθαρή</th>
              <th class="tr">ΦΠΑ</th>
              <th class="tr">Σύνολο</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let document of unpostedDocuments$ | async">
              <td>{{ document.issueDate | date: 'yyyy-MM-dd' }}</td>
              <td>
                <strong>{{ documentNumber(document) }}</strong>
                <small>{{ document.documentType }}</small>
              </td>
              <td>
                {{ document.clientCompany.legalName }}
                <small>{{ document.counterpartyName || '-' }}</small>
              </td>
              <td>
                {{ document.movementCode || '-' }}
                <small>{{ document.journalCode || '-' }}</small>
              </td>
              <td class="tr">{{ document.netAmount | number: '1.2-2' }}</td>
              <td class="tr">{{ document.vatAmount | number: '1.2-2' }}</td>
              <td class="tr">{{ document.totalAmount | number: '1.2-2' }}</td>
              <td class="period-actions">
                <button
                  class="btn btn-xs btn-primary"
                  type="button"
                  [disabled]="busy"
                  (click)="postUnpostedDocument(document)"
                >
                  Post
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="empty-state" *ngIf="latestUnpostedDocuments.length === 0">
          Δεν υπάρχουν unposted παραστατικά για τα φίλτρα.
        </div>
      </div>
    </section>

    <section class="table-section">
      <div class="section-head">
        <h2>Συμφωνία ΦΠΑ / GL {{ periodYear }}</h2>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Περίοδος</th>
              <th class="tr">Παρ. έσοδα</th>
              <th class="tr">GL έσοδα</th>
              <th class="tr">Διαφ.</th>
              <th class="tr">Παρ. ΦΠΑ εκρ.</th>
              <th class="tr">GL ΦΠΑ εκρ.</th>
              <th class="tr">Παρ. ΦΠΑ εισρ.</th>
              <th class="tr">GL ΦΠΑ εισρ.</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of visibleVatReconciliationRows(vatReconciliation$ | async)">
              <td>
                <strong>{{ row.period }}</strong>
                <small>{{ row.documents.count }} παραστατικά</small>
              </td>
              <td class="tr">{{ row.documents.salesNet | number: '1.2-2' }}</td>
              <td class="tr">{{ row.ledger.salesNet | number: '1.2-2' }}</td>
              <td class="tr" [class.diff]="row.differences.salesNet !== 0">
                {{ row.differences.salesNet | number: '1.2-2' }}
              </td>
              <td class="tr">{{ row.documents.outputVat | number: '1.2-2' }}</td>
              <td class="tr">{{ row.ledger.outputVat | number: '1.2-2' }}</td>
              <td class="tr">{{ row.documents.inputVat | number: '1.2-2' }}</td>
              <td class="tr">{{ row.ledger.inputVat | number: '1.2-2' }}</td>
              <td>
                <span
                  class="badge"
                  [class.badge-success]="row.balanced"
                  [class.badge-danger]="!row.balanced"
                >
                  {{ row.balanced ? 'OK' : 'DIFF' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="empty-state" *ngIf="visibleVatReconciliationRows(latestVatRows).length === 0">
          Δεν υπάρχουν κινήσεις ή διαφορές ΦΠΑ για το έτος.
        </div>
      </div>
    </section>

    <section class="table-section">
      <div class="section-head">
        <h2>Περίοδοι {{ periodYear }}</h2>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Μήνας</th>
              <th>Από</th>
              <th>Έως</th>
              <th>Κατάσταση</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let period of periods$ | async">
              <td>
                <strong>{{ monthLabel(period.periodMonth) }}</strong>
              </td>
              <td>{{ period.startsAt | date: 'yyyy-MM-dd' }}</td>
              <td>{{ period.endsAt | date: 'yyyy-MM-dd' }}</td>
              <td>
                <span class="badge" [ngClass]="periodStatusClass(period.status)">
                  {{ period.status }}
                </span>
              </td>
              <td class="period-actions">
                <button
                  class="btn btn-xs btn-secondary"
                  type="button"
                  [disabled]="period.status !== 'OPEN'"
                  (click)="closePeriod(period)"
                >
                  Close
                </button>
                <button
                  class="btn btn-xs btn-secondary"
                  type="button"
                  [disabled]="period.status !== 'CLOSED'"
                  (click)="lockPeriod(period)"
                >
                  Lock
                </button>
                <button
                  class="btn btn-xs btn-secondary"
                  type="button"
                  [disabled]="period.status !== 'CLOSED'"
                  (click)="reopenPeriod(period)"
                >
                  Reopen
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="table-section">
      <div class="section-head">
        <h2>Πρόσφατα άρθρα</h2>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ημερομηνία</th>
              <th>Άρθρο</th>
              <th>Πηγή</th>
              <th>Περιγραφή</th>
              <th class="tr">Γραμμές</th>
              <th class="tr">Χρέωση</th>
              <th class="tr">Πίστωση</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let entry of journalEntries$ | async">
              <td>{{ entry.entryDate | date: 'yyyy-MM-dd' }}</td>
              <td>
                <strong>{{ entry.entryNumber }}</strong>
                <small>{{ entry.reference || '-' }}</small>
              </td>
              <td>
                <span class="badge badge-neutral">{{ entry.source }}</span>
              </td>
              <td>
                {{ entry.description }}
                <small>{{ entry.clientCompany?.legalName || '' }}</small>
              </td>
              <td class="tr">{{ entry.lines.length }}</td>
              <td class="tr">{{ journalEntryTotals(entry).debit | number: '1.2-2' }}</td>
              <td class="tr">{{ journalEntryTotals(entry).credit | number: '1.2-2' }}</td>
            </tr>
          </tbody>
        </table>
        <div class="empty-state" *ngIf="latestJournalEntries.length === 0">
          Δεν υπάρχουν άρθρα για τα φίλτρα.
        </div>
      </div>
    </section>

    <section class="table-section">
      <div class="section-head">
        <h2>Ισοζύγιο</h2>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Κωδικός</th>
              <th>Λογαριασμός</th>
              <th>Τύπος</th>
              <th class="tr">Χρέωση</th>
              <th class="tr">Πίστωση</th>
              <th class="tr">Υπόλοιπο</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of trialBalance$ | async">
              <td>
                <strong>{{ row.code }}</strong>
              </td>
              <td>{{ row.name }}</td>
              <td>
                <span class="badge badge-neutral">{{ row.type }}</span>
              </td>
              <td class="tr">{{ row.debit | number: '1.2-2' }}</td>
              <td class="tr">{{ row.credit | number: '1.2-2' }}</td>
              <td class="tr">
                <strong>{{ row.normalBalanceAmount | number: '1.2-2' }}</strong>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="empty-state" *ngIf="latestTrial.length === 0">
          Δεν υπάρχουν λογιστικές κινήσεις.
        </div>
      </div>
    </section>

    <section class="table-section">
      <div class="section-head">
        <h2>Καρτέλα κινήσεων</h2>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ημερομηνία</th>
              <th>Άρθρο</th>
              <th>Λογ.</th>
              <th>Περιγραφή</th>
              <th class="tr">Χρέωση</th>
              <th class="tr">Πίστωση</th>
              <th class="tr">Τρέχον</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of ledger$ | async">
              <td>{{ row.entryDate | date: 'yyyy-MM-dd' }}</td>
              <td>
                <strong>{{ row.entryNumber }}</strong>
                <small>{{ row.source }}</small>
              </td>
              <td>{{ row.accountCode }}</td>
              <td>{{ row.description }}</td>
              <td class="tr">{{ row.debit | number: '1.2-2' }}</td>
              <td class="tr">{{ row.credit | number: '1.2-2' }}</td>
              <td class="tr">
                <strong>{{ row.runningBalance | number: '1.2-2' }}</strong>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="empty-state" *ngIf="latestLedger.length === 0">
          Δεν υπάρχουν γραμμές καρτέλας.
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .toolbar {
        display: grid;
        grid-template-columns: minmax(260px, 2fr) minmax(130px, 1fr) minmax(130px, 1fr) auto auto;
        gap: 12px;
        align-items: end;
        padding: 14px;
        margin-bottom: 16px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface);
      }

      label {
        display: grid;
        gap: 6px;
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 700;
      }

      .metrics,
      .workspace,
      .statement-grid,
      .coverage-grid {
        display: grid;
        gap: 12px;
        margin-bottom: 16px;
      }

      .metrics {
        grid-template-columns: repeat(5, minmax(0, 1fr));
      }

      .workspace {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .statement-grid,
      .coverage-grid {
        grid-template-columns: repeat(5, minmax(0, 1fr));
      }

      .metric,
      .statement {
        display: grid;
        gap: 8px;
        padding: 14px;
      }

      .metric span,
      .statement span {
        color: var(--muted);
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      .metric strong,
      .statement strong {
        font-size: 1.25rem;
      }

      .metric.danger,
      .statement.danger {
        border-color: var(--err-bd);
      }

      .statement.credit strong {
        color: var(--ok);
      }

      .diff {
        color: var(--err);
        font-weight: 700;
      }

      .post-panel {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: end;
        gap: 12px;
      }

      .manual-entry {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: end;
        gap: 12px;
      }

      .wide-field {
        grid-column: span 2;
      }

      .period-actions {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
      }

      .status-line {
        grid-column: 1 / -1;
        margin: 0;
        color: var(--muted);
        font-size: 0.8rem;
      }

      .table-section {
        margin-top: 18px;
      }

      .section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }

      .section-head h2 {
        margin: 0;
        font-size: 0.95rem;
      }

      .tr {
        text-align: right;
      }

      @media (max-width: 980px) {
        .toolbar,
        .metrics,
        .statement-grid,
        .coverage-grid,
        .workspace,
        .post-panel,
        .manual-entry {
          grid-template-columns: 1fr;
        }

        .wide-field {
          grid-column: 1;
        }
      }
    `,
  ],
})
export class AccountingPageComponent {
  private readonly accountingApi = inject(AccountingApiService);
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly documentsApi = inject(DocumentsApiService);
  private readonly reload$ = new BehaviorSubject<void>(undefined);

  readonly companies$ = this.companiesApi.findAll().pipe(
    tap((companies) => {
      this.selectInitialClient(companies);
    }),
  );
  readonly accounts$ = this.reload$.pipe(
    switchMap(() => this.accountingApi.findAccounts(this.clientCompanyId)),
    tap((accounts) => {
      this.latestAccounts = accounts;
      if (this.accountCode && !accounts.some((account) => account.code === this.accountCode)) {
        this.accountCode = '';
      }
    }),
  );
  readonly postingRules$ = this.reload$.pipe(
    switchMap(() =>
      this.clientCompanyId ? this.accountingApi.findPostingRules(this.clientCompanyId) : of([]),
    ),
    tap((rules) => {
      this.latestPostingRules = rules;
    }),
  );
  readonly coverage$ = this.reload$.pipe(
    switchMap(() => this.accountingApi.coverage(this.clientCompanyId, this.dateFrom, this.dateTo)),
    tap((coverage) => {
      this.latestCoverage = coverage;
    }),
  );
  readonly periods$ = this.reload$.pipe(
    switchMap(() =>
      this.clientCompanyId
        ? this.accountingApi.findPeriods(this.clientCompanyId, this.periodYear)
        : of([]),
    ),
  );
  readonly documents$ = this.reload$.pipe(
    switchMap(() =>
      this.clientCompanyId
        ? this.documentsApi.findAll({ clientCompanyId: this.clientCompanyId })
        : of([]),
    ),
  );
  readonly unpostedDocuments$ = this.reload$.pipe(
    switchMap(() =>
      this.accountingApi.findUnpostedDocuments(this.clientCompanyId, this.dateFrom, this.dateTo),
    ),
    tap((documents) => {
      this.latestUnpostedDocuments = documents;
    }),
  );
  readonly journalEntries$ = this.reload$.pipe(
    switchMap(() =>
      this.accountingApi.findJournalEntries(this.clientCompanyId, this.dateFrom, this.dateTo),
    ),
    tap((entries) => {
      this.latestJournalEntries = entries;
    }),
  );
  readonly vatReconciliation$ = this.reload$.pipe(
    switchMap(() =>
      this.clientCompanyId
        ? this.accountingApi.vatReconciliation(this.clientCompanyId, this.periodYear)
        : of([]),
    ),
    tap((rows) => {
      this.latestVatRows = rows;
    }),
  );
  readonly trialBalance$ = this.reload$.pipe(
    switchMap(() =>
      this.clientCompanyId
        ? this.accountingApi.trialBalance(this.clientCompanyId, this.dateFrom, this.dateTo)
        : of([]),
    ),
    tap((rows) => {
      this.latestTrial = rows;
    }),
  );
  readonly ledger$ = this.reload$.pipe(
    switchMap(() =>
      this.clientCompanyId
        ? this.accountingApi.ledger(
            this.clientCompanyId,
            this.accountCode,
            this.dateFrom,
            this.dateTo,
          )
        : of([]),
    ),
    tap((rows) => {
      this.latestLedger = rows;
    }),
  );
  readonly statements$ = this.reload$.pipe(
    switchMap(() =>
      this.clientCompanyId
        ? this.accountingApi.financialStatements(this.clientCompanyId, this.dateFrom, this.dateTo)
        : of(emptyFinancialStatements()),
    ),
    tap((statements) => {
      this.latestStatements = statements;
    }),
  );

  clientCompanyId = '';
  documentId = '';
  accountCode = '';
  periodYear = new Date().getFullYear();
  dateFrom = `${new Date().getFullYear()}-01-01`;
  dateTo = `${new Date().getFullYear()}-12-31`;
  manualEntryDate = new Date().toISOString().slice(0, 10);
  manualDescription = 'Τακτοποιητική εγγραφή';
  manualReference = '';
  debitAccountCode = '20.00';
  creditAccountCode = '50.00';
  manualAmount = 0;
  latestAccounts: ChartAccount[] = [];
  latestPostingRules: DocumentPostingRule[] = [];
  latestCoverage: AccountingCoverage = emptyCoverage();
  latestUnpostedDocuments: UnpostedAccountingDocument[] = [];
  latestJournalEntries: JournalEntry[] = [];
  latestVatRows: VatReconciliationRow[] = [];
  latestTrial: TrialBalanceRow[] = [];
  latestLedger: LedgerRow[] = [];
  latestStatements: FinancialStatements = emptyFinancialStatements();
  busy = false;
  message = '';

  onClientChange(): void {
    this.documentId = '';
    this.accountCode = '';
    this.reloadAll();
  }

  reloadAll(): void {
    this.reload$.next();
  }

  seedChart(): void {
    if (!this.clientCompanyId) {
      return;
    }
    this.busy = true;
    this.accountingApi.seedDefaultChart(this.clientCompanyId, new Date().getFullYear()).subscribe({
      next: (result) => {
        this.message = `Έγινε setup ${result.accountCount} λογαριασμών, ${result.postingRuleCount} κανόνων και ${result.periodCount} περιόδων.`;
        this.busy = false;
        this.reloadAll();
      },
      error: () => {
        this.message = 'Το setup δεν ολοκληρώθηκε.';
        this.busy = false;
      },
    });
  }

  postDocument(): void {
    if (!this.documentId) {
      return;
    }
    this.busy = true;
    this.accountingApi.postDocument(this.documentId).subscribe({
      next: (entry) => {
        this.message = `Δημιουργήθηκε/βρέθηκε το άρθρο ${entry.entryNumber}.`;
        this.busy = false;
        this.reloadAll();
      },
      error: () => {
        this.message = 'Το posting δεν ολοκληρώθηκε.';
        this.busy = false;
      },
    });
  }

  postUnpostedDocument(document: UnpostedAccountingDocument): void {
    this.busy = true;
    this.accountingApi.postDocument(document.id).subscribe({
      next: (entry) => {
        this.message = `Δημιουργήθηκε άρθρο ${entry.entryNumber}.`;
        this.busy = false;
        this.reloadAll();
      },
      error: () => {
        this.message = `Το posting για ${this.documentNumber(document)} δεν ολοκληρώθηκε.`;
        this.busy = false;
      },
    });
  }

  bulkPostDocuments(): void {
    if (!this.clientCompanyId || this.latestUnpostedDocuments.length === 0) {
      return;
    }

    this.busy = true;
    this.accountingApi
      .bulkPostDocuments(this.clientCompanyId, this.dateFrom, this.dateTo)
      .subscribe({
        next: (result) => {
          this.message = `Bulk posting: ${result.postedCount}/${result.requested} άρθρα, ${result.failedCount} αποτυχίες.`;
          this.busy = false;
          this.reloadAll();
        },
        error: () => {
          this.message = 'Το bulk posting δεν ολοκληρώθηκε.';
          this.busy = false;
        },
      });
  }

  canCreateManualEntry(): boolean {
    return (
      Boolean(this.clientCompanyId) &&
      Boolean(this.manualEntryDate) &&
      Boolean(this.manualDescription.trim()) &&
      Boolean(this.debitAccountCode) &&
      Boolean(this.creditAccountCode) &&
      this.debitAccountCode !== this.creditAccountCode &&
      Number(this.manualAmount) > 0
    );
  }

  createManualEntry(): void {
    if (!this.canCreateManualEntry()) {
      return;
    }

    this.busy = true;
    const amount = roundMoney(Number(this.manualAmount));
    this.accountingApi
      .createManualEntry({
        clientCompanyId: this.clientCompanyId,
        entryDate: this.manualEntryDate,
        description: this.manualDescription,
        reference: this.manualReference || undefined,
        lines: [
          {
            accountCode: this.debitAccountCode,
            description: this.manualDescription,
            debit: amount,
          },
          {
            accountCode: this.creditAccountCode,
            description: this.manualDescription,
            credit: amount,
          },
        ],
      })
      .subscribe({
        next: (entry) => {
          this.message = `Δημιουργήθηκε manual άρθρο ${entry.entryNumber}.`;
          this.manualAmount = 0;
          this.busy = false;
          this.reloadAll();
        },
        error: () => {
          this.message = 'Το manual άρθρο δεν ολοκληρώθηκε.';
          this.busy = false;
        },
      });
  }

  closePeriod(period: AccountingPeriod): void {
    this.updatePeriod(this.accountingApi.closePeriod(period.id), 'Η περίοδος έκλεισε.');
  }

  lockPeriod(period: AccountingPeriod): void {
    this.updatePeriod(this.accountingApi.lockPeriod(period.id), 'Η περίοδος κλειδώθηκε.');
  }

  reopenPeriod(period: AccountingPeriod): void {
    this.updatePeriod(this.accountingApi.reopenPeriod(period.id), 'Η περίοδος άνοιξε ξανά.');
  }

  totals(rows: TrialBalanceRow[]) {
    const totals = rows.reduce(
      (summary, row) => ({
        debit: roundMoney(summary.debit + row.debit),
        credit: roundMoney(summary.credit + row.credit),
      }),
      { debit: 0, credit: 0 },
    );
    return {
      ...totals,
      difference: roundMoney(totals.debit - totals.credit),
    };
  }

  documentLabel(document: DocumentListItem): string {
    const number = [document.series, document.documentNumber].filter(Boolean).join('-');
    return `${number} | ${document.documentType} | ${document.totalAmount}`;
  }

  documentNumber(document: { series?: string | null; documentNumber: string }): string {
    return [document.series, document.documentNumber].filter(Boolean).join('-');
  }

  journalEntryTotals(entry: JournalEntry) {
    return entry.lines.reduce(
      (summary, line) => ({
        debit: roundMoney(summary.debit + Number(line.debit || 0)),
        credit: roundMoney(summary.credit + Number(line.credit || 0)),
      }),
      { debit: 0, credit: 0 },
    );
  }

  visibleVatReconciliationRows(rows: VatReconciliationRow[] | null): VatReconciliationRow[] {
    return (rows ?? []).filter(
      (row) =>
        row.documents.count > 0 ||
        row.ledger.salesNet !== 0 ||
        row.ledger.purchasesNet !== 0 ||
        row.ledger.outputVat !== 0 ||
        row.ledger.inputVat !== 0 ||
        !row.balanced,
    );
  }

  periodStatusClass(status: string): string {
    const classes: Record<string, string> = {
      OPEN: 'badge-success',
      CLOSED: 'badge-warning',
      LOCKED: 'badge-danger',
    };

    return classes[status] ?? 'badge-neutral';
  }

  monthLabel(month: number): string {
    return `${String(month).padStart(2, '0')}/${this.periodYear}`;
  }

  private selectInitialClient(companies: ClientCompany[]): void {
    if (!this.clientCompanyId && companies.length > 0) {
      this.clientCompanyId = companies[0].id;
      this.reloadAll();
    }
  }

  private updatePeriod(request: ReturnType<AccountingApiService['closePeriod']>, message: string) {
    this.busy = true;
    request.subscribe({
      next: () => {
        this.message = message;
        this.busy = false;
        this.reloadAll();
      },
      error: () => {
        this.message = 'Η αλλαγή περιόδου δεν ολοκληρώθηκε.';
        this.busy = false;
      },
    });
  }
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function emptyCoverage(): AccountingCoverage {
  return {
    documents: 0,
    postedDocuments: 0,
    unpostedDocuments: 0,
    journalEntries: 0,
    postedRatio: 0,
  };
}

function emptyFinancialStatements(): FinancialStatements {
  return {
    period: {},
    incomeStatement: {
      revenue: 0,
      expenses: 0,
      netIncome: 0,
      rows: [],
    },
    balanceSheet: {
      assets: 0,
      liabilities: 0,
      equity: 0,
      netIncome: 0,
      liabilitiesEquityAndCurrentResult: 0,
      difference: 0,
      rows: [],
    },
  };
}
