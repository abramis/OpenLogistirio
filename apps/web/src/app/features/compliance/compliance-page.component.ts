import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { CompaniesApiService, ClientCompany } from '../../core/api/companies-api.service';
import {
  CollectiveAgreement,
  ComplianceApiService,
  ComplianceReturn,
} from '../../core/api/compliance-api.service';

@Component({
  selector: 'ol-compliance-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Υποβολές v0.3</h1>
        <p class="page-subtitle">Ετήσιες βεβαιώσεις ΑΑΔΕ, VIES, Intrastat και ειδικές ΣΣΕ</p>
      </div>
    </section>
    <div class="alert alert-success" *ngIf="message">{{ message }}</div>
    <div class="alert alert-danger" *ngIf="error">{{ error }}</div>
    <section class="card">
      <div class="card-body filters">
        <select [(ngModel)]="companyId" (ngModelChange)="reload()">
          <option value="">Όλοι οι πελάτες</option>
          <option *ngFor="let c of companies" [value]="c.id">{{ c.legalName }}</option>
        </select>
      </div>
    </section>

    <section class="card">
      <div class="card-header"><h2 class="card-title">Ετήσιες βεβαιώσεις ΑΑΔΕ</h2></div>
      <form class="card-body form-grid" (ngSubmit)="generateAnnual()">
        <select [(ngModel)]="annualForm.clientCompanyId" name="ac" required>
          <option value="">Πελάτης</option>
          <option *ngFor="let c of companies" [value]="c.id">{{ c.legalName }}</option>
        </select>
        <input
          [(ngModel)]="annualForm.fiscalYear"
          name="ay"
          type="number"
          placeholder="Έτος"
          required
        />
        <select [(ngModel)]="annualForm.kind" name="ak">
          <option value="EMPLOYMENT">Αποδοχές μισθωτών</option>
          <option value="BUSINESS_ACTIVITY">Επιχειρηματική δραστηριότητα</option>
          <option value="DIVIDENDS_INTEREST_ROYALTIES">Μερίσματα / τόκοι / δικαιώματα</option>
        </select>
        <input [(ngModel)]="annualForm.city" name="acity" placeholder="Πόλη (έως 10)" />
        <input [(ngModel)]="annualForm.street" name="astreet" placeholder="Οδός (έως 16)" />
        <input [(ngModel)]="annualForm.streetNumber" name="ano" placeholder="Αριθμός" />
        <input [(ngModel)]="annualForm.postalCode" name="apc" placeholder="ΤΚ" />
        <button class="btn btn-primary">Δημιουργία & συμφωνία</button>
      </form>
      <ng-container
        *ngTemplateOutlet="returnTable; context: { rows: annual, type: 'annual' }"
      ></ng-container>
    </section>

    <section class="card">
      <div class="card-header"><h2 class="card-title">VIES</h2></div>
      <form class="card-body form-grid" (ngSubmit)="generateVies()">
        <select [(ngModel)]="viesForm.clientCompanyId" name="vc" required>
          <option value="">Πελάτης</option>
          <option *ngFor="let c of eligible('viesEnabled')" [value]="c.id">
            {{ c.legalName }}
          </option>
        </select>
        <input [(ngModel)]="viesForm.periodYear" name="vy" type="number" required /><input
          [(ngModel)]="viesForm.periodMonth"
          name="vm"
          type="number"
          min="1"
          max="12"
          required
        />
        <select [(ngModel)]="viesForm.kind" name="vk">
          <option value="F4_SUPPLIES">F4 Παραδόσεις</option>
          <option value="F5_ACQUISITIONS">F5 Αποκτήσεις</option>
        </select>
        <button class="btn btn-primary">Δημιουργία από βιβλία / myDATA</button>
      </form>
      <ng-container
        *ngTemplateOutlet="returnTable; context: { rows: vies, type: 'vies' }"
      ></ng-container>
    </section>

    <section class="card">
      <div class="card-header"><h2 class="card-title">Intrastat</h2></div>
      <form class="card-body form-grid" (ngSubmit)="generateIntrastat()">
        <select [(ngModel)]="intrastatForm.clientCompanyId" name="ic" required>
          <option value="">Πελάτης</option>
          <option *ngFor="let c of companies" [value]="c.id">{{ c.legalName }}</option>
        </select>
        <input [(ngModel)]="intrastatForm.periodYear" name="iy" type="number" required /><input
          [(ngModel)]="intrastatForm.periodMonth"
          name="im"
          type="number"
          min="1"
          max="12"
          required
        />
        <select [(ngModel)]="intrastatForm.flow" name="if">
          <option value="ARRIVALS">Αφίξεις</option>
          <option value="DISPATCHES">Αποστολές</option>
        </select>
        <button class="btn btn-primary">Έλεγχος κατωφλίου & δημιουργία</button>
      </form>
      <ng-container
        *ngTemplateOutlet="returnTable; context: { rows: intrastat, type: 'intrastat' }"
      ></ng-container>
    </section>

    <section class="card">
      <div class="card-header"><h2 class="card-title">Μητρώο ειδικών ΣΣΕ</h2></div>
      <form class="card-body form-grid" (ngSubmit)="createAgreement()">
        <select [(ngModel)]="agreementForm.clientCompanyId" name="sc">
          <option value="">Κοινή για το γραφείο</option>
          <option *ngFor="let c of eligible('collectiveAgreementEnabled')" [value]="c.id">
            {{ c.legalName }}
          </option>
        </select>
        <input [(ngModel)]="agreementForm.code" name="scode" placeholder="Κωδικός" required /><input
          [(ngModel)]="agreementForm.title"
          name="stitle"
          placeholder="Τίτλος"
          required
        />
        <input
          [(ngModel)]="agreementForm.activityCodesText"
          name="skad"
          placeholder="ΚΑΔ, χωρισμένοι με κόμμα"
        /><input
          [(ngModel)]="agreementForm.specialtyCodesText"
          name="sspec"
          placeholder="Κωδικοί ειδικότητας"
        />
        <input
          [(ngModel)]="agreementForm.sourceUrl"
          name="surl"
          placeholder="Επίσημη πηγή URL"
        /><button class="btn btn-primary">Νέα ΣΣΕ</button>
      </form>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Κωδικός</th>
              <th>Τίτλος</th>
              <th>Ισχύς</th>
              <th>Εκδόσεις</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let a of agreements">
              <td>{{ a.code }}</td>
              <td>{{ a.title }}</td>
              <td>{{ a.mandatory ? 'Υποχρεωτική' : 'Προαιρετική' }}</td>
              <td>
                {{ a.versions?.length || 0 }}
                <button class="btn btn-xs btn-secondary" (click)="addVersion(a)">Νέα έκδοση</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <ng-template #returnTable let-rows="rows" let-type="type"
      ><div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Πελάτης / περίοδος</th>
              <th>Είδος</th>
              <th>Κατάσταση</th>
              <th>Γραμμές</th>
              <th>Ενέργειες</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let r of rows">
              <td>
                {{ r.clientCompany.legalName
                }}<small>{{ r.fiscalYear || r.periodMonth + '/' + r.periodYear }}</small>
              </td>
              <td>{{ r.kind || r.flow }}</td>
              <td>
                <span class="badge">{{ r.status }}</span
                ><small *ngIf="r.blockerCount">{{ r.blockerCount }} blockers</small>
              </td>
              <td>{{ r.lines.length }}</td>
              <td class="row-actions">
                <button
                  class="btn btn-xs btn-secondary"
                  *ngIf="r.status === 'DRAFT'"
                  (click)="action(type, r, 'ready')"
                >
                  Έτοιμο</button
                ><button
                  class="btn btn-xs btn-secondary"
                  *ngIf="r.status === 'READY' || r.status === 'FILE_GENERATED'"
                  (click)="download(type, r)"
                >
                  Αρχείο</button
                ><button
                  class="btn btn-xs btn-primary"
                  *ngIf="r.status === 'FILE_GENERATED'"
                  (click)="action(type, r, 'submit')"
                >
                  Πρωτόκολλο</button
                ><button
                  class="btn btn-xs btn-secondary"
                  *ngIf="r.status === 'SUBMITTED'"
                  (click)="action(type, r, 'lock')"
                >
                  Κλείδωμα
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div></ng-template
    >
  `,
  styles: [
    `
      .filters {
        display: flex;
        gap: 1rem;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
        gap: 0.75rem;
        align-items: end;
      }
      .card {
        margin-bottom: 1rem;
      }
      .table-wrap {
        overflow: auto;
      }
      table {
        width: 100%;
      }
      small {
        display: block;
        color: var(--text-muted);
      }
      .row-actions {
        display: flex;
        gap: 0.35rem;
        flex-wrap: wrap;
      }
    `,
  ],
})
export class CompliancePageComponent implements OnInit {
  private readonly api = inject(ComplianceApiService);
  private readonly companiesApi = inject(CompaniesApiService);
  companies: ClientCompany[] = [];
  companyId = '';
  annual: ComplianceReturn[] = [];
  vies: ComplianceReturn[] = [];
  intrastat: ComplianceReturn[] = [];
  agreements: CollectiveAgreement[] = [];
  message = '';
  error = '';
  annualForm = {
    clientCompanyId: '',
    fiscalYear: new Date().getFullYear() - 1,
    kind: 'EMPLOYMENT',
    city: '',
    street: '',
    streetNumber: '',
    postalCode: '',
  };
  viesForm = {
    clientCompanyId: '',
    periodYear: new Date().getFullYear(),
    periodMonth: new Date().getMonth() + 1,
    kind: 'F4_SUPPLIES',
  };
  intrastatForm = {
    clientCompanyId: '',
    periodYear: new Date().getFullYear(),
    periodMonth: new Date().getMonth() + 1,
    flow: 'ARRIVALS',
  };
  agreementForm = {
    clientCompanyId: '',
    code: '',
    title: '',
    activityCodesText: '',
    specialtyCodesText: '',
    sourceUrl: '',
  };
  ngOnInit() {
    this.companiesApi.findAll().subscribe({
      next: (c) => {
        this.companies = c;
        this.reload();
      },
      error: (e) => this.fail(e),
    });
  }
  eligible(flag: keyof ClientCompany) {
    return this.companies.filter((c) => Boolean(c[flag]));
  }
  reload() {
    forkJoin({
      annual: this.api.annual(this.companyId),
      vies: this.api.vies(this.companyId),
      intrastat: this.api.intrastat(this.companyId),
      agreements: this.api.agreements(this.companyId),
    }).subscribe({ next: (r) => Object.assign(this, r), error: (e) => this.fail(e) });
  }
  generateAnnual() {
    this.api
      .generateAnnual({ ...this.annualForm, fiscalYear: Number(this.annualForm.fiscalYear) })
      .subscribe({
        next: () => this.done('Δημιουργήθηκε η ετήσια βεβαίωση.'),
        error: (e) => this.fail(e),
      });
  }
  generateVies() {
    this.api
      .generateVies({
        ...this.viesForm,
        periodYear: Number(this.viesForm.periodYear),
        periodMonth: Number(this.viesForm.periodMonth),
      })
      .subscribe({
        next: () => this.done('Δημιουργήθηκε η δήλωση VIES.'),
        error: (e) => this.fail(e),
      });
  }
  generateIntrastat() {
    this.api
      .generateIntrastat({
        ...this.intrastatForm,
        periodYear: Number(this.intrastatForm.periodYear),
        periodMonth: Number(this.intrastatForm.periodMonth),
      })
      .subscribe({
        next: () => this.done('Δημιουργήθηκε η δήλωση Intrastat.'),
        error: (e) => this.fail(e),
      });
  }
  createAgreement() {
    const f = this.agreementForm;
    this.api
      .createAgreement({
        clientCompanyId: f.clientCompanyId || undefined,
        code: f.code,
        title: f.title,
        sourceUrl: f.sourceUrl || undefined,
        activityCodes: this.csv(f.activityCodesText),
        specialtyCodes: this.csv(f.specialtyCodesText),
        mandatory: true,
        priority: 100,
      })
      .subscribe({
        next: () => this.done('Η ΣΣΕ καταχωρίστηκε. Προσθέστε την πρώτη έκδοση.'),
        error: (e) => this.fail(e),
      });
  }
  addVersion(a: CollectiveAgreement) {
    const label = prompt('Ονομασία έκδοσης');
    const from = prompt('Ισχύς από (YYYY-MM-DD)');
    const specialty = prompt('Κωδικός ειδικότητας');
    const salary = Number(prompt('Ελάχιστος μηνιαίος μισθός') || 0);
    if (!label || !from || !specialty || !salary) return;
    this.api
      .addAgreementVersion(a.id, {
        versionLabel: label,
        validFrom: from,
        weeklyHours: 40,
        wageRules: [
          {
            specialtyCode: specialty,
            specialtyTitle: specialty,
            minimumMonthlySalary: salary,
            allowanceRules: [],
          },
        ],
      })
      .subscribe({ next: () => this.done('Προστέθηκε η έκδοση ΣΣΕ.'), error: (e) => this.fail(e) });
  }
  action(
    type: 'annual' | 'vies' | 'intrastat',
    r: ComplianceReturn,
    action: 'ready' | 'submit' | 'lock',
  ) {
    const request =
      action === 'ready'
        ? this.api.ready(type, r.id)
        : action === 'lock'
          ? this.api.lock(type, r.id)
          : this.api.submit(type, r.id, prompt('Πρωτόκολλο υποβολής') || '');
    request.subscribe({
      next: () => this.done('Η κατάσταση ενημερώθηκε.'),
      error: (e) => this.fail(e),
    });
  }
  download(type: 'annual' | 'vies' | 'intrastat', r: ComplianceReturn) {
    this.api.file(type, r.id).subscribe({
      next: (b) => {
        const u = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href = u;
        a.download = `${type}-${r.id}.${type === 'annual' ? 'zip' : type === 'vies' ? 'xml' : 'txt'}`;
        a.click();
        URL.revokeObjectURL(u);
        this.reload();
      },
      error: (e) => this.fail(e),
    });
  }
  private csv(v: string) {
    return v
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  }
  private done(m: string) {
    this.message = m;
    this.error = '';
    this.reload();
  }
  private fail(e: unknown) {
    const failure = e as { error?: { message?: string | string[] }; message?: string };
    this.error = Array.isArray(failure.error?.message)
      ? failure.error.message.join(', ')
      : failure.error?.message || failure.message || 'Η ενέργεια απέτυχε.';
  }
}
