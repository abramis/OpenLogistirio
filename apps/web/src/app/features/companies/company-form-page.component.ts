import { NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import {
  AadeRegistryCompanyLookup,
  CompaniesApiService,
  CompanyPayload,
} from '../../core/api/companies-api.service';

@Component({
  selector: 'ol-company-form-page',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">{{ companyId ? 'Επεξεργασία πελάτη' : 'Νέος πελάτης' }}</h1>
        <p class="page-subtitle">Φορολογικό προφίλ, βιβλία και ρύθμιση myDATA</p>
      </div>
      <a class="btn btn-secondary" routerLink="/companies">
        <span class="material-symbols-outlined">arrow_back</span>
        Πίσω στη λίστα
      </a>
    </section>

    <nav class="form-tabs" aria-label="Ενότητες πελάτη">
      <button
        type="button"
        class="tab-button"
        [class.active]="activeTab === 'identity'"
        (click)="setActiveTab('identity')"
      >
        <span class="material-symbols-outlined">badge</span>
        Ταυτότητα
      </button>
      <button
        type="button"
        class="tab-button"
        [class.active]="activeTab === 'tax'"
        (click)="setActiveTab('tax')"
      >
        <span class="material-symbols-outlined">account_balance</span>
        Φορολογικά
      </button>
      <button
        type="button"
        class="tab-button"
        [class.active]="activeTab === 'mydata'"
        (click)="setActiveTab('mydata')"
      >
        <span class="material-symbols-outlined">cloud_sync</span>
        myDATA
      </button>
      <button
        type="button"
        class="tab-button"
        [class.active]="activeTab === 'contact'"
        (click)="setActiveTab('contact')"
      >
        <span class="material-symbols-outlined">contact_mail</span>
        Επικοινωνία
      </button>
    </nav>

    <form [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
      <fieldset class="form-section" *ngIf="activeTab === 'identity'">
        <legend class="section-legend">
          <span class="material-symbols-outlined">badge</span>
          Ταυτότητα πελάτη
        </legend>
        <label class="field">
          <span class="field-label">Επωνυμία / Ονοματεπώνυμο <span class="req">*</span></span>
          <input formControlName="legalName" placeholder="π.χ. ΑΛΦΑ ΕΜΠΟΡΙΑ ΑΕ" />
          <span class="field-error" *ngIf="showError('legalName', 'required')"
            >Η επωνυμία είναι υποχρεωτική.</span
          >
        </label>
        <label class="field">
          <span class="field-label">Διακριτικός τίτλος</span>
          <input formControlName="tradeName" placeholder="Εμπορικό σήμα (προαιρετικό)" />
        </label>
        <label class="field">
          <span class="field-label">Τύπος πελάτη</span>
          <select formControlName="entityType">
            <option value="COMPANY">Εταιρεία</option>
            <option value="FREELANCER">Ελεύθερος επαγγελματίας</option>
            <option value="SOLE_PROPRIETOR">Ατομική επιχείρηση</option>
            <option value="NON_PROFIT">Μη κερδοσκοπικός φορέας</option>
            <option value="OTHER">Άλλο</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">Επάγγελμα / δραστηριότητα</span>
          <input formControlName="professionLabel" placeholder="π.χ. Μηχανικός, Ιατρός, Εμπόριο" />
        </label>
      </fieldset>

      <fieldset class="form-section" *ngIf="activeTab === 'tax'">
        <legend class="section-legend">
          <span class="material-symbols-outlined">account_balance</span>
          Φορολογικά στοιχεία
        </legend>
        <div class="field wide">
          <span class="field-label">ΑΦΜ <span class="req">*</span></span>
          <div class="lookup-row">
            <input formControlName="vatNumber" inputmode="numeric" placeholder="9 ψηφία" />
            <button
              type="button"
              class="btn btn-secondary lookup-button"
              [disabled]="form.controls.vatNumber.invalid || isLookingUpAade"
              (click)="lookupAadeRegistry()"
            >
              <span class="material-symbols-outlined">manage_search</span>
              {{ isLookingUpAade ? 'Ανάκτηση...' : 'Ανάκτηση από ΑΑΔΕ' }}
            </button>
          </div>
          <span class="field-error" *ngIf="showError('vatNumber', 'required')"
            >Το ΑΦΜ είναι υποχρεωτικό.</span
          >
          <span class="field-error" *ngIf="showError('vatNumber', 'pattern')"
            >Το ΑΦΜ πρέπει να έχει 9 ψηφία.</span
          >
          <span class="field-success" *ngIf="aadeLookupStatus">{{ aadeLookupStatus }}</span>
          <span class="field-error" *ngIf="aadeLookupError">{{ aadeLookupError }}</span>
        </div>
        <label class="field">
          <span class="field-label">ΔΟΥ</span>
          <input formControlName="taxOffice" placeholder="π.χ. Α΄ Αθηνών" />
        </label>
        <label class="field wide">
          <span class="field-label">ΚΑΔ</span>
          <input formControlName="activityCodesText" placeholder="π.χ. 69200000, 62010000" />
        </label>
        <label class="field">
          <span class="field-label">Καθεστώς ΦΠΑ</span>
          <select formControlName="vatRegime">
            <option value="">—</option>
            <option value="NORMAL">Κανονικό</option>
            <option value="EXEMPT">Απαλλασσόμενο</option>
            <option value="SMALL_BUSINESS">Μικρών επιχειρήσεων</option>
            <option value="ARTICLE_39">Άρθρο 39</option>
            <option value="INTRA_COMMUNITY">Ενδοκοινοτικές συναλλαγές</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">Κατηγορία βιβλίων</span>
          <select formControlName="accountingCategory">
            <option value="">—</option>
            <option value="SIMPLE_BOOKS">Απλογραφικά</option>
            <option value="DOUBLE_ENTRY">Διπλογραφικά</option>
            <option value="EXEMPT_BOOKS">Χωρίς τήρηση βιβλίων</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">Έναρξη φορολογικού έτους (μήνας)</span>
          <input formControlName="fiscalYearStart" type="number" min="1" max="12" />
          <span
            class="field-error"
            *ngIf="showError('fiscalYearStart', 'min') || showError('fiscalYearStart', 'max')"
          >
            Ο μήνας πρέπει να είναι από 1 έως 12.
          </span>
        </label>
        <label class="field">
          <span class="field-label">Λήξη φορολογικού έτους (μήνας)</span>
          <input formControlName="fiscalYearEnd" type="number" min="1" max="12" />
          <span
            class="field-error"
            *ngIf="showError('fiscalYearEnd', 'min') || showError('fiscalYearEnd', 'max')"
          >
            Ο μήνας πρέπει να είναι από 1 έως 12.
          </span>
        </label>
      </fieldset>

      <fieldset class="form-section" *ngIf="activeTab === 'mydata'">
        <legend class="section-legend">
          <span class="material-symbols-outlined">cloud_sync</span>
          Ρύθμιση AADE myDATA
        </legend>
        <label class="field wide">
          <span class="field-label">Τρόπος διαβίβασης</span>
          <select formControlName="myDataMode">
            <option value="ACCOUNTING_OFFICE_AUTHORIZED">
              Με τα myDATA API credentials του λογιστικού γραφείου
            </option>
            <option value="OWN_API_CREDENTIALS_ENV_REF">
              Με ξεχωριστά API credentials του πελάτη
            </option>
            <option value="MANUAL_UPLOAD">Χειροκίνητη αποστολή / ανέβασμα</option>
            <option value="NOT_CONFIGURED">Δεν έχει ρυθμιστεί</option>
          </select>
        </label>
        <label class="field wide toggle-field" *ngIf="isOfficeAuthorizedMode()">
          <input formControlName="myDataAuthorized" type="checkbox" class="toggle-input" />
          <span>Υπάρχει εξουσιοδότηση για "Διαχείριση Ηλεκτρονικών Βιβλίων"</span>
        </label>
        <label class="field" *ngIf="isOwnApiCredentialsMode()">
          <span class="field-label">Κωδικός αναφοράς credentials <span class="req">*</span></span>
          <input formControlName="myDataCredentialRef" placeholder="π.χ. CLIENT_111222333" />
          <span class="field-error" *ngIf="showError('myDataCredentialRef', 'required')">
            Ο κωδικός αναφοράς είναι υποχρεωτικός για ξεχωριστά credentials πελάτη.
          </span>
          <span class="field-error" *ngIf="showError('myDataCredentialRef', 'pattern')">
            Χρησιμοποιήστε μόνο κεφαλαία λατινικά, αριθμούς και κάτω παύλα.
          </span>
        </label>
        <p class="field-note wide" *ngIf="isOwnApiCredentialsMode()">
          <span class="material-symbols-outlined">admin_panel_settings</span>
          Το πεδίο αυτό συμπληρώνεται από τον διαχειριστή του συστήματος. Παράδειγμα:
          CLIENT_111222333, με αντίστοιχα credentials φυλαγμένα μόνο στο .env του server.
        </p>
        <p class="field-note wide">
          <span class="material-symbols-outlined">info</span>
          Δεν αποθηκεύονται TAXISnet κωδικοί ή πραγματικά subscription keys στη βάση.
        </p>
      </fieldset>

      <fieldset class="form-section" *ngIf="activeTab === 'contact'">
        <legend class="section-legend">
          <span class="material-symbols-outlined">contact_mail</span>
          Επικοινωνία
        </legend>
        <label class="field wide">
          <span class="field-label">Διεύθυνση</span>
          <input formControlName="address" placeholder="Οδός, αριθμός, πόλη, ΤΚ" />
        </label>
        <label class="field">
          <span class="field-label">Email</span>
          <input formControlName="email" type="email" placeholder="info@example.gr" />
          <span class="field-error" *ngIf="showError('email', 'email')"
            >Πληκτρολογήστε έγκυρο email.</span
          >
        </label>
        <label class="field">
          <span class="field-label">Τηλέφωνο</span>
          <input formControlName="phone" placeholder="210 0000000" />
        </label>
      </fieldset>

      <div class="form-footer">
        <button type="submit" class="btn btn-primary">
          <span class="material-symbols-outlined">{{ companyId ? 'save' : 'add_circle' }}</span>
          {{ companyId ? 'Αποθήκευση αλλαγών' : 'Δημιουργία πελάτη' }}
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .form-grid {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .form-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 16px;
        border-bottom: 1px solid var(--border);
      }

      .tab-button {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-height: 40px;
        margin: 0 0 -1px;
        border: 1px solid transparent;
        border-bottom-color: var(--border);
        background: transparent;
        color: var(--text-2);
        padding: 0 12px;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      .tab-button.active {
        border-color: var(--border);
        border-bottom-color: var(--surface);
        border-radius: 8px 8px 0 0;
        background: var(--surface);
        color: var(--primary);
      }
      .tab-button .material-symbols-outlined {
        font-size: 18px;
      }

      .form-section {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 14px 20px;
        margin: 0;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface);
        padding: 0 20px 20px;
        box-shadow: var(--shadow-sm);
      }

      .section-legend {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 14px 0 4px;
        font-size: 0.875rem;
        font-weight: 700;
        color: var(--text);
        width: 100%;
        float: left;
        margin-bottom: 6px;
      }
      .section-legend .material-symbols-outlined {
        font-size: 17px;
        color: var(--primary);
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
      .field-success {
        font-size: 0.75rem;
        color: var(--ok);
      }

      .lookup-row {
        display: grid;
        grid-template-columns: minmax(160px, 1fr) auto;
        gap: 8px;
        align-items: start;
      }
      .lookup-button {
        min-height: 42px;
        white-space: nowrap;
      }

      .field-note {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 4px 0 0;
        font-size: 0.8125rem;
        color: var(--muted);
        align-self: end;
      }
      .field-note .material-symbols-outlined {
        font-size: 15px;
        color: var(--muted-2);
      }

      .wide {
        grid-column: 1 / -1;
      }

      .toggle-field {
        flex-direction: row;
        align-items: center;
        gap: 10px;
        font-size: 0.875rem;
        color: var(--text-2);
        font-weight: 500;
      }
      .toggle-input {
        width: 16px;
        min-height: 16px;
        flex-shrink: 0;
        accent-color: var(--primary);
        cursor: pointer;
      }

      .form-footer {
        display: flex;
        justify-content: flex-end;
        padding-top: 4px;
      }

      @media (max-width: 720px) {
        .form-section {
          grid-template-columns: 1fr;
        }

        .lookup-row {
          grid-template-columns: 1fr;
        }

        .lookup-button {
          width: 100%;
          justify-content: center;
        }
      }
    `,
  ],
})
export class CompanyFormPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly companiesApi = inject(CompaniesApiService);

  companyId: string | null = null;
  activeTab: 'identity' | 'tax' | 'mydata' | 'contact' = 'identity';
  isLookingUpAade = false;
  aadeLookupStatus = '';
  aadeLookupError = '';

  readonly form = this.formBuilder.nonNullable.group({
    legalName: ['', [Validators.required, Validators.minLength(2)]],
    tradeName: [''],
    entityType: ['COMPANY'],
    professionLabel: [''],
    vatNumber: ['', [Validators.required, Validators.pattern(/^\d{9}$/)]],
    taxOffice: [''],
    activityCodesText: [''],
    address: [''],
    email: ['', [Validators.email]],
    phone: [''],
    vatRegime: [''],
    accountingCategory: [''],
    myDataMode: ['ACCOUNTING_OFFICE_AUTHORIZED'],
    myDataAuthorized: [false],
    myDataCredentialRef: ['', [Validators.pattern(/^[A-Z0-9_]*$/)]],
    fiscalYearStart: [1, [Validators.min(1), Validators.max(12)]],
    fiscalYearEnd: [12, [Validators.min(1), Validators.max(12)]],
  });

  ngOnInit(): void {
    this.companyId = this.route.snapshot.paramMap.get('id');
    this.updateMyDataCredentialValidators();
    this.form.controls.myDataMode.valueChanges.subscribe(() => {
      this.updateMyDataCredentialValidators();
    });

    if (this.companyId) {
      this.companiesApi.findOne(this.companyId).subscribe((company) => {
        this.form.patchValue({
          legalName: company.legalName,
          tradeName: company.tradeName ?? '',
          entityType: company.entityType,
          professionLabel: company.professionLabel ?? '',
          vatNumber: company.vatNumber,
          taxOffice: company.taxOffice ?? '',
          activityCodesText: company.activityCodes?.join(', ') ?? '',
          address: company.address ?? '',
          email: company.email ?? '',
          phone: company.phone ?? '',
          vatRegime: company.vatRegime ?? '',
          accountingCategory: company.accountingCategory ?? '',
          myDataMode: company.myDataMode,
          myDataAuthorized: company.myDataAuthorized,
          myDataCredentialRef: company.myDataCredentialRef ?? '',
          fiscalYearStart: company.fiscalYearStart,
          fiscalYearEnd: company.fiscalYearEnd,
        });
      });
    }
  }

  showError(controlName: keyof typeof this.form.controls, errorName: string): boolean {
    const control = this.form.controls[controlName];
    return control.hasError(errorName) && (control.dirty || control.touched);
  }

  setActiveTab(tab: typeof this.activeTab): void {
    this.activeTab = tab;
  }

  isOfficeAuthorizedMode(): boolean {
    return this.form.controls.myDataMode.value === 'ACCOUNTING_OFFICE_AUTHORIZED';
  }

  isOwnApiCredentialsMode(): boolean {
    return this.form.controls.myDataMode.value === 'OWN_API_CREDENTIALS_ENV_REF';
  }

  lookupAadeRegistry(): void {
    const vatNumberControl = this.form.controls.vatNumber;
    vatNumberControl.markAsTouched();
    this.aadeLookupStatus = '';
    this.aadeLookupError = '';

    if (vatNumberControl.invalid) {
      return;
    }

    this.isLookingUpAade = true;
    this.companiesApi
      .lookupAadeRegistry(vatNumberControl.value)
      .pipe(finalize(() => (this.isLookingUpAade = false)))
      .subscribe({
        next: (lookup) => {
          this.applyAadeLookup(lookup);
          this.aadeLookupStatus = 'Συμπληρώθηκαν τα βασικά στοιχεία από ΑΑΔΕ.';
        },
        error: (error: { error?: { message?: string | string[] }; message?: string }) => {
          const message = error.error?.message ?? error.message;
          this.aadeLookupError = Array.isArray(message)
            ? message.join(', ')
            : (message ?? 'Δεν ολοκληρώθηκε η ανάκτηση από ΑΑΔΕ.');
        },
      });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.toPayload();
    const request$ = this.companyId
      ? this.companiesApi.update(this.companyId, payload)
      : this.companiesApi.create(payload);

    request$.subscribe((company) => {
      void this.router.navigate(['/companies', company.id]);
    });
  }

  private toPayload(): CompanyPayload {
    const value = this.form.getRawValue();

    return {
      legalName: value.legalName,
      tradeName: emptyToUndefined(value.tradeName),
      entityType: value.entityType,
      professionLabel: emptyToUndefined(value.professionLabel),
      vatNumber: value.vatNumber,
      taxOffice: emptyToUndefined(value.taxOffice),
      activityCodes: value.activityCodesText
        .split(',')
        .map((code) => code.trim())
        .filter(Boolean),
      address: emptyToUndefined(value.address),
      email: emptyToUndefined(value.email),
      phone: emptyToUndefined(value.phone),
      vatRegime: emptyToUndefined(value.vatRegime),
      accountingCategory: emptyToUndefined(value.accountingCategory),
      myDataMode: value.myDataMode,
      myDataAuthorized:
        value.myDataMode === 'ACCOUNTING_OFFICE_AUTHORIZED' ? value.myDataAuthorized : false,
      myDataCredentialRef:
        value.myDataMode === 'OWN_API_CREDENTIALS_ENV_REF'
          ? emptyToUndefined(value.myDataCredentialRef)
          : undefined,
      fiscalYearStart: value.fiscalYearStart,
      fiscalYearEnd: value.fiscalYearEnd,
    };
  }

  private updateMyDataCredentialValidators(): void {
    const credentialRefControl = this.form.controls.myDataCredentialRef;

    if (this.isOwnApiCredentialsMode()) {
      credentialRefControl.setValidators([
        Validators.required,
        Validators.pattern(/^[A-Z0-9_]+$/),
      ]);
    } else {
      credentialRefControl.setValidators([Validators.pattern(/^[A-Z0-9_]*$/)]);
      credentialRefControl.setValue('', { emitEvent: false });
    }

    credentialRefControl.updateValueAndValidity({ emitEvent: false });
  }

  private applyAadeLookup(lookup: AadeRegistryCompanyLookup): void {
    this.form.patchValue({
      legalName: lookup.legalName ?? this.form.controls.legalName.value,
      tradeName: lookup.tradeName ?? this.form.controls.tradeName.value,
      entityType: lookup.entityType ?? this.form.controls.entityType.value,
      professionLabel: lookup.professionLabel ?? this.form.controls.professionLabel.value,
      vatNumber: lookup.vatNumber,
      taxOffice: lookup.taxOffice ?? this.form.controls.taxOffice.value,
      activityCodesText:
        lookup.activityCodes.length > 0
          ? lookup.activityCodes.join(', ')
          : this.form.controls.activityCodesText.value,
      address: lookup.address ?? this.form.controls.address.value,
      vatRegime: lookup.vatRegime ?? this.form.controls.vatRegime.value,
    });
  }
}

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
