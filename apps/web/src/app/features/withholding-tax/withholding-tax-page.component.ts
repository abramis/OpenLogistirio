import { DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClientCompany, CompaniesApiService } from '../../core/api/companies-api.service';
import {
  WithholdingTaxApiService,
  WithholdingTaxCategory,
  WithholdingTaxLine,
  WithholdingTaxLinePayload,
  WithholdingTaxReturn,
} from '../../core/api/withholding-tax-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ACCOUNTING_CONTROL_ROLES } from '../../core/auth/user-roles';

@Component({
  selector: 'ol-withholding-tax-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, NgFor, NgIf],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Παρακρατούμενοι φόροι</h1>
        <p class="page-subtitle">
          Παραγωγική μηνιαία ροή ΑΑΔΕ για επιχειρηματική δραστηριότητα, μερίσματα,
          τόκους και δικαιώματα.
        </p>
      </div>
    </section>

    <div class="alert alert-success" *ngIf="message">{{ message }}</div>
    <div class="alert alert-danger" *ngIf="errorMessage">{{ errorMessage }}</div>

    <section class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">Νέα μηνιαία δήλωση</h2>
          <p class="card-subtitle">
            Μία κατηγορία ανά δήλωση. Η προθεσμία υπολογίζεται στο τέλος του δεύτερου
            μήνα μετά την πληρωμή.
          </p>
        </div>
      </div>
      <div class="card-body form-grid">
        <label>
          Πελάτης
          <select [(ngModel)]="clientCompanyId" (ngModelChange)="clientChanged()" name="client">
            <option value="">Επιλογή πελάτη</option>
            <option *ngFor="let company of companies" [value]="company.id">
              {{ company.legalName }} — {{ company.vatNumber }}
            </option>
          </select>
        </label>
        <label>
          Έτος πληρωμής
          <input [(ngModel)]="periodYear" name="year" type="number" min="2000" max="2200" />
        </label>
        <label>
          Μήνας πληρωμής
          <select [(ngModel)]="periodMonth" name="month" (ngModelChange)="periodChanged()">
            <option *ngFor="let month of months; let index = index" [value]="index + 1">
              {{ month }}
            </option>
          </select>
        </label>
        <label>
          Τύπος δήλωσης
          <select [(ngModel)]="category" name="category" (ngModelChange)="categoryChanged()">
            <option value="BUSINESS_ACTIVITY">Επιχειρηματική δραστηριότητα</option>
            <option value="DIVIDENDS">Μερίσματα</option>
            <option value="INTEREST">Τόκοι</option>
            <option value="ROYALTIES">Δικαιώματα</option>
          </select>
        </label>
      </div>
      <div class="card-body profile-grid">
        <label class="check"><input type="checkbox" [(ngModel)]="profile.declarantIsLegalEntity" /> Νομικό πρόσωπο</label>
        <label>{{ profile.declarantIsLegalEntity ? 'Επωνυμία δηλούντος' : 'Επώνυμο δηλούντος' }}<input [(ngModel)]="profile.declarantName" [attr.maxlength]="profile.declarantIsLegalEntity ? 30 : 18" /></label>
        <label *ngIf="!profile.declarantIsLegalEntity">Όνομα<input [(ngModel)]="profile.declarantFirstName" maxlength="9" /></label>
        <label *ngIf="!profile.declarantIsLegalEntity">Πατρώνυμο<input [(ngModel)]="profile.declarantFatherName" maxlength="3" /></label>
        <label>Αντικείμενο δραστηριότητας<input [(ngModel)]="profile.businessActivity" maxlength="16" /></label>
        <label>Πόλη<input [(ngModel)]="profile.city" maxlength="10" /></label>
        <label>Οδός<input [(ngModel)]="profile.street" maxlength="16" /></label>
        <label>Αριθμός<input [(ngModel)]="profile.streetNumber" maxlength="5" /></label>
        <label>ΤΚ<input [(ngModel)]="profile.postalCode" maxlength="5" inputmode="numeric" /></label>
      </div>
      <div class="card-footer actions">
        <button class="btn btn-primary" type="button" [disabled]="!clientCompanyId || busy" (click)="generate(false)">
          Δημιουργία / άνοιγμα
        </button>
        <button class="btn btn-secondary" type="button" [disabled]="!canCreateAmending() || busy" (click)="generate(true)">
          Νέα τροποποιητική
        </button>
      </div>
    </section>

    <section class="table-wrap history" *ngIf="returns.length">
      <table>
        <thead>
          <tr>
            <th>Περίοδος</th>
            <th>Κατηγορία</th>
            <th>Τύπος</th>
            <th>Κατάσταση</th>
            <th>Παρακρατηθείς φόρος</th>
            <th>Προθεσμία</th>
          </tr>
        </thead>
        <tbody>
          <tr
            *ngFor="let item of returns"
            (click)="select(item)"
            [class.selected]="selected?.id === item.id"
          >
            <td>{{ monthLabel(item.periodMonth) }} {{ item.periodYear }}</td>
            <td>{{ categoryLabel(item.category) }}</td>
            <td>{{ item.returnType === 'INITIAL' ? 'Αρχική' : 'Τροποποιητική ' + item.revision }}</td>
            <td><span class="status" [attr.data-status]="item.status">{{ statusLabel(item.status) }}</span></td>
            <td>{{ item.withheldTaxAmount | number: '1.2-2' }} €</td>
            <td>{{ item.submissionDeadline | date: 'dd/MM/yyyy' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <ng-container *ngIf="selected as item">
      <section class="summary-grid">
        <article class="metric"><span>Μικτό ποσό</span><strong>{{ item.grossAmount | number: '1.2-2' }} €</strong></article>
        <article class="metric"><span>Καθαρό ποσό</span><strong>{{ item.netAmount | number: '1.2-2' }} €</strong></article>
        <article class="metric"><span>Παρακρατηθείς φόρος</span><strong>{{ item.withheldTaxAmount | number: '1.2-2' }} €</strong></article>
        <article class="metric primary"><span>Πληρωτέο δήλωσης</span><strong>{{ item.payableAmount | number: '1.2-2' }} €</strong></article>
      </section>

      <form class="card" *ngIf="item.status === 'DRAFT'" (ngSubmit)="saveHeader()">
        <div class="card-header"><h2 class="card-title">Στοιχεία δηλούντος στο αρχείο ΑΑΔΕ</h2></div>
        <div class="card-body profile-grid">
          <label class="check"><input type="checkbox" [(ngModel)]="header.declarantIsLegalEntity" name="isLegal" /> Νομικό πρόσωπο</label>
          <label>{{ header.declarantIsLegalEntity ? 'Επωνυμία' : 'Επώνυμο' }}<input [(ngModel)]="header.declarantName" name="declarantName" [attr.maxlength]="header.declarantIsLegalEntity ? 30 : 18" required /></label>
          <label *ngIf="!header.declarantIsLegalEntity">Όνομα<input [(ngModel)]="header.declarantFirstName" name="declarantFirstName" maxlength="9" required /></label>
          <label *ngIf="!header.declarantIsLegalEntity">Πατρώνυμο<input [(ngModel)]="header.declarantFatherName" name="declarantFatherName" maxlength="3" /></label>
          <label>Αντικείμενο<input [(ngModel)]="header.businessActivity" name="businessActivity" maxlength="16" required /></label>
          <label>Πόλη<input [(ngModel)]="header.city" name="city" maxlength="10" required /></label>
          <label>Οδός<input [(ngModel)]="header.street" name="street" maxlength="16" required /></label>
          <label>Αριθμός<input [(ngModel)]="header.streetNumber" name="streetNumber" maxlength="5" required /></label>
          <label>ΤΚ<input [(ngModel)]="header.postalCode" name="postalCode" maxlength="5" pattern="[0-9]{5}" required /></label>
          <label>Προθεσμία<input [(ngModel)]="header.submissionDeadline" name="deadline" type="date" required /></label>
          <label class="wide">Σημειώσεις<textarea [(ngModel)]="header.notes" name="notes" rows="2"></textarea></label>
        </div>
        <div class="card-footer"><button class="btn btn-secondary" [disabled]="busy">Αποθήκευση στοιχείων</button></div>
      </form>

      <section class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Αναλυτικές εγγραφές δικαιούχων</h2>
            <p class="card-subtitle">
              Οι συνήθεις συντελεστές προτείνονται αυτόματα. ΣΣΑΔ/ειδικοί κωδικοί απαιτούν ρητό συντελεστή.
            </p>
          </div>
        </div>
        <div class="table-wrap" *ngIf="item.lines.length">
          <table>
            <thead><tr><th>Δικαιούχος</th><th>Κωδ.</th><th>Ημ/νία</th><th>Μικτό</th><th>Συντ.</th><th>Φόρος</th><th>ΨΤΣ</th><th *ngIf="item.status === 'DRAFT'"></th></tr></thead>
            <tbody>
              <tr *ngFor="let line of item.lines">
                <td><strong>{{ line.beneficiaryLastName }} {{ line.beneficiaryFirstName }}</strong><small>{{ line.foreignWithoutGreekVat ? line.countryCode : line.beneficiaryVatNumber }}</small></td>
                <td>{{ line.incomeCode }}</td>
                <td>{{ line.paymentDate | date: 'dd/MM/yyyy' }}</td>
                <td>{{ line.grossAmount | number: '1.2-2' }} €</td>
                <td>{{ line.withholdingRate | number: '1.0-3' }}%</td>
                <td>{{ line.withheldTaxAmount | number: '1.2-2' }} €</td>
                <td>{{ line.digitalFeeAmount | number: '1.2-2' }} €</td>
                <td class="row-actions" *ngIf="item.status === 'DRAFT'">
                  <button class="btn btn-sm btn-secondary" type="button" (click)="editLine(line)">Αλλαγή</button>
                  <button class="btn btn-sm btn-danger" type="button" (click)="deleteLine(line.id)">Διαγραφή</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <form class="card-body line-form" *ngIf="item.status === 'DRAFT'" (ngSubmit)="saveLine()">
          <label>
            <input type="checkbox" [(ngModel)]="line.foreignWithoutGreekVat" name="foreign" />
            Αλλοδαπός χωρίς ελληνικό ΑΦΜ
          </label>
          <label *ngIf="!line.foreignWithoutGreekVat">ΑΦΜ δικαιούχου<input [(ngModel)]="line.beneficiaryVatNumber" name="vat" maxlength="9" required /></label>
          <label *ngIf="line.foreignWithoutGreekVat">Χώρα (ISO 2)<input [(ngModel)]="line.countryCode" name="country" maxlength="2" required /></label>
          <label>Επώνυμο / επωνυμία<input [(ngModel)]="line.beneficiaryLastName" name="lastName" maxlength="18" required /></label>
          <label>Όνομα<input [(ngModel)]="line.beneficiaryFirstName" name="firstName" maxlength="9" /></label>
          <label>Πατρώνυμο<input [(ngModel)]="line.beneficiaryFatherName" name="fatherName" maxlength="3" /></label>
          <label>Κωδικός αμοιβής<input [(ngModel)]="line.incomeCode" name="incomeCode" maxlength="2" required /></label>
          <label>Ημερομηνία πληρωμής<input [(ngModel)]="line.paymentDate" name="paymentDate" type="date" required /></label>
          <label>Μικτό ποσό<input [(ngModel)]="line.grossAmount" name="gross" type="number" min="0.01" step="0.01" required /></label>
          <label>Κρατήσεις εκτός φόρου<input [(ngModel)]="line.deductionsAmount" name="deductions" type="number" min="0" step="0.01" /></label>
          <label>Συντελεστής φόρου %<input [(ngModel)]="line.withholdingRate" name="rate" type="number" min="0" max="100" step="1" placeholder="αυτόματος" /></label>
          <label>Παρακρατηθείς φόρος<input [(ngModel)]="line.withheldTaxAmount" name="tax" type="number" min="0" step="0.01" placeholder="αυτόματος" /></label>
          <label>
            Ψηφιακό Τέλος %
            <select [(ngModel)]="line.digitalFeeRate" name="digitalFeeRate">
              <option [ngValue]="0">0%</option><option [ngValue]="1.2">1,2%</option>
              <option [ngValue]="2.4">2,4%</option><option [ngValue]="3.6">3,6%</option>
            </select>
          </label>
          <label class="wide">Σημειώσεις / τεκμηρίωση ειδικού συντελεστή<textarea [(ngModel)]="line.notes" name="lineNotes" rows="2"></textarea></label>
          <div class="wide actions">
            <button class="btn btn-primary" [disabled]="busy">{{ editingLineId ? 'Ενημέρωση εγγραφής' : 'Προσθήκη εγγραφής' }}</button>
            <button *ngIf="editingLineId" class="btn btn-secondary" type="button" (click)="resetLine()">Ακύρωση</button>
          </div>
        </form>
      </section>

      <section class="card workflow">
        <div class="card-header">
          <div>
            <h2 class="card-title">Έλεγχος και επίσημη υποβολή</h2>
            <p class="card-subtitle">Αρχείο zip → πρωτόκολλο αρχείου → υποβολή δήλωσης → Ταυτότητα Οφειλής → πληρωμή.</p>
          </div>
          <span class="status" [attr.data-status]="item.status">{{ statusLabel(item.status) }}</span>
        </div>
        <div class="card-body actions" *ngIf="item.status === 'DRAFT'">
          <button class="btn btn-primary" type="button" [disabled]="busy || !item.lines.length" (click)="markReady()">Έτοιμο για έγκριση</button>
        </div>
        <div class="card-body actions" *ngIf="item.status === 'READY'">
          <button class="btn btn-secondary" type="button" [disabled]="busy || !canApprove()" (click)="reopen()">Επιστροφή</button>
          <button class="btn btn-primary" type="button" [disabled]="busy || !canApprove()" (click)="approve()">Έγκριση λογιστή</button>
        </div>
        <div class="card-body" *ngIf="item.status === 'APPROVED'">
          <button class="btn btn-primary" type="button" [disabled]="busy || !canApprove()" (click)="downloadAadeFile()">
            Λήψη επίσημου zip ΑΑΔΕ 2026
          </button>
          <p class="hint">Ανεβάστε το zip στην ΑΑΔΕ. Μόλις λάβετε πρωτόκολλο αρχείου, συμπληρώστε την υποβολή.</p>
          <form class="submission-grid" (ngSubmit)="submitOfficial()">
            <label>Πρωτόκολλο αρχείου<input [(ngModel)]="submission.fileProtocol" name="fileProtocol" required /></label>
            <label>Αριθμός δήλωσης<input [(ngModel)]="submission.submissionReference" name="submissionReference" required /></label>
            <label>Ημερομηνία υποβολής<input [(ngModel)]="submission.submittedAt" name="submittedAt" type="date" required /></label>
            <label>Πληρωτέο ΑΑΔΕ<input [(ngModel)]="submission.payableAmount" name="payableAmount" type="number" min="0" step="0.01" required /></label>
            <label>Ταυτότητα Οφειλής<input [(ngModel)]="submission.debtId" name="debtId" /></label>
            <div class="actions"><button class="btn btn-primary" [disabled]="busy || !item.fileGeneratedAt">Καταχώριση επίσημης υποβολής</button></div>
          </form>
          <button class="btn btn-secondary" type="button" [disabled]="busy || !canApprove()" (click)="reopen()">Επιστροφή για διόρθωση</button>
        </div>
        <div class="card-body" *ngIf="item.status === 'SUBMITTED'">
          <div class="official-grid">
            <div><span>Πρωτόκολλο αρχείου</span><strong>{{ item.fileProtocol }}</strong></div>
            <div><span>Αριθμός δήλωσης</span><strong>{{ item.submissionReference }}</strong></div>
            <div><span>Ταυτότητα Οφειλής</span><strong>{{ item.debtId || '—' }}</strong></div>
            <div><span>Υποβολή</span><strong>{{ item.submittedAt | date: 'dd/MM/yyyy' }}</strong></div>
          </div>
          <div class="alert alert-danger" *ngIf="item.lateSubmission">Εκπρόθεσμη υποβολή</div>
          <form class="payment-grid" *ngIf="asNumber(item.payableAmount) > 0 && !item.paidAt" (ngSubmit)="pay()">
            <label>Ημερομηνία πληρωμής<input [(ngModel)]="payment.paidAt" name="paidAt" type="date" required /></label>
            <label>Αναφορά πληρωμής<input [(ngModel)]="payment.paymentReference" name="paymentReference" required /></label>
            <button class="btn btn-primary" [disabled]="busy">Καταχώριση πληρωμής</button>
          </form>
          <div class="alert alert-success" *ngIf="item.paidAt">
            Πληρώθηκε {{ item.paidAt | date: 'dd/MM/yyyy' }} — {{ item.paymentReference }}
            <span *ngIf="item.latePayment">(εκπρόθεσμα)</span>
          </div>
        </div>
      </section>
    </ng-container>

    <section class="empty-state" *ngIf="clientCompanyId && !returns.length && !busy">
      Δεν υπάρχουν δηλώσεις για την επιλεγμένη περίοδο.
    </section>
  `,
  styles: `
    .form-grid,.profile-grid,.line-form,.submission-grid,.payment-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem}
    label{display:flex;flex-direction:column;gap:.38rem;font-size:.84rem;font-weight:650;color:var(--text-secondary)}
    input,select,textarea{width:100%;padding:.68rem .78rem;border:1px solid var(--border-color);border-radius:.5rem;background:var(--surface);color:var(--text-primary)}
    .profile-grid{border-top:1px solid var(--border-color)}
    .wide{grid-column:1/-1}.actions{display:flex;gap:.65rem;align-items:end;flex-wrap:wrap}.check{flex-direction:row;align-items:center}.check input{width:auto}
    .history{margin:1rem 0}.history tr{cursor:pointer}.history tr.selected{background:var(--primary-soft)}
    td small{display:block;color:var(--text-secondary);margin-top:.2rem}
    .summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin:1rem 0}
    .metric{background:var(--surface);border:1px solid var(--border-color);border-radius:.65rem;padding:1rem;display:flex;flex-direction:column;gap:.35rem}
    .metric span,.official-grid span{font-size:.78rem;color:var(--text-secondary)}.metric strong{font-size:1.25rem}
    .metric.primary{border-color:var(--primary);background:var(--primary-soft)}
    .line-form{border-top:1px solid var(--border-color)}.row-actions{display:flex;gap:.35rem}
    .workflow{margin-top:1rem}.hint{color:var(--text-secondary);font-size:.86rem;margin:.8rem 0}
    .official-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:1rem}
    .official-grid div{display:flex;flex-direction:column;gap:.3rem}.payment-grid{align-items:end;margin-top:1rem}
    .status{display:inline-flex;padding:.25rem .55rem;border-radius:999px;background:var(--surface-muted);font-size:.76rem;font-weight:700}
    .status[data-status="READY"]{background:#fff4cc;color:#7a5700}.status[data-status="APPROVED"]{background:#dff3ff;color:#075985}
    .status[data-status="SUBMITTED"]{background:#dcfce7;color:#166534}
    @media(max-width:900px){.summary-grid{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:560px){.summary-grid{grid-template-columns:1fr}}
  `,
})
export class WithholdingTaxPageComponent implements OnInit {
  private readonly api = inject(WithholdingTaxApiService);
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly auth = inject(AuthService);

  readonly months = ['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'];
  companies: ClientCompany[] = [];
  returns: WithholdingTaxReturn[] = [];
  selected?: WithholdingTaxReturn;
  clientCompanyId = '';
  periodYear = new Date().getFullYear();
  periodMonth = new Date().getMonth() + 1;
  category: WithholdingTaxCategory = 'BUSINESS_ACTIVITY';
  busy = false;
  message = '';
  errorMessage = '';
  editingLineId?: string;
  profile = { declarantName: '', declarantFirstName: '', declarantFatherName: '', declarantIsLegalEntity: true, businessActivity: '', city: '', street: '', streetNumber: '', postalCode: '' };
  header = { ...this.profile, submissionDeadline: '', notes: '' };
  line = this.emptyLine();
  submission = this.emptySubmission();
  payment = { paidAt: today(), paymentReference: '' };

  ngOnInit(): void {
    this.companiesApi.findAll().subscribe({
      next: (items) => (this.companies = items),
      error: (error) => this.fail(error),
    });
  }

  clientChanged(): void {
    const company = this.companies.find((item) => item.id === this.clientCompanyId);
    if (company) {
      this.profile.declarantName = company.legalName.slice(0, 30);
      this.profile.declarantIsLegalEntity = !['FREELANCER', 'SOLE_PROPRIETOR'].includes(company.entityType);
      this.profile.businessActivity = (company.professionLabel ?? '').slice(0, 16);
      this.profile.street = (company.address ?? '').slice(0, 16);
    }
    this.load();
  }

  periodChanged(): void {
    this.line.paymentDate = periodDate(this.periodYear, this.periodMonth);
    this.load();
  }

  categoryChanged(): void {
    this.resetLine();
    this.load();
  }

  load(selectId?: string): void {
    if (!this.clientCompanyId) {
      this.returns = [];
      this.selected = undefined;
      return;
    }
    this.busy = true;
    this.api.findAll(this.clientCompanyId, this.periodYear, this.periodMonth).subscribe({
      next: (items) => {
        this.returns = items;
        const selected = items.find((item) => item.id === selectId) ?? items[0];
        if (selected) this.select(selected);
        else this.selected = undefined;
        this.busy = false;
      },
      error: (error) => this.fail(error),
    });
  }

  generate(createAmending: boolean): void {
    this.start();
    this.api.generate({
      clientCompanyId: this.clientCompanyId,
      periodYear: this.periodYear,
      periodMonth: this.periodMonth,
      category: this.category,
      createAmending,
      ...clean(this.profile),
    }).subscribe({
      next: (item) => {
        this.message = createAmending ? 'Δημιουργήθηκε τροποποιητική δήλωση.' : 'Η δήλωση είναι έτοιμη για καταχώριση.';
        this.busy = false;
        this.load(item.id);
      },
      error: (error) => this.fail(error),
    });
  }

  select(item: WithholdingTaxReturn): void {
    this.selected = item;
    this.category = item.category;
    this.header = {
      declarantName: item.declarantName,
      declarantFirstName: item.declarantFirstName ?? '',
      declarantFatherName: item.declarantFatherName ?? '',
      declarantIsLegalEntity: item.declarantIsLegalEntity,
      businessActivity: item.businessActivity,
      city: item.city,
      street: item.street,
      streetNumber: item.streetNumber,
      postalCode: item.postalCode,
      submissionDeadline: item.submissionDeadline.slice(0, 10),
      notes: item.notes ?? '',
    };
    this.submission = { ...this.emptySubmission(), payableAmount: Number(item.payableAmount) };
    this.payment = { paidAt: today(), paymentReference: '' };
    this.resetLine();
  }

  saveHeader(next?: () => void): void {
    if (!this.selected) return;
    this.start();
    this.api.update(this.selected.id, clean(this.header)).subscribe({
      next: (item) => {
        this.replace(item);
        this.message = 'Τα στοιχεία δηλούντος αποθηκεύτηκαν.';
        this.busy = false;
        next?.();
      },
      error: (error) => this.fail(error),
    });
  }

  saveLine(): void {
    if (!this.selected) return;
    const payload = clean(this.line) as unknown as WithholdingTaxLinePayload;
    this.start();
    const request = this.editingLineId
      ? this.api.updateLine(this.selected.id, this.editingLineId, payload)
      : this.api.addLine(this.selected.id, payload);
    request.subscribe({
      next: (item) => {
        this.replace(item);
        this.resetLine();
        this.message = 'Η αναλυτική εγγραφή αποθηκεύτηκε.';
        this.busy = false;
      },
      error: (error) => this.fail(error),
    });
  }

  editLine(item: WithholdingTaxLine): void {
    this.editingLineId = item.id;
    this.line = {
      beneficiaryVatNumber: item.beneficiaryVatNumber ?? '',
      beneficiaryLastName: item.beneficiaryLastName,
      beneficiaryFirstName: item.beneficiaryFirstName ?? '',
      beneficiaryFatherName: item.beneficiaryFatherName ?? '',
      foreignWithoutGreekVat: item.foreignWithoutGreekVat,
      countryCode: item.countryCode ?? '',
      incomeCode: item.incomeCode,
      paymentDate: item.paymentDate.slice(0, 10),
      grossAmount: Number(item.grossAmount),
      deductionsAmount: Number(item.deductionsAmount),
      withholdingRate: Number(item.withholdingRate),
      withheldTaxAmount: Number(item.withheldTaxAmount),
      digitalFeeRate: Number(item.digitalFeeRate),
      notes: item.notes ?? '',
    };
  }

  deleteLine(lineId: string): void {
    if (!this.selected || !confirm('Να διαγραφεί η αναλυτική εγγραφή;')) return;
    this.start();
    this.api.deleteLine(this.selected.id, lineId).subscribe({
      next: (item) => this.complete(item, 'Η εγγραφή διαγράφηκε.'),
      error: (error) => this.fail(error),
    });
  }

  markReady(): void {
    this.saveHeader(() => this.transition('ready', 'Η δήλωση στάλθηκε για έγκριση.'));
  }
  approve(): void { this.transition('approve', 'Η δήλωση εγκρίθηκε.'); }
  reopen(): void { this.transition('reopen', 'Η δήλωση επέστρεψε σε πρόχειρο.'); }

  downloadAadeFile(): void {
    if (!this.selected) return;
    this.start();
    const id = this.selected.id;
    this.api.downloadAadeFile(id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${this.selected?.declarantVatNumber}_${this.periodYear}_${String(this.periodMonth).padStart(2, '0')}_aade.zip`;
        anchor.click();
        URL.revokeObjectURL(url);
        this.message = 'Το επίσημο zip ΑΑΔΕ δημιουργήθηκε.';
        this.busy = false;
        this.load(id);
      },
      error: (error) => this.fail(error),
    });
  }

  submitOfficial(): void {
    if (!this.selected) return;
    this.start();
    this.api.submit(this.selected.id, this.submission).subscribe({
      next: (item) => this.complete(item, 'Η επίσημη υποβολή καταχωρίστηκε.'),
      error: (error) => this.fail(error),
    });
  }

  pay(): void {
    if (!this.selected) return;
    this.start();
    this.api.pay(this.selected.id, this.payment.paidAt, this.payment.paymentReference).subscribe({
      next: (item) => this.complete(item, 'Η πληρωμή καταχωρίστηκε.'),
      error: (error) => this.fail(error),
    });
  }

  resetLine(): void {
    this.editingLineId = undefined;
    this.line = this.emptyLine();
  }

  canApprove(): boolean { return this.auth.hasAnyRole(ACCOUNTING_CONTROL_ROLES); }
  canCreateAmending(): boolean {
    return this.returns.some((item) => item.category === this.category && item.status === 'SUBMITTED');
  }
  asNumber(value: string | number): number { return Number(value); }
  monthLabel(month: number): string { return this.months[month - 1]; }
  categoryLabel(category: WithholdingTaxCategory): string {
    return { BUSINESS_ACTIVITY: 'Επιχειρηματική δραστηριότητα', DIVIDENDS: 'Μερίσματα', INTEREST: 'Τόκοι', ROYALTIES: 'Δικαιώματα' }[category];
  }
  statusLabel(status: WithholdingTaxReturn['status']): string {
    return { DRAFT: 'Πρόχειρο', READY: 'Για έγκριση', APPROVED: 'Εγκεκριμένο', SUBMITTED: 'Υποβλήθηκε' }[status];
  }

  private transition(action: 'ready' | 'approve' | 'reopen', message: string): void {
    if (!this.selected) return;
    this.start();
    this.api.transition(this.selected.id, action).subscribe({
      next: (item) => this.complete(item, message),
      error: (error) => this.fail(error),
    });
  }

  private replace(item: WithholdingTaxReturn): void {
    this.returns = this.returns.map((entry) => entry.id === item.id ? item : entry);
    this.select(item);
  }
  private complete(item: WithholdingTaxReturn, message: string): void {
    this.replace(item); this.message = message; this.busy = false;
  }
  private start(): void { this.busy = true; this.message = ''; this.errorMessage = ''; }
  private fail(error: unknown): void {
    this.errorMessage = error instanceof HttpErrorResponse
      ? (Array.isArray(error.error?.message) ? error.error.message.join(' ') : error.error?.message || 'Η ενέργεια απέτυχε.')
      : 'Η ενέργεια απέτυχε.';
    this.busy = false;
  }
  private emptyLine() {
    const defaults = {
      BUSINESS_ACTIVITY: { code: '01', rate: 20 },
      DIVIDENDS: { code: '01', rate: 5 },
      INTEREST: { code: '19', rate: 15 },
      ROYALTIES: { code: '32', rate: 20 },
    }[this.category];
    return {
      beneficiaryVatNumber: '', beneficiaryLastName: '', beneficiaryFirstName: '',
      beneficiaryFatherName: '', foreignWithoutGreekVat: false, countryCode: '',
      incomeCode: defaults.code, paymentDate: periodDate(this.periodYear, this.periodMonth),
      grossAmount: 0, deductionsAmount: 0, withholdingRate: defaults.rate as number | null,
      withheldTaxAmount: null as number | null, digitalFeeRate: 0, notes: '',
    };
  }
  private emptySubmission() {
    return { fileProtocol: '', submissionReference: '', submittedAt: today(), payableAmount: 0, debtId: '' };
  }
}

function clean<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== '' && item !== null && item !== undefined));
}
function today(): string { return new Date().toISOString().slice(0, 10); }
function periodDate(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}
