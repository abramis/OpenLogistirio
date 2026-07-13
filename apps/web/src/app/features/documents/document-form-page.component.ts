import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  ClientSetupItem,
  CompaniesApiService,
  ClientCompany,
} from '../../core/api/companies-api.service';
import { CounterpartiesApiService, Counterparty } from '../../core/api/counterparties-api.service';
import { DocumentsApiService } from '../../core/api/documents-api.service';

@Component({
  selector: 'ol-document-form-page',
  standalone: true,
  imports: [AsyncPipe, NgFor, NgIf, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Νέο παραστατικό</h1>
        <p class="page-subtitle">Δημιουργία παραστατικού για αποστολή στο AADE myDATA</p>
      </div>
      <a class="btn btn-secondary" routerLink="/documents">
        <span class="material-symbols-outlined">arrow_back</span>
        Πίσω
      </a>
    </section>

    <div class="notice-bar">
      <span class="material-symbols-outlined">info</span>
      Για test αποστολή AADE, επιλέξτε πελάτη του οποίου το ΑΦΜ αντιστοιχεί στα myDATA API
      credentials.
    </div>

    <form [formGroup]="form" (ngSubmit)="submit()" class="doc-form card">
      <div class="form-body">
        <label class="field wide">
          <span class="field-label">Εταιρεία / πελάτης <span class="req">*</span></span>
          <select formControlName="clientCompanyId">
            <option value="">Επιλέξτε εταιρεία…</option>
            <option *ngFor="let company of companies$ | async" [value]="company.id">
              {{ company.legalName }} — {{ company.vatNumber }}
            </option>
          </select>
          <span class="field-error" *ngIf="showError('clientCompanyId', 'required')"
            >Η εταιρεία είναι υποχρεωτική.</span
          >
        </label>

        <label class="field">
          <span class="field-label">Τύπος παραστατικού</span>
          <select formControlName="documentType">
            <option value="SALES_INVOICE">Τιμολόγιο πώλησης</option>
            <option value="PURCHASE_INVOICE">Τιμολόγιο αγοράς / δαπάνη</option>
            <option value="CREDIT_NOTE">Πιστωτικό</option>
            <option value="RETAIL_RECEIPT">Απόδειξη λιανικής</option>
          </select>
        </label>

        <label class="field">
          <span class="field-label">Κωδικός κίνησης</span>
          <select formControlName="movementCode">
            <option value="">Αυτόματη επιλογή</option>
            <option *ngFor="let item of movementCodeOptions" [value]="item.code">
              {{ item.name }}
            </option>
          </select>
        </label>

        <label class="field">
          <span class="field-label">Ημερολόγιο</span>
          <select formControlName="journalCode">
            <option value="">Αυτόματη επιλογή</option>
            <option *ngFor="let item of journalOptions" [value]="item.code">
              {{ item.name }}
            </option>
          </select>
        </label>

        <label class="field">
          <span class="field-label">Σειρά</span>
          <input formControlName="series" placeholder="π.χ. Α" />
        </label>

        <label class="field">
          <span class="field-label">Αριθμός <span class="req">*</span></span>
          <input formControlName="documentNumber" />
          <span class="field-error" *ngIf="showError('documentNumber', 'required')"
            >Ο αριθμός είναι υποχρεωτικός.</span
          >
        </label>

        <label class="field">
          <span class="field-label">Ημερομηνία έκδοσης <span class="req">*</span></span>
          <input formControlName="issueDate" type="date" />
          <span class="field-error" *ngIf="showError('issueDate', 'required')"
            >Η ημερομηνία είναι υποχρεωτική.</span
          >
        </label>

        <label class="field">
          <span class="field-label">Κατηγορία ΦΠΑ</span>
          <select formControlName="vatCategory">
            <option *ngFor="let item of vatSetupOptions" [value]="vatCategoryCode(item)">
              {{ item.name }}
            </option>
            <option value="VAT_0">0%</option>
            <option value="NO_VAT">Χωρίς ΦΠΑ</option>
          </select>
        </label>

        <label class="field" *ngIf="form.controls.vatCategory.value === 'VAT_0'">
          <span class="field-label">Αιτία απαλλαγής ΦΠΑ <span class="req">*</span></span>
          <select formControlName="vatExemptionCategory">
            <option [ngValue]="0">Επιλέξτε κωδικό ΑΑΔΕ…</option>
            <option *ngFor="let category of vatExemptionCategories" [ngValue]="category">
              {{ category }}
            </option>
          </select>
        </label>

        <label class="field">
          <span class="field-label">Τρόπος πληρωμής</span>
          <select formControlName="paymentMethodType">
            <option [ngValue]="1">1 — Επαγγ. λογαριασμός ημεδαπής</option>
            <option [ngValue]="2">2 — Επαγγ. λογαριασμός αλλοδαπής</option>
            <option [ngValue]="3">3 — Μετρητά</option>
            <option [ngValue]="4">4 — Επιταγή</option>
            <option [ngValue]="5">5 — Επί πιστώσει</option>
            <option [ngValue]="6">6 — Web Banking</option>
            <option [ngValue]="7">7 — POS / e-POS</option>
            <option [ngValue]="8">8 — Άμεση πληρωμή IRIS</option>
          </select>
        </label>

        <label class="field wide" *ngIf="form.controls.documentType.value === 'CREDIT_NOTE'">
          <span class="field-label">MARK αρχικού παραστατικού</span>
          <input
            formControlName="correlatedInvoiceMark"
            inputmode="numeric"
            placeholder="Κενό = μη συσχετιζόμενο πιστωτικό 5.2"
          />
          <small>Με MARK αποστέλλεται ως 5.1, χωρίς MARK ως 5.2.</small>
        </label>

        <label class="field">
          <span class="field-label">Master data αντισυμβαλλόμενου</span>
          <select formControlName="counterpartyId">
            <option value="">Χωρίς επιλογή / νέος</option>
            <option *ngFor="let counterparty of counterpartyOptions" [value]="counterparty.id">
              {{ counterparty.name }} — {{ counterparty.vatNumber || '-' }}
            </option>
          </select>
        </label>

        <label class="field">
          <span class="field-label">Ονομασία αντισυμβαλλόμενου</span>
          <input formControlName="counterpartyName" placeholder="Ονομασία αντισυμβαλλόμενου" />
        </label>

        <label class="field">
          <span class="field-label">ΑΦΜ αντισυμβαλλόμενου</span>
          <input
            formControlName="counterpartyVatNumber"
            inputmode="numeric"
            placeholder="9 ψηφία"
          />
        </label>

        <div class="counterparty-actions">
          <button class="btn btn-xs btn-secondary" type="button" (click)="saveCounterparty()">
            <span class="material-symbols-outlined">person_add</span>
            Αποθήκευση master data
          </button>
          <span *ngIf="counterpartyMessage">{{ counterpartyMessage }}</span>
        </div>

        <div class="amounts-section">
          <div class="amounts-row">
            <label class="field">
              <span class="field-label">Καθαρή αξία (€)</span>
              <input formControlName="netAmount" type="number" step="0.01" />
            </label>
            <label class="field">
              <span class="field-label">ΦΠΑ (€)</span>
              <input formControlName="vatAmount" type="number" step="0.01" />
            </label>
            <label class="field">
              <span class="field-label">Σύνολο (€)</span>
              <input formControlName="totalAmount" type="number" step="0.01" />
            </label>
          </div>

          <div class="vat-helpers">
            <span class="vat-helper-label">
              <span class="material-symbols-outlined">calculate</span>
              Αυτόματος υπολογισμός:
            </span>
            <button
              *ngFor="let item of vatSetupOptions"
              type="button"
              class="btn btn-xs btn-secondary"
              (click)="calculateVat(vatRate(item), vatCategoryCode(item))"
            >
              {{ vatRate(item) }}%
            </button>
            <button
              type="button"
              class="btn btn-xs btn-secondary"
              (click)="calculateVat(0, 'VAT_0')"
            >
              0%
            </button>
          </div>
        </div>

        <div class="taxes-section">
          <h2>Φόροι και κρατήσεις myDATA</h2>
          <p>Η κατηγορία είναι υποχρεωτική όταν υπάρχει αντίστοιχο ποσό.</p>
          <div class="taxes-grid">
            <label class="field">
              <span class="field-label">Παρακράτηση (€)</span>
              <input formControlName="withheldAmount" type="number" min="0" step="0.01" />
            </label>
            <label class="field">
              <span class="field-label">Κατηγορία παρακράτησης (1–18)</span>
              <input formControlName="withheldCategory" type="number" min="1" max="18" />
            </label>
            <label class="field">
              <span class="field-label">Τέλη (€)</span>
              <input formControlName="feesAmount" type="number" min="0" step="0.01" />
            </label>
            <label class="field">
              <span class="field-label">Κατηγορία τελών (1–22)</span>
              <input formControlName="feesCategory" type="number" min="1" max="22" />
            </label>
            <label class="field">
              <span class="field-label">Ψηφιακό τέλος συναλλαγής (€)</span>
              <input formControlName="stampDutyAmount" type="number" min="0" step="0.01" />
            </label>
            <label class="field">
              <span class="field-label">Κατηγορία ψηφιακού τέλους (1–4)</span>
              <input formControlName="stampDutyCategory" type="number" min="1" max="4" />
            </label>
            <label class="field">
              <span class="field-label">Λοιποί φόροι (€)</span>
              <input formControlName="otherTaxesAmount" type="number" min="0" step="0.01" />
            </label>
            <label class="field">
              <span class="field-label">Κατηγορία λοιπών φόρων (1–30)</span>
              <input formControlName="otherTaxesCategory" type="number" min="1" max="30" />
            </label>
            <label class="field">
              <span class="field-label">Κρατήσεις / αφαιρέσεις (€)</span>
              <input formControlName="deductionsAmount" type="number" min="0" step="0.01" />
            </label>
          </div>
        </div>
      </div>

      <div class="form-footer">
        <span class="form-submit-error" *ngIf="formMessage">{{ formMessage }}</span>
        <button type="submit" class="btn btn-primary">
          <span class="material-symbols-outlined">add_circle</span>
          Δημιουργία παραστατικού
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .notice-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border: 1px solid var(--inf-bd);
        border-radius: 8px;
        background: var(--inf-bg);
        color: var(--inf-t);
        font-size: 0.8125rem;
        margin-bottom: 16px;
      }
      .notice-bar .material-symbols-outlined {
        font-size: 16px;
      }

      .doc-form {
      }

      .form-body {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 14px 20px;
        padding: 20px 20px 0;
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
      .req {
        color: var(--err);
        margin-left: 2px;
      }
      .field-error {
        font-size: 0.75rem;
        color: var(--err);
      }
      .wide {
        grid-column: 1 / -1;
      }

      .amounts-section {
        grid-column: 1 / -1;
      }

      .taxes-section {
        grid-column: 1 / -1;
        padding-top: 8px;
        border-top: 1px solid var(--border);
      }
      .taxes-section h2 {
        margin: 0;
        font-size: 0.95rem;
      }
      .taxes-section p,
      .field small {
        margin: 3px 0 10px;
        color: var(--muted);
        font-size: 0.75rem;
      }
      .taxes-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 14px 20px;
      }

      .counterparty-actions {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--ok);
        font-size: 0.78rem;
        font-weight: 700;
      }

      .counterparty-actions .material-symbols-outlined {
        font-size: 15px;
      }

      .amounts-row {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 14px;
        margin-bottom: 10px;
      }

      .vat-helpers {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .vat-helper-label {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--muted);
      }
      .vat-helper-label .material-symbols-outlined {
        font-size: 15px;
      }

      .form-footer {
        display: flex;
        justify-content: flex-end;
        padding: 14px 20px 18px;
        border-top: 1px solid var(--border);
        margin-top: 16px;
        gap: 14px;
        align-items: center;
      }
      .form-submit-error {
        margin-right: auto;
        color: var(--err);
        font-size: 0.78rem;
        font-weight: 600;
      }

      @media (max-width: 720px) {
        .form-body {
          grid-template-columns: 1fr;
        }
        .amounts-row {
          grid-template-columns: 1fr;
        }
        .taxes-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class DocumentFormPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly counterpartiesApi = inject(CounterpartiesApiService);
  private readonly documentsApi = inject(DocumentsApiService);
  private readonly router = inject(Router);

  readonly companies$ = this.companiesApi.findAll();

  readonly form = this.formBuilder.nonNullable.group({
    clientCompanyId: ['', Validators.required],
    documentType: ['SALES_INVOICE', Validators.required],
    movementCode: [''],
    journalCode: [''],
    series: ['A'],
    documentNumber: ['', Validators.required],
    issueDate: ['', Validators.required],
    counterpartyId: [''],
    counterpartyName: [''],
    counterpartyVatNumber: [''],
    vatCategory: ['VAT_24', Validators.required],
    paymentMethodType: [3, [Validators.required, Validators.min(1), Validators.max(8)]],
    vatExemptionCategory: [0],
    correlatedInvoiceMark: [''],
    netAmount: [100, [Validators.required, Validators.min(0)]],
    vatAmount: [24, [Validators.required, Validators.min(0)]],
    totalAmount: [124, [Validators.required, Validators.min(0)]],
    withheldAmount: [0, Validators.min(0)],
    withheldCategory: [''],
    feesAmount: [0, Validators.min(0)],
    feesCategory: [''],
    stampDutyAmount: [0, Validators.min(0)],
    stampDutyCategory: [''],
    otherTaxesAmount: [0, Validators.min(0)],
    otherTaxesCategory: [''],
    deductionsAmount: [0, Validators.min(0)],
  });

  readonly vatExemptionCategories = Array.from({ length: 31 }, (_, index) => index + 1);

  ngOnInit(): void {
    this.form.controls.issueDate.setValue(new Date().toISOString().slice(0, 10));
    this.companies$.subscribe((companies: ClientCompany[]) => {
      if (!this.form.controls.clientCompanyId.value && companies[0]) {
        this.form.controls.clientCompanyId.setValue(companies[0].id);
      }
    });
    this.form.controls.clientCompanyId.valueChanges.subscribe((clientCompanyId) => {
      this.loadSetupOptions(clientCompanyId);
      this.loadCounterparties(clientCompanyId);
    });
    this.form.controls.documentType.valueChanges.subscribe((documentType) => {
      this.applyDefaultSetupOptions();
      if (documentType !== 'CREDIT_NOTE') {
        this.form.controls.correlatedInvoiceMark.setValue('');
      }
    });
    this.form.controls.vatCategory.valueChanges.subscribe((vatCategory) => {
      if (vatCategory !== 'VAT_0') {
        this.form.controls.vatExemptionCategory.setValue(0);
      }
    });
    [
      this.form.controls.netAmount,
      this.form.controls.vatAmount,
      this.form.controls.withheldAmount,
      this.form.controls.feesAmount,
      this.form.controls.stampDutyAmount,
      this.form.controls.otherTaxesAmount,
      this.form.controls.deductionsAmount,
    ].forEach((control) => control.valueChanges.subscribe(() => this.recalculateTotal()));
    this.form.controls.counterpartyId.valueChanges.subscribe((counterpartyId) => {
      this.applyCounterparty(counterpartyId);
    });
  }

  movementCodeOptions: ClientSetupItem[] = [];
  journalOptions: ClientSetupItem[] = [];
  vatSetupOptions: ClientSetupItem[] = [];
  counterpartyOptions: Counterparty[] = [];
  counterpartyMessage = '';
  formMessage = '';

  showError(controlName: keyof typeof this.form.controls, errorName: string): boolean {
    const control = this.form.controls[controlName];
    return control.hasError(errorName) && (control.dirty || control.touched);
  }

  calculateVat(rate: number, vatCategory: string): void {
    const net = Number(this.form.controls.netAmount.value);
    const vat = roundMoney(net * (rate / 100));
    this.form.patchValue({
      vatCategory,
      vatAmount: vat,
    });
    this.recalculateTotal();
  }

  submit(): void {
    this.formMessage = this.conditionalValidationMessage();
    if (this.formMessage) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formMessage = 'Έλεγξε τα υποχρεωτικά πεδία και τα επιτρεπτά όρια.';
      return;
    }

    const value = this.form.getRawValue();
    this.documentsApi
      .create({
        clientCompanyId: value.clientCompanyId,
        documentType: value.documentType,
        movementCode: emptyToUndefined(value.movementCode),
        journalCode: emptyToUndefined(value.journalCode),
        series: emptyToUndefined(value.series),
        documentNumber: value.documentNumber,
        issueDate: value.issueDate,
        counterpartyName: emptyToUndefined(value.counterpartyName),
        counterpartyVatNumber: emptyToUndefined(value.counterpartyVatNumber),
        netAmount: value.netAmount,
        vatAmount: value.vatAmount,
        totalAmount: value.totalAmount,
        vatCategory: value.vatCategory,
        paymentMethodType: value.paymentMethodType,
        vatExemptionCategory: positiveOrUndefined(value.vatExemptionCategory),
        correlatedInvoiceMark: emptyToUndefined(value.correlatedInvoiceMark),
        withheldAmount: value.withheldAmount,
        withheldCategory: positiveOrUndefined(value.withheldCategory),
        feesAmount: value.feesAmount,
        feesCategory: positiveOrUndefined(value.feesCategory),
        stampDutyAmount: value.stampDutyAmount,
        stampDutyCategory: positiveOrUndefined(value.stampDutyCategory),
        otherTaxesAmount: value.otherTaxesAmount,
        otherTaxesCategory: positiveOrUndefined(value.otherTaxesCategory),
        deductionsAmount: value.deductionsAmount,
      })
      .subscribe(() => {
        void this.router.navigate(['/documents']);
      });
  }

  saveCounterparty(): void {
    this.counterpartyMessage = '';
    const value = this.form.getRawValue();
    const name = value.counterpartyName.trim();
    if (!value.clientCompanyId || name.length < 2) {
      this.counterpartyMessage = 'Συμπλήρωσε πελάτη και ονομασία.';
      return;
    }

    this.counterpartiesApi
      .create({
        clientCompanyId: value.clientCompanyId,
        type: defaultCounterpartyType(value.documentType),
        name,
        vatNumber: emptyToUndefined(value.counterpartyVatNumber),
        country: 'GR',
      })
      .subscribe({
        next: (counterparty) => {
          this.counterpartyMessage = 'Αποθηκεύτηκε.';
          this.loadCounterparties(value.clientCompanyId, counterparty.id);
        },
        error: () => {
          this.counterpartyMessage = 'Δεν αποθηκεύτηκε.';
        },
      });
  }

  private loadSetupOptions(clientCompanyId: string): void {
    if (!clientCompanyId) {
      this.movementCodeOptions = [];
      this.journalOptions = [];
      this.vatSetupOptions = defaultVatSetupOptions();
      return;
    }

    this.companiesApi.findSetupItems(clientCompanyId).subscribe((items) => {
      this.movementCodeOptions = items.filter((item) => item.kind === 'MOVEMENT_CODE');
      this.journalOptions = items.filter((item) => item.kind === 'JOURNAL');
      this.vatSetupOptions = items.filter((item) => item.kind === 'VAT_SETUP');
      if (this.vatSetupOptions.length === 0) {
        this.vatSetupOptions = defaultVatSetupOptions();
      }
      this.applyDefaultSetupOptions();
    });
  }

  private loadCounterparties(clientCompanyId: string, selectedId = ''): void {
    this.counterpartyOptions = [];
    this.form.controls.counterpartyId.setValue('', { emitEvent: false });
    if (!clientCompanyId) {
      return;
    }

    this.counterpartiesApi.findAll({ clientCompanyId }).subscribe((counterparties) => {
      this.counterpartyOptions = counterparties;
      if (selectedId) {
        this.form.controls.counterpartyId.setValue(selectedId);
      }
    });
  }

  private applyCounterparty(counterpartyId: string): void {
    const counterparty = this.counterpartyOptions.find((item) => item.id === counterpartyId);
    if (!counterparty) {
      return;
    }

    this.form.patchValue(
      {
        counterpartyName: counterparty.name,
        counterpartyVatNumber: counterparty.vatNumber ?? '',
      },
      { emitEvent: false },
    );
  }

  private applyDefaultSetupOptions(): void {
    const documentType = this.form.controls.documentType.value;
    const movementCode = defaultMovementCode(documentType);
    const journalCode = defaultJournalCode(documentType);

    this.form.patchValue(
      {
        movementCode: this.hasSetupItem(this.movementCodeOptions, movementCode) ? movementCode : '',
        journalCode: this.hasSetupItem(this.journalOptions, journalCode) ? journalCode : '',
      },
      { emitEvent: false },
    );
  }

  private hasSetupItem(items: ClientSetupItem[], code: string): boolean {
    return items.some((item) => item.code === code);
  }

  vatRate(item: ClientSetupItem): number {
    return Number(item.metadata?.['rate'] ?? 0);
  }

  vatCategoryCode(item: ClientSetupItem): string {
    return `VAT_${this.vatRate(item)}`;
  }

  private recalculateTotal(): void {
    const value = this.form.getRawValue();
    this.form.controls.totalAmount.setValue(
      roundMoney(
        Number(value.netAmount) +
          Number(value.vatAmount) -
          Number(value.withheldAmount) +
          Number(value.feesAmount) +
          Number(value.stampDutyAmount) +
          Number(value.otherTaxesAmount) -
          Number(value.deductionsAmount),
      ),
      { emitEvent: false },
    );
  }

  private conditionalValidationMessage(): string {
    const value = this.form.getRawValue();
    if (value.vatCategory === 'VAT_0' && Number(value.vatExemptionCategory) <= 0) {
      return 'Επίλεξε αιτία απαλλαγής για συντελεστή ΦΠΑ 0%.';
    }

    const categorizedTaxes: Array<[string, number, number | string]> = [
      ['παρακράτησης', value.withheldAmount, value.withheldCategory],
      ['τελών', value.feesAmount, value.feesCategory],
      ['ψηφιακού τέλους', value.stampDutyAmount, value.stampDutyCategory],
      ['λοιπών φόρων', value.otherTaxesAmount, value.otherTaxesCategory],
    ];
    const missingCategory = categorizedTaxes.find(
      ([, amount, category]) => Number(amount) > 0 && Number(category) <= 0,
    );
    if (missingCategory) {
      return `Συμπλήρωσε κατηγορία ${missingCategory[0]}.`;
    }

    const correlationMark = value.correlatedInvoiceMark.trim();
    if (correlationMark && !/^\d+$/.test(correlationMark)) {
      return 'Το συσχετιζόμενο MARK πρέπει να περιέχει μόνο ψηφία.';
    }

    return '';
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function positiveOrUndefined(value: number | string): number | undefined {
  return Number(value) > 0 ? Number(value) : undefined;
}

function defaultMovementCode(documentType: string): string {
  const defaults: Record<string, string> = {
    SALES_INVOICE: 'SALE_INVOICE',
    PURCHASE_INVOICE: 'PURCHASE_INVOICE',
    CREDIT_NOTE: 'CREDIT_NOTE',
    RETAIL_RECEIPT: 'SALE_INVOICE',
  };

  return defaults[documentType] ?? 'SALE_INVOICE';
}

function defaultJournalCode(documentType: string): string {
  const defaults: Record<string, string> = {
    SALES_INVOICE: 'SALES',
    PURCHASE_INVOICE: 'PURCHASES',
    CREDIT_NOTE: 'SALES',
    RETAIL_RECEIPT: 'SALES',
  };

  return defaults[documentType] ?? 'SALES';
}

function defaultCounterpartyType(documentType: string): string {
  return documentType === 'PURCHASE_INVOICE' ? 'SUPPLIER' : 'CUSTOMER';
}

function defaultVatSetupOptions(): ClientSetupItem[] {
  return [
    {
      id: 'default-vat-24',
      clientCompanyId: '',
      kind: 'VAT_SETUP',
      code: 'VAT_NORMAL_24',
      name: 'Κανονικός συντελεστής ΦΠΑ 24%',
      metadata: { rate: 24 },
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'default-vat-13',
      clientCompanyId: '',
      kind: 'VAT_SETUP',
      code: 'VAT_REDUCED_13',
      name: 'Μειωμένος συντελεστής ΦΠΑ 13%',
      metadata: { rate: 13 },
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'default-vat-6',
      clientCompanyId: '',
      kind: 'VAT_SETUP',
      code: 'VAT_SUPER_REDUCED_6',
      name: 'Υπερμειωμένος συντελεστής ΦΠΑ 6%',
      metadata: { rate: 6 },
      createdAt: '',
      updatedAt: '',
    },
  ];
}
