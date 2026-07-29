import { DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AnnualTaxApiService,
  AnnualTaxChecklist,
  AnnualTaxReturn,
  AnnualTaxSubmissionPayload,
  AnnualTaxUpdatePayload,
} from '../../core/api/annual-tax-api.service';
import { ClientCompany, CompaniesApiService } from '../../core/api/companies-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ACCOUNTING_CONTROL_ROLES } from '../../core/auth/user-roles';

@Component({
  selector: 'ol-annual-tax-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, NgFor, NgIf],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Ετήσιο φορολογικό κλείσιμο</h1>
        <p class="page-subtitle">
          Έλεγχος βιβλίων, φορολογική αναμόρφωση και παρακολούθηση Ε1/Ε2/Ε3/Ν,
          εκκαθαριστικού και δόσεων.
        </p>
      </div>
    </section>

    <div class="alert alert-success" *ngIf="message">{{ message }}</div>
    <div class="alert alert-danger" *ngIf="errorMessage">{{ errorMessage }}</div>

    <section class="card filters">
      <div class="card-body filter-grid">
        <label>
          Πελάτης
          <select [(ngModel)]="clientCompanyId" (ngModelChange)="load()">
            <option value="">Επιλογή πελάτη</option>
            <option *ngFor="let company of companies" [value]="company.id">
              {{ company.legalName }} — {{ company.vatNumber }}
            </option>
          </select>
        </label>
        <label>
          Φορολογικό έτος
          <input [(ngModel)]="fiscalYear" type="number" min="2000" max="2200" />
        </label>
        <div class="filter-actions">
          <button
            class="btn btn-primary"
            type="button"
            [disabled]="!clientCompanyId || busy"
            (click)="generate(false)"
          >
            <span class="material-symbols-outlined">calculate</span>
            Δημιουργία / ανανέωση
          </button>
          <button
            class="btn btn-secondary"
            type="button"
            [disabled]="!canCreateAmending() || busy"
            (click)="generate(true)"
          >
            Τροποποιητική
          </button>
        </div>
      </div>
    </section>

    <section class="table-wrap history" *ngIf="returns.length">
      <table>
        <thead>
          <tr>
            <th>Έτος / έντυπα</th>
            <th>Πελάτης</th>
            <th>Κατάσταση</th>
            <th>Λογιστικό αποτέλεσμα</th>
            <th>Φορολογητέο αποτέλεσμα</th>
            <th>Προθεσμία</th>
          </tr>
        </thead>
        <tbody>
          <tr
            *ngFor="let item of returns"
            (click)="select(item)"
            [class.selected]="selected?.id === item.id"
          >
            <td>
              <strong>{{ item.fiscalYear }} · {{ formLabel(item) }}</strong>
              <small>{{ item.returnType === 'INITIAL' ? 'Αρχική' : 'Τροποποιητική ' + item.revision }}</small>
            </td>
            <td>{{ item.clientCompany.legalName }}<small>{{ item.clientCompany.vatNumber }}</small></td>
            <td><span class="status" [attr.data-status]="item.status">{{ statusLabel(item.status) }}</span></td>
            <td>{{ item.accountingResult | number: '1.2-2' }} €</td>
            <td>{{ item.taxableResult | number: '1.2-2' }} €</td>
            <td>{{ item.submissionDeadline | date: 'dd/MM/yyyy' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <ng-container *ngIf="selected as item">
      <section class="summary-grid">
        <article class="metric">
          <span>Έσοδα βιβλίων</span><strong>{{ item.bookRevenue | number: '1.2-2' }} €</strong>
          <small>myDATA: {{ item.myDataRevenue | number: '1.2-2' }} €</small>
        </article>
        <article class="metric">
          <span>Έξοδα βιβλίων</span><strong>{{ item.bookExpenses | number: '1.2-2' }} €</strong>
          <small>myDATA: {{ item.myDataExpenses | number: '1.2-2' }} €</small>
        </article>
        <article class="metric">
          <span>Λογιστικό αποτέλεσμα</span><strong>{{ item.accountingResult | number: '1.2-2' }} €</strong>
        </article>
        <article class="metric primary">
          <span>Φορολογητέο αποτέλεσμα</span><strong>{{ item.taxableResult | number: '1.2-2' }} €</strong>
        </article>
      </section>

      <section class="card blockers-card">
        <div class="card-header">
          <div>
            <h2 class="card-title"><span class="material-symbols-outlined">fact_check</span> Αυτόματοι έλεγχοι</h2>
            <p class="card-subtitle">Μηδενικές εκκρεμότητες απαιτούνται πριν την έγκριση.</p>
          </div>
        </div>
        <div class="card-body blocker-grid">
          <div [class.ok]="item.unpostedDocumentCount === 0">
            <strong>{{ item.unpostedDocumentCount }}</strong><span>ακαταχώριστα παραστατικά</span>
          </div>
          <div [class.ok]="item.unresolvedMyDataCount === 0">
            <strong>{{ item.unresolvedMyDataCount }}</strong><span>εκκρεμείς αποκλίσεις myDATA</span>
          </div>
          <div [class.ok]="item.openPeriodCount === 0 && item.missingPeriodCount === 0">
            <strong>{{ item.openPeriodCount + item.missingPeriodCount }}</strong><span>ανοικτές / ελλιπείς περίοδοι</span>
          </div>
          <div [class.ok]="item.unpostedDepreciationCount === 0">
            <strong>{{ item.unpostedDepreciationCount }}</strong><span>πάγια χωρίς απόσβεση</span>
          </div>
        </div>
      </section>

      <form class="card workpaper" *ngIf="item.status === 'DRAFT'" (ngSubmit)="saveDraft()">
        <div class="card-header">
          <div>
            <h2 class="card-title"><span class="material-symbols-outlined">edit_note</span> Φορολογική αναμόρφωση</h2>
            <p class="card-subtitle">
              Τα ποσά συμπληρώνονται από τον λογιστή. Η εφαρμογή δεν υποκαθιστά τον υπολογισμό της ΑΑΔΕ.
            </p>
          </div>
        </div>
        <div class="card-body">
          <div class="form-grid adjustments">
            <label>Μη εκπιπτόμενες δαπάνες<input [(ngModel)]="draft.nonDeductibleExpenses" name="nonDeductibleExpenses" type="number" min="0" step="0.01" /></label>
            <label>Αφορολόγητα / απαλλασσόμενα έσοδα<input [(ngModel)]="draft.taxExemptIncome" name="taxExemptIncome" type="number" min="0" step="0.01" /></label>
            <label>Λοιπές προσθήκες<input [(ngModel)]="draft.otherTaxAdditions" name="otherTaxAdditions" type="number" min="0" step="0.01" /></label>
            <label>Λοιπές αφαιρέσεις<input [(ngModel)]="draft.otherTaxDeductions" name="otherTaxDeductions" type="number" min="0" step="0.01" /></label>
            <label>Μεταφερόμενες φορολογικές ζημιές<input [(ngModel)]="draft.priorTaxLosses" name="priorTaxLosses" type="number" min="0" step="0.01" /></label>
            <label>Προθεσμία υποβολής<input [(ngModel)]="draft.submissionDeadline" name="submissionDeadline" type="date" required /></label>
            <label class="check"><input [(ngModel)]="draft.includesE3" name="includesE3" type="checkbox" disabled /> Περιλαμβάνει Ε3 (υποχρεωτικό)</label>
            <label class="check"><input [(ngModel)]="draft.includesE2" name="includesE2" type="checkbox" /> Περιλαμβάνει Ε2</label>
            <label class="wide">Σημειώσεις αναμόρφωσης<textarea [(ngModel)]="draft.adjustmentNotes" name="adjustmentNotes" rows="3"></textarea></label>
          </div>

          <h3>Checklist ετήσιου ελέγχου</h3>
          <div class="checklist">
            <label><input [(ngModel)]="draft.checklist.booksReconciled" name="booksReconciled" type="checkbox" /> Βιβλία και ισοζύγιο συμφωνήθηκαν</label>
            <label><input [(ngModel)]="draft.checklist.myDataReviewed" name="myDataReviewed" type="checkbox" /> myDATA και χαρακτηρισμοί ελέγχθηκαν</label>
            <label><input [(ngModel)]="draft.checklist.depreciationsReviewed" name="depreciationsReviewed" type="checkbox" /> Πάγια και αποσβέσεις ελέγχθηκαν</label>
            <label><input [(ngModel)]="draft.checklist.inventoryReviewed" name="inventoryReviewed" type="checkbox" /> Απογραφή / αποθέματα ελέγχθηκαν ή δεν εφαρμόζονται</label>
            <label><input [(ngModel)]="draft.checklist.taxAdjustmentsReviewed" name="taxAdjustmentsReviewed" type="checkbox" /> Φορολογικές αναμορφώσεις τεκμηριώθηκαν</label>
            <label><input [(ngModel)]="draft.checklist.formsReviewed" name="formsReviewed" type="checkbox" /> Ε1/Ε2/Ε3 ή Ν ελέγχθηκαν πριν την υποβολή</label>
          </div>
          <div class="actions">
            <button class="btn btn-secondary" type="submit" [disabled]="busy">Αποθήκευση</button>
            <button class="btn btn-primary" type="button" [disabled]="busy" (click)="markReady()">Για έγκριση</button>
          </div>
        </div>
      </form>

      <section class="card workflow" *ngIf="item.status === 'READY'">
        <div class="card-body workflow-row">
          <div><strong>Έτοιμο για λογιστική έγκριση</strong><small>Τα ποσά κλειδώνουν μετά την έγκριση.</small></div>
          <div class="filter-actions">
            <button class="btn btn-secondary" type="button" [disabled]="!canApprove() || busy" (click)="reopen()">Επιστροφή σε πρόχειρο</button>
            <button class="btn btn-primary" type="button" [disabled]="!canApprove() || busy" (click)="approve()">Έγκριση λογιστή</button>
          </div>
        </div>
      </section>

      <form class="card submission" *ngIf="item.status === 'APPROVED'" (ngSubmit)="submitOfficial()">
        <div class="card-header">
          <div>
            <h2 class="card-title"><span class="material-symbols-outlined">verified</span> Επίσημη υποβολή ΑΑΔΕ</h2>
            <p class="card-subtitle">Καταχώριση ακριβώς από την απόδειξη υποβολής και το εκκαθαριστικό.</p>
          </div>
          <button class="btn btn-secondary btn-sm" type="button" [disabled]="!canApprove() || busy" (click)="reopen()">Επιστροφή σε πρόχειρο</button>
        </div>
        <div class="card-body">
          <div class="form-grid">
            <label>Αριθμός δήλωσης / πρωτόκολλο<input [(ngModel)]="submission.submissionReference" name="submissionReference" required /></label>
            <label>Ημερομηνία υποβολής<input [(ngModel)]="submission.submittedAt" name="submittedAt" type="date" required /></label>
            <label>Αριθμός εκκαθαριστικού<input [(ngModel)]="submission.assessmentReference" name="assessmentReference" required /></label>
            <label>Ταυτότητα οφειλής<input [(ngModel)]="submission.debtId" name="debtId" /></label>
            <label>Φόρος εισοδήματος<input [(ngModel)]="submission.assessedIncomeTax" name="assessedIncomeTax" type="number" min="0" step="0.01" /></label>
            <label>Προκαταβολή φόρου<input [(ngModel)]="submission.taxPrepayment" name="taxPrepayment" type="number" min="0" step="0.01" /></label>
            <label>Λοιπά ποσά / συμψηφισμοί (+/−)<input [(ngModel)]="submission.otherAssessedAmounts" name="otherAssessedAmounts" type="number" step="0.01" /></label>
            <label>Συνολικό πληρωτέο<input [(ngModel)]="submission.totalPayable" name="totalPayable" type="number" min="0" step="0.01" /></label>
            <label>Ποσό επιστροφής<input [(ngModel)]="submission.refundAmount" name="refundAmount" type="number" min="0" step="0.01" /></label>
          </div>
          <div class="installment-tools">
            <button class="btn btn-secondary" type="button" (click)="buildInstallments()">Δημιουργία 8 δόσεων</button>
            <small>Ελέγξτε ποσά και ημερομηνίες με το επίσημο εκκαθαριστικό πριν την αποθήκευση.</small>
          </div>
          <div class="installment-grid" *ngFor="let installment of submission.installments; let index = index">
            <strong>Δόση {{ installment.installmentNumber }}</strong>
            <input [(ngModel)]="installment.dueDate" [name]="'dueDate' + index" type="date" />
            <input [(ngModel)]="installment.amount" [name]="'amount' + index" type="number" min="0" step="0.01" />
          </div>
          <label>Σημειώσεις υποβολής<textarea [(ngModel)]="submission.submissionNotes" name="submissionNotes" rows="3"></textarea></label>
          <div class="actions"><button class="btn btn-primary" type="submit" [disabled]="busy">Καταχώριση επίσημης υποβολής</button></div>
        </div>
      </form>

      <section class="card submitted" *ngIf="item.status === 'SUBMITTED'">
        <div class="card-header">
          <div>
            <h2 class="card-title"><span class="material-symbols-outlined">task_alt</span> Υποβλήθηκε</h2>
            <p class="card-subtitle">
              {{ item.submissionReference }} · {{ item.submittedAt | date: 'dd/MM/yyyy' }}
              <span *ngIf="item.lateSubmission"> · εκπρόθεσμη</span>
            </p>
          </div>
          <div>
            <strong *ngIf="asNumber(item.totalPayable) > 0">{{ item.totalPayable | number: '1.2-2' }} € οφειλή</strong>
            <strong *ngIf="asNumber(item.refundAmount) > 0">{{ item.refundAmount | number: '1.2-2' }} € επιστροφή</strong>
            <strong *ngIf="asNumber(item.totalPayable) === 0 && asNumber(item.refundAmount) === 0">Μηδενικό</strong>
            <small>{{ item.debtId || 'Χωρίς Ταυτότητα Οφειλής' }}</small>
          </div>
        </div>
        <div class="table-wrap installments" *ngIf="item.installments.length">
          <table>
            <thead><tr><th>Δόση</th><th>Λήξη</th><th>Ποσό</th><th>Πληρωμή</th><th>Ενέργεια</th></tr></thead>
            <tbody>
              <tr *ngFor="let installment of item.installments">
                <td>{{ installment.installmentNumber }}</td>
                <td>{{ installment.dueDate | date: 'dd/MM/yyyy' }}</td>
                <td>{{ installment.amount | number: '1.2-2' }} €</td>
                <td>
                  <ng-container *ngIf="installment.paidAt; else unpaid">
                    {{ installment.paidAt | date: 'dd/MM/yyyy' }}
                    <small>{{ installment.paymentReference }}<span *ngIf="installment.latePayment"> · εκπρόθεσμη</span></small>
                  </ng-container>
                  <ng-template #unpaid>Εκκρεμεί</ng-template>
                </td>
                <td>
                  <div class="payment" *ngIf="!installment.paidAt">
                    <input [(ngModel)]="paymentForms[installment.id].paidAt" type="date" />
                    <input [(ngModel)]="paymentForms[installment.id].paymentReference" placeholder="Αναφορά πληρωμής" />
                    <button class="btn btn-secondary btn-sm" type="button" (click)="pay(installment.id)">Πληρώθηκε</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </ng-container>

    <div class="empty-state" *ngIf="clientCompanyId && !returns.length && !busy">
      <span class="material-symbols-outlined">receipt_long</span>
      <p>Δεν υπάρχει ετήσιο φορολογικό φύλλο για το έτος.</p>
    </div>
  `,
  styles: [
    `
      .filters, .history, .workpaper, .workflow, .submission, .submitted, .blockers-card { margin-bottom: 16px; }
      .filter-grid { display: grid; grid-template-columns: minmax(260px, 2fr) minmax(140px, 1fr) auto; gap: 14px; align-items: end; }
      label { display: grid; gap: 5px; color: var(--text-2); font-size: .77rem; font-weight: 650; }
      .filter-actions, .actions, .installment-tools { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .history tbody tr { cursor: pointer; }
      .history tbody tr.selected td { background: var(--primary-bg); }
      .status { display: inline-flex; padding: 3px 8px; border-radius: 999px; background: var(--surface-3); font-size: .72rem; font-weight: 700; }
      .status[data-status='SUBMITTED'] { background: var(--ok-bg); color: var(--ok); }
      .status[data-status='APPROVED'], .status[data-status='READY'] { background: var(--inf-bg); color: var(--inf-t); }
      .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
      .metric { border: 1px solid var(--border); border-radius: var(--radius-md); padding: 14px; background: var(--surface); }
      .metric span, .metric small { display: block; color: var(--muted); font-size: .72rem; }
      .metric strong { display: block; margin: 5px 0 2px; font-size: 1.05rem; }
      .metric.primary { border-color: #9db8c5; background: var(--primary-bg) !important; }
      .blocker-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
      .blocker-grid > div { display: flex; align-items: center; gap: 8px; padding: 10px; border: 1px solid var(--err-bd); border-radius: 7px; background: var(--err-bg); color: var(--err); }
      .blocker-grid > div.ok { border-color: var(--ok-bd); background: var(--ok-bg); color: var(--ok); }
      .blocker-grid strong { font-size: 1.15rem; }
      .blocker-grid span { font-size: .75rem; }
      .wide { grid-column: 1 / -1; }
      .check { display: flex; grid-template-columns: auto 1fr; align-items: center; justify-content: start; }
      .check input, .checklist input { width: auto; min-height: auto; }
      h3 { margin: 20px 0 10px; font-size: .86rem; }
      .checklist { display: grid; grid-template-columns: repeat(2, 1fr); gap: 9px 18px; padding: 14px; border: 1px solid var(--border); background: var(--surface-2); border-radius: 8px; }
      .checklist label { display: flex; align-items: center; gap: 8px; font-weight: 500; }
      .actions { justify-content: flex-end; margin-top: 16px; }
      .workflow-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
      .installment-tools { margin: 16px 0 10px; }
      .installment-grid { display: grid; grid-template-columns: 100px 180px 180px; gap: 10px; align-items: center; margin-bottom: 7px; }
      .installments { border: 0; border-radius: 0; box-shadow: none; }
      .payment { display: grid; grid-template-columns: 140px minmax(180px, 1fr) auto; gap: 7px; min-width: 470px; }
      @media (max-width: 1000px) {
        .filter-grid, .summary-grid, .blocker-grid { grid-template-columns: repeat(2, 1fr); }
      }
      @media (max-width: 700px) {
        .filter-grid, .summary-grid, .blocker-grid, .checklist { grid-template-columns: 1fr; }
        .installment-grid { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class AnnualTaxPageComponent {
  private readonly api = inject(AnnualTaxApiService);
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly auth = inject(AuthService);

  companies: ClientCompany[] = [];
  returns: AnnualTaxReturn[] = [];
  selected?: AnnualTaxReturn;
  clientCompanyId = '';
  fiscalYear = new Date().getFullYear() - 1;
  busy = false;
  message = '';
  errorMessage = '';
  paymentForms: Record<string, { paidAt: string; paymentReference: string }> = {};
  draft: AnnualTaxUpdatePayload = this.emptyDraft();
  submission: AnnualTaxSubmissionPayload = this.emptySubmission();

  constructor() {
    this.companiesApi.findAll().subscribe({
      next: (companies) => (this.companies = companies),
      error: (error) => (this.errorMessage = this.errorText(error)),
    });
  }

  load(selectId?: string): void {
    this.selected = undefined;
    this.returns = [];
    if (!this.clientCompanyId) return;
    this.busy = true;
    this.api.findAll(this.clientCompanyId, this.fiscalYear).subscribe({
      next: (items) => {
        this.returns = items;
        const item = items.find((entry) => entry.id === selectId) ?? items[0];
        if (item) this.select(item);
        this.busy = false;
      },
      error: (error) => this.fail(error),
    });
  }

  generate(createAmending: boolean): void {
    if (!this.clientCompanyId) return;
    this.start();
    this.api.generate(this.clientCompanyId, this.fiscalYear, createAmending).subscribe({
      next: (item) => {
        this.message = createAmending ? 'Δημιουργήθηκε τροποποιητική δήλωση.' : 'Το ετήσιο φορολογικό φύλλο ενημερώθηκε.';
        this.busy = false;
        this.load(item.id);
      },
      error: (error) => this.fail(error),
    });
  }

  select(item: AnnualTaxReturn): void {
    this.selected = item;
    this.draft = {
      includesE2: item.includesE2,
      includesE3: item.includesE3,
      submissionDeadline: item.submissionDeadline.slice(0, 10),
      nonDeductibleExpenses: Number(item.nonDeductibleExpenses),
      taxExemptIncome: Number(item.taxExemptIncome),
      otherTaxAdditions: Number(item.otherTaxAdditions),
      otherTaxDeductions: Number(item.otherTaxDeductions),
      priorTaxLosses: Number(item.priorTaxLosses),
      checklist: { ...item.checklist },
      adjustmentNotes: item.adjustmentNotes ?? '',
    };
    this.paymentForms = Object.fromEntries(
      item.installments.map((installment) => [
        installment.id,
        { paidAt: new Date().toISOString().slice(0, 10), paymentReference: '' },
      ]),
    );
    if (item.status === 'APPROVED') {
      this.submission = this.emptySubmission();
    }
  }

  saveDraft(next?: () => void): void {
    if (!this.selected) return;
    this.start();
    this.api.update(this.selected.id, this.draft).subscribe({
      next: (item) => {
        this.replace(item);
        this.message = 'Οι φορολογικές αναμορφώσεις αποθηκεύτηκαν.';
        this.busy = false;
        next?.();
      },
      error: (error) => this.fail(error),
    });
  }

  markReady(): void {
    if (!this.selected) return;
    this.saveDraft(() => {
      if (!this.selected) return;
      this.start();
      this.api.markReady(this.selected.id).subscribe({
        next: (item) => this.complete(item, 'Το φύλλο στάλθηκε για λογιστική έγκριση.'),
        error: (error) => this.fail(error),
      });
    });
  }

  approve(): void {
    if (!this.selected) return;
    this.start();
    this.api.approve(this.selected.id).subscribe({
      next: (item) => this.complete(item, 'Το ετήσιο φορολογικό φύλλο εγκρίθηκε.'),
      error: (error) => this.fail(error),
    });
  }

  reopen(): void {
    if (!this.selected) return;
    this.start();
    this.api.reopen(this.selected.id).subscribe({
      next: (item) => this.complete(item, 'Το φύλλο επέστρεψε σε πρόχειρο για νέο έλεγχο.'),
      error: (error) => this.fail(error),
    });
  }

  submitOfficial(): void {
    if (!this.selected) return;
    this.start();
    this.api.submit(this.selected.id, this.submission).subscribe({
      next: (item) => this.complete(item, 'Η επίσημη υποβολή και το εκκαθαριστικό καταχωρίστηκαν.'),
      error: (error) => this.fail(error),
    });
  }

  pay(installmentId: string): void {
    const form = this.paymentForms[installmentId];
    if (!form?.paidAt || !form.paymentReference.trim()) {
      this.errorMessage = 'Συμπληρώστε ημερομηνία και αναφορά πληρωμής.';
      return;
    }
    this.start();
    this.api.payInstallment(installmentId, form.paidAt, form.paymentReference).subscribe({
      next: () => {
        this.message = 'Η πληρωμή της δόσης καταχωρίστηκε.';
        this.busy = false;
        this.load(this.selected?.id);
      },
      error: (error) => this.fail(error),
    });
  }

  buildInstallments(): void {
    const totalCents = Math.round(Number(this.submission.totalPayable || 0) * 100);
    if (totalCents <= 0) {
      this.submission.installments = [];
      return;
    }
    const base = Math.floor(totalCents / 8);
    let allocated = 0;
    this.submission.installments = Array.from({ length: 8 }, (_, index) => {
      const cents = index === 7 ? totalCents - allocated : base;
      allocated += cents;
      return {
        installmentNumber: index + 1,
        dueDate: this.lastBusinessDay(this.fiscalYear + 1, 7 + index),
        amount: cents / 100,
      };
    });
  }

  canApprove(): boolean {
    return this.auth.hasAnyRole(ACCOUNTING_CONTROL_ROLES);
  }

  canCreateAmending(): boolean {
    return this.returns.some((item) => item.status === 'SUBMITTED');
  }

  formLabel(item: AnnualTaxReturn): string {
    const forms = [item.kind === 'INDIVIDUAL_E1' ? 'Ε1' : 'Ν'];
    if (item.includesE2) forms.push('Ε2');
    if (item.includesE3) forms.push('Ε3');
    return forms.join(' / ');
  }

  statusLabel(status: AnnualTaxReturn['status']): string {
    return { DRAFT: 'Πρόχειρο', READY: 'Για έγκριση', APPROVED: 'Εγκεκριμένο', SUBMITTED: 'Υποβλήθηκε' }[status];
  }

  asNumber(value: string | number): number {
    return Number(value);
  }

  private replace(item: AnnualTaxReturn): void {
    this.returns = this.returns.map((entry) => (entry.id === item.id ? item : entry));
    this.select(item);
  }

  private complete(item: AnnualTaxReturn, message: string): void {
    this.replace(item);
    this.message = message;
    this.busy = false;
  }

  private start(): void {
    this.busy = true;
    this.message = '';
    this.errorMessage = '';
  }

  private fail(error: unknown): void {
    this.errorMessage = this.errorText(error);
    this.busy = false;
  }

  private errorText(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = error.error?.message;
      return Array.isArray(message) ? message.join(' ') : message || 'Η ενέργεια απέτυχε.';
    }
    return 'Η ενέργεια απέτυχε.';
  }

  private emptyDraft(): AnnualTaxUpdatePayload {
    const checklist: AnnualTaxChecklist = {
      booksReconciled: false,
      myDataReviewed: false,
      depreciationsReviewed: false,
      inventoryReviewed: false,
      taxAdjustmentsReviewed: false,
      formsReviewed: false,
    };
    return {
      includesE2: false,
      includesE3: true,
      submissionDeadline: '',
      nonDeductibleExpenses: 0,
      taxExemptIncome: 0,
      otherTaxAdditions: 0,
      otherTaxDeductions: 0,
      priorTaxLosses: 0,
      checklist,
      adjustmentNotes: '',
    };
  }

  private emptySubmission(): AnnualTaxSubmissionPayload {
    return {
      submissionReference: '',
      submittedAt: new Date().toISOString().slice(0, 10),
      assessmentReference: '',
      debtId: '',
      assessedIncomeTax: 0,
      taxPrepayment: 0,
      otherAssessedAmounts: 0,
      totalPayable: 0,
      refundAmount: 0,
      installments: [],
      submissionNotes: '',
    };
  }

  private lastBusinessDay(year: number, oneBasedMonth: number): string {
    const date = new Date(Date.UTC(year, oneBasedMonth, 0));
    while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
      date.setUTCDate(date.getUTCDate() - 1);
    }
    return date.toISOString().slice(0, 10);
  }
}
