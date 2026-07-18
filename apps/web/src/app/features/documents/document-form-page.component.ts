import { AsyncPipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
  imports: [AsyncPipe, DecimalPipe, NgFor, NgIf, ReactiveFormsModule, RouterLink],
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
        <section class="form-section document-basics">
          <div class="section-heading">
            <div>
              <h2>1. Στοιχεία παραστατικού</h2>
              <p>Πελάτης, τύπος, αρίθμηση και φορολογική βάση.</p>
            </div>
          </div>
          <div class="form-section-grid">
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

            <label class="field wide" *ngIf="form.controls.documentType.value === 'CREDIT_NOTE'">
              <span class="field-label">MARK αρχικού παραστατικού</span>
              <input
                formControlName="correlatedInvoiceMark"
                inputmode="numeric"
                placeholder="Κενό = μη συσχετιζόμενο πιστωτικό 5.2"
              />
              <small>Με MARK αποστέλλεται ως 5.1, χωρίς MARK ως 5.2.</small>
            </label>
          </div>
        </section>

        <section class="form-section counterparty-section">
          <div class="section-heading">
            <div>
              <h2>2. Αντισυμβαλλόμενος</h2>
              <p>Επιλογή από master data ή γρήγορη καταχώριση νέου.</p>
            </div>
          </div>
          <div class="form-section-grid counterparty-grid">
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
          </div>
        </section>

        <section class="lines-section">
          <div class="section-heading">
            <div>
              <h2>3. Γραμμές παραστατικού</h2>
              <p>Κάθε γραμμή έχει δικό της ΦΠΑ και αποστέλλεται χωριστά στο myDATA.</p>
            </div>
            <button class="btn btn-xs btn-secondary" type="button" (click)="addLine()">
              <span class="material-symbols-outlined">add</span>
              Προσθήκη γραμμής
            </button>
          </div>
          <div class="document-lines" formArrayName="lines">
            <div
              class="document-line"
              *ngFor="let line of lineControls; let index = index"
              [formGroupName]="index"
            >
              <div class="line-number">{{ index + 1 }}</div>
              <label class="field line-description">
                <span class="field-label">Περιγραφή</span>
                <input formControlName="description" placeholder="Περιγραφή είδους ή υπηρεσίας" />
              </label>
              <label class="field">
                <span class="field-label">Κωδικός είδους</span>
                <input formControlName="itemCode" placeholder="π.χ. CONSULTING" />
              </label>
              <label class="field">
                <span class="field-label">Ποσότητα</span>
                <input formControlName="quantity" type="number" min="0.001" step="0.001" />
              </label>
              <label class="field">
                <span class="field-label">Μονάδα</span>
                <select formControlName="measurementUnit">
                  <option [ngValue]="0">—</option>
                  <option [ngValue]="1">1 — Τεμάχια</option>
                  <option [ngValue]="2">2 — Κιλά</option>
                  <option [ngValue]="3">3 — Λίτρα</option>
                  <option [ngValue]="4">4 — Μέτρα</option>
                  <option [ngValue]="7">7 — Υπηρεσία</option>
                </select>
              </label>
              <label class="field">
                <span class="field-label">Καθαρή αξία (€)</span>
                <input formControlName="netAmount" type="number" min="0" step="0.01" />
              </label>
              <label class="field">
                <span class="field-label">ΦΠΑ</span>
                <select formControlName="vatCategory">
                  <option value="VAT_24">24%</option>
                  <option value="VAT_13">13%</option>
                  <option value="VAT_6">6%</option>
                  <option value="VAT_0">0%</option>
                  <option value="NO_VAT">Χωρίς ΦΠΑ</option>
                </select>
              </label>
              <label class="field">
                <span class="field-label">Ποσό ΦΠΑ (€)</span>
                <input formControlName="vatAmount" type="number" min="0" step="0.01" />
              </label>
              <details class="line-advanced">
                <summary>Χαρακτηρισμοί, έκπτωση και φόροι γραμμής</summary>
                <div class="line-advanced-fields">
                  <label class="field"
                    ><span class="field-label">Τιμή μονάδας (€)</span
                    ><input formControlName="unitPrice" type="number" min="0" step="0.01"
                  /></label>
                  <label class="field"
                    ><span class="field-label">Έκπτωση (€)</span
                    ><input formControlName="discountAmount" type="number" min="0" step="0.01"
                  /></label>
                  <label class="field checkbox-field"
                    ><input formControlName="discountOption" type="checkbox" />
                    <span class="field-label">Έκπτωση ανά γραμμή</span></label
                  >
                  <label class="field"
                    ><span class="field-label">Απαλλαγή ΦΠΑ</span
                    ><select formControlName="vatExemptionCategory">
                      <option [ngValue]="0">—</option>
                      <option *ngFor="let category of vatExemptionCategories" [ngValue]="category">
                        {{ category }}
                      </option>
                    </select></label
                  >
                  <label class="field"
                    ><span class="field-label">Έσοδο type</span
                    ><input formControlName="incomeClassificationType" placeholder="E3_..."
                  /></label>
                  <label class="field"
                    ><span class="field-label">Έσοδο category</span
                    ><input
                      formControlName="incomeClassificationCategory"
                      placeholder="category1_..."
                  /></label>
                  <label class="field"
                    ><span class="field-label">Έξοδο type</span
                    ><input formControlName="expenseClassificationType" placeholder="E3_..."
                  /></label>
                  <label class="field"
                    ><span class="field-label">Έξοδο category</span
                    ><input
                      formControlName="expenseClassificationCategory"
                      placeholder="category2_..."
                  /></label>
                  <label class="field"
                    ><span class="field-label">VAT classification</span
                    ><input formControlName="vatClassificationType" placeholder="VAT_361"
                  /></label>
                  <label class="field"
                    ><span class="field-label">Παρακράτηση (€)</span
                    ><input formControlName="withheldAmount" type="number" min="0" step="0.01"
                  /></label>
                  <label class="field"
                    ><span class="field-label">Κατηγορία παρακράτησης</span
                    ><input formControlName="withheldCategory" type="number" min="1" max="18"
                  /></label>
                  <label class="field"
                    ><span class="field-label">Τέλη (€)</span
                    ><input formControlName="feesAmount" type="number" min="0" step="0.01"
                  /></label>
                  <label class="field"
                    ><span class="field-label">Κατηγορία τελών</span
                    ><input formControlName="feesCategory" type="number" min="1" max="22"
                  /></label>
                  <label class="field"
                    ><span class="field-label">Ψηφιακό τέλος (€)</span
                    ><input formControlName="stampDutyAmount" type="number" min="0" step="0.01"
                  /></label>
                  <label class="field"
                    ><span class="field-label">Κατηγορία ψηφιακού τέλους</span
                    ><input formControlName="stampDutyCategory" type="number" min="1" max="4"
                  /></label>
                  <label class="field"
                    ><span class="field-label">Λοιποί φόροι (€)</span
                    ><input formControlName="otherTaxesAmount" type="number" min="0" step="0.01"
                  /></label>
                  <label class="field"
                    ><span class="field-label">Κατηγορία λοιπών φόρων</span
                    ><input formControlName="otherTaxesCategory" type="number" min="1" max="30"
                  /></label>
                  <label class="field"
                    ><span class="field-label">Κρατήσεις / αφαιρέσεις (€)</span
                    ><input formControlName="deductionsAmount" type="number" min="0" step="0.01"
                  /></label>
                </div>
              </details>
              <button
                class="btn btn-xs btn-danger remove-line"
                type="button"
                (click)="removeLine(index)"
                [disabled]="lineControls.length === 1"
                aria-label="Αφαίρεση γραμμής"
              >
                <span class="material-symbols-outlined">delete</span>
              </button>
            </div>
          </div>
        </section>

        <div class="amounts-section">
          <div class="section-heading amounts-heading">
            <div>
              <h2>4. Σύνολα παραστατικού</h2>
              <p>Έλεγχος καθαρής αξίας, ΦΠΑ και τελικού ποσού.</p>
            </div>
          </div>
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

        <section class="payments-section">
          <div class="section-heading">
            <div>
              <h2>5. Τρόποι πληρωμής</h2>
              <p>Το άθροισμα των πληρωμών πρέπει να ισούται με το σύνολο του παραστατικού.</p>
            </div>
            <button class="btn btn-xs btn-secondary" type="button" (click)="addPayment()">
              <span class="material-symbols-outlined">add</span>
              Προσθήκη πληρωμής
            </button>
          </div>
          <div class="document-payments" formArrayName="payments">
            <div
              class="document-payment"
              *ngFor="let payment of paymentControls; let index = index"
              [formGroupName]="index"
            >
              <label class="field"
                ><span class="field-label">Τρόπος</span
                ><select formControlName="type">
                  <option [ngValue]="1">1 — Λογαριασμός ημεδαπής</option>
                  <option [ngValue]="2">2 — Λογαριασμός αλλοδαπής</option>
                  <option [ngValue]="3">3 — Μετρητά</option>
                  <option [ngValue]="4">4 — Επιταγή</option>
                  <option [ngValue]="5">5 — Επί πιστώσει</option>
                  <option [ngValue]="6">6 — Web Banking</option>
                  <option [ngValue]="7">7 — POS / e-POS</option>
                  <option [ngValue]="8">8 — IRIS</option>
                </select></label
              >
              <label class="field"
                ><span class="field-label">Ποσό (€)</span
                ><input formControlName="amount" type="number" min="0" step="0.01"
              /></label>
              <label class="field"
                ><span class="field-label">Πληροφορίες</span
                ><input formControlName="paymentMethodInfo" placeholder="π.χ. POS front desk"
              /></label>
              <details class="payment-advanced disclosure">
                <summary>Στοιχεία POS / ECR / παρόχου</summary>
                <div class="payment-advanced-fields">
                  <label class="field"
                    ><span class="field-label">transactionId</span
                    ><input formControlName="transactionId"
                  /></label>
                  <label class="field"
                    ><span class="field-label">TID</span><input formControlName="tid"
                  /></label>
                  <label class="field"
                    ><span class="field-label">Provider signing author</span
                    ><input formControlName="providerSigningAuthor" placeholder="Πάροχος POS"
                  /></label>
                  <label class="field"
                    ><span class="field-label">Provider signature</span
                    ><input formControlName="providerSignature" placeholder="Υπογραφή παρόχου"
                  /></label>
                  <label class="field"
                    ><span class="field-label">ECR signing author</span
                    ><input formControlName="ecrSigningAuthor" placeholder="ECR / ταμειακή"
                  /></label>
                  <label class="field"
                    ><span class="field-label">ECR session (6 ψηφία)</span
                    ><input formControlName="ecrSessionNumber" inputmode="numeric" maxlength="6"
                  /></label>
                </div>
              </details>
              <button
                class="btn btn-xs btn-danger remove-payment"
                type="button"
                (click)="removePayment(index)"
                [disabled]="paymentControls.length === 1"
                aria-label="Αφαίρεση πληρωμής"
              >
                <span class="material-symbols-outlined">delete</span>
              </button>
            </div>
          </div>
          <div
            class="payment-balance"
            [class.payment-balance-ok]="paymentDifference() === 0"
            [class.payment-balance-error]="paymentDifference() !== 0"
          >
            <span class="material-symbols-outlined">{{
              paymentDifference() === 0 ? 'check_circle' : 'error'
            }}</span>
            Πληρωμές: {{ paymentTotal() | number: '1.2-2' }} € · Σύνολο:
            {{ form.controls.totalAmount.value | number: '1.2-2' }} €
            <strong *ngIf="paymentDifference() !== 0">
              · Διαφορά: {{ paymentDifference() | number: '1.2-2' }} €</strong
            >
          </div>
        </section>

        <details class="taxes-section disclosure">
          <summary>
            <span>
              <strong>6. Πρόσθετοι φόροι και κρατήσεις myDATA</strong>
              <small
                >Ανοίξτε μόνο όταν το παραστατικό έχει παρακράτηση, τέλη ή λοιπούς φόρους.</small
              >
            </span>
          </summary>
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
        </details>
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

      .form-body {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px 20px;
        padding: 20px;
      }

      .form-section {
        grid-column: 1 / -1;
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

      .section-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
      }
      .section-heading h2 {
        margin: 0;
        font-size: 0.95rem;
      }
      .section-heading p {
        margin: 3px 0 0;
        color: var(--muted);
        font-size: 0.75rem;
      }
      .document-lines {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .document-line {
        display: grid;
        grid-template-columns: 26px minmax(170px, 2fr) repeat(6, minmax(90px, 1fr)) 32px;
        gap: 10px;
        align-items: end;
        padding: 10px;
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        background: var(--surface);
      }
      .line-number {
        align-self: center;
        font-weight: 700;
        color: var(--muted);
        text-align: center;
      }
      .remove-line {
        height: 34px;
        padding: 0;
        justify-content: center;
      }
      .line-advanced {
        grid-column: 2 / -1;
        padding-top: 2px;
      }
      .line-advanced summary {
        cursor: pointer;
        color: var(--primary);
        font-size: 0.78rem;
        font-weight: 700;
      }
      .line-advanced-fields {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 10px;
      }
      .checkbox-field {
        flex-direction: row;
        align-items: center;
        padding-top: 21px;
      }
      .checkbox-field input {
        width: auto;
      }

      .document-payments {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .document-payment {
        display: grid;
        grid-template-columns: minmax(190px, 1.1fr) minmax(120px, 0.55fr) minmax(210px, 1fr) 32px;
        gap: 10px;
        align-items: end;
        padding: 10px;
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        background: var(--surface);
      }
      .remove-payment {
        grid-column: -2 / -1;
        grid-row: 1;
        height: 34px;
        padding: 0;
        justify-content: center;
      }
      .payment-balance {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 10px;
        padding: 8px 10px;
        border-radius: 6px;
        font-size: 0.78rem;
        font-weight: 600;
      }
      .payment-balance .material-symbols-outlined {
        font-size: 17px;
      }
      .payment-balance-ok {
        color: var(--ok);
        background: var(--ok-bg);
      }
      .payment-balance-error {
        color: var(--err);
        background: var(--err-bg);
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
        padding: 16px;
        background: var(--surface);
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
        background: var(--surface-2);
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
        .document-line {
          grid-template-columns: 26px 1fr;
        }
        .line-description {
          grid-column: 2;
        }
        .line-advanced {
          grid-column: 2;
        }
        .line-advanced-fields {
          grid-template-columns: 1fr;
        }
        .remove-line {
          grid-column: 2;
        }
        .document-payment {
          grid-template-columns: 1fr;
        }
        .remove-payment,
        .payment-advanced {
          grid-column: 1;
          grid-row: auto;
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
  private readonly route = inject(ActivatedRoute);

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
    replacesDocumentId: [''],
    correctsDocumentId: [''],
    lines: this.formBuilder.array([this.createLine()]),
    payments: this.formBuilder.array([this.createPayment()]),
  });

  readonly vatExemptionCategories = Array.from({ length: 31 }, (_, index) => index + 1);

  get lineControls() {
    return this.form.controls.lines.controls;
  }

  get paymentControls() {
    return this.form.controls.payments.controls;
  }

  ngOnInit(): void {
    this.form.controls.issueDate.setValue(new Date().toISOString().slice(0, 10));
    this.route.queryParamMap.subscribe((params) => {
      const replacesDocumentId = params.get('replaces') ?? '';
      const correctsDocumentId = params.get('corrects') ?? '';
      this.form.controls.replacesDocumentId.setValue(replacesDocumentId);
      this.form.controls.correctsDocumentId.setValue(correctsDocumentId);
      if (correctsDocumentId) {
        this.form.controls.documentType.setValue('CREDIT_NOTE');
      }
    });
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
      this.lineControls[0]?.controls.vatCategory.setValue(vatCategory, { emitEvent: false });
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
    this.watchLine(this.lineControls[0]);
    this.watchPayment(this.paymentControls[0]);
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
    const line = this.lineControls[0];
    if (!line) return;
    const net = Number(line.controls.netAmount.value);
    const vat = roundMoney(net * (rate / 100));
    line.patchValue({ vatCategory, vatAmount: vat });
    this.form.controls.vatCategory.setValue(vatCategory, { emitEvent: false });
    this.recalculateTotal();
  }

  addLine(): void {
    const line = this.createLine();
    this.form.controls.lines.push(line);
    this.watchLine(line);
  }

  removeLine(index: number): void {
    if (this.lineControls.length > 1) {
      this.form.controls.lines.removeAt(index);
      this.recalculateTotal();
    }
  }

  addPayment(): void {
    const payment = this.createPayment(0);
    this.form.controls.payments.push(payment);
    this.watchPayment(payment);
  }

  removePayment(index: number): void {
    if (this.paymentControls.length > 1) {
      this.form.controls.payments.removeAt(index);
    }
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
    const lines = value.lines.map((line, index) => ({
      description: emptyToUndefined(line.description),
      itemCode: emptyToUndefined(line.itemCode),
      quantity: positiveOrUndefined(line.quantity),
      measurementUnit: positiveOrUndefined(line.measurementUnit),
      unitPrice: positiveOrUndefined(line.unitPrice),
      discountAmount: positiveOrUndefined(line.discountAmount),
      discountOption: line.discountOption || undefined,
      netAmount: Number(line.netAmount),
      vatAmount: Number(line.vatAmount),
      vatCategory: line.vatCategory,
      vatExemptionCategory:
        line.vatCategory === 'VAT_0'
          ? (positiveOrUndefined(line.vatExemptionCategory) ??
            (index === 0 ? positiveOrUndefined(value.vatExemptionCategory) : undefined))
          : undefined,
      withheldAmount: lineTaxValue(line.withheldAmount, value.withheldAmount, index),
      withheldCategory:
        positiveOrUndefined(line.withheldCategory) ??
        (index === 0 ? positiveOrUndefined(value.withheldCategory) : undefined),
      feesAmount: lineTaxValue(line.feesAmount, value.feesAmount, index),
      feesCategory:
        positiveOrUndefined(line.feesCategory) ??
        (index === 0 ? positiveOrUndefined(value.feesCategory) : undefined),
      stampDutyAmount: lineTaxValue(line.stampDutyAmount, value.stampDutyAmount, index),
      stampDutyCategory:
        positiveOrUndefined(line.stampDutyCategory) ??
        (index === 0 ? positiveOrUndefined(value.stampDutyCategory) : undefined),
      otherTaxesAmount: lineTaxValue(line.otherTaxesAmount, value.otherTaxesAmount, index),
      otherTaxesCategory:
        positiveOrUndefined(line.otherTaxesCategory) ??
        (index === 0 ? positiveOrUndefined(value.otherTaxesCategory) : undefined),
      deductionsAmount: lineTaxValue(line.deductionsAmount, value.deductionsAmount, index),
      incomeClassificationType: emptyToUndefined(line.incomeClassificationType),
      incomeClassificationCategory: emptyToUndefined(line.incomeClassificationCategory),
      expenseClassificationType: emptyToUndefined(line.expenseClassificationType),
      expenseClassificationCategory: emptyToUndefined(line.expenseClassificationCategory),
      vatClassificationType: emptyToUndefined(line.vatClassificationType),
    }));
    const payments = value.payments.map((payment) => ({
      type: Number(payment.type),
      amount: Number(payment.amount),
      paymentMethodInfo: emptyToUndefined(payment.paymentMethodInfo),
      transactionId: emptyToUndefined(payment.transactionId),
      tid: emptyToUndefined(payment.tid),
      providerSigningAuthor: emptyToUndefined(payment.providerSigningAuthor),
      providerSignature: emptyToUndefined(payment.providerSignature),
      ecrSigningAuthor: emptyToUndefined(payment.ecrSigningAuthor),
      ecrSessionNumber: emptyToUndefined(payment.ecrSessionNumber),
    }));
    if (
      roundMoney(payments.reduce((total, payment) => total + payment.amount, 0)) !==
      value.totalAmount
    ) {
      this.formMessage = 'Το άθροισμα των πληρωμών πρέπει να ισούται με το σύνολο.';
      return;
    }
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
        payments,
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
        replacesDocumentId: emptyToUndefined(value.replacesDocumentId),
        correctsDocumentId: emptyToUndefined(value.correctsDocumentId),
        lines,
      })
      .subscribe({
        next: () => {
          void this.router.navigate(['/documents']);
        },
        error: () => {
          this.formMessage =
            'Δεν δημιουργήθηκε το παραστατικό. Έλεγξε τα στοιχεία και δοκίμασε ξανά.';
        },
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
    const netAmount = roundMoney(
      value.lines.reduce((total, line) => total + Number(line.netAmount), 0),
    );
    const vatAmount = roundMoney(
      value.lines.reduce((total, line) => total + Number(line.vatAmount), 0),
    );
    const lineTaxTotal = (field: LineTaxAmountField, headerAmount: number) =>
      roundMoney(
        value.lines.reduce(
          (total, line, index) => total + lineTaxValue(line[field], headerAmount, index),
          0,
        ),
      );
    const withheldAmount = lineTaxTotal('withheldAmount', Number(value.withheldAmount));
    const feesAmount = lineTaxTotal('feesAmount', Number(value.feesAmount));
    const stampDutyAmount = lineTaxTotal('stampDutyAmount', Number(value.stampDutyAmount));
    const otherTaxesAmount = lineTaxTotal('otherTaxesAmount', Number(value.otherTaxesAmount));
    const deductionsAmount = lineTaxTotal('deductionsAmount', Number(value.deductionsAmount));
    this.form.controls.netAmount.setValue(netAmount, { emitEvent: false });
    this.form.controls.vatAmount.setValue(vatAmount, { emitEvent: false });
    this.form.controls.totalAmount.setValue(
      roundMoney(
        netAmount +
          vatAmount -
          withheldAmount +
          feesAmount +
          stampDutyAmount +
          otherTaxesAmount -
          deductionsAmount,
      ),
      { emitEvent: false },
    );
    if (this.paymentControls.length === 1) {
      this.paymentControls[0].controls.amount.setValue(this.form.controls.totalAmount.value, {
        emitEvent: false,
      });
    }
  }

  private createLine() {
    return this.formBuilder.nonNullable.group({
      description: [''],
      itemCode: [''],
      quantity: [1],
      measurementUnit: [1],
      unitPrice: [0],
      discountAmount: [0],
      discountOption: [false],
      netAmount: [100, [Validators.required, Validators.min(0)]],
      vatAmount: [24, [Validators.required, Validators.min(0)]],
      vatCategory: ['VAT_24', Validators.required],
      vatExemptionCategory: [0],
      withheldAmount: [0, Validators.min(0)],
      withheldCategory: [''],
      feesAmount: [0, Validators.min(0)],
      feesCategory: [''],
      stampDutyAmount: [0, Validators.min(0)],
      stampDutyCategory: [''],
      otherTaxesAmount: [0, Validators.min(0)],
      otherTaxesCategory: [''],
      deductionsAmount: [0, Validators.min(0)],
      incomeClassificationType: [''],
      incomeClassificationCategory: [''],
      expenseClassificationType: [''],
      expenseClassificationCategory: [''],
      vatClassificationType: [''],
    });
  }

  private createPayment(amount = 124) {
    return this.formBuilder.nonNullable.group({
      type: [3, [Validators.required, Validators.min(1), Validators.max(8)]],
      amount: [amount, [Validators.required, Validators.min(0)]],
      paymentMethodInfo: [''],
      transactionId: [''],
      tid: [''],
      providerSigningAuthor: [''],
      providerSignature: [''],
      ecrSigningAuthor: [''],
      ecrSessionNumber: [''],
    });
  }

  private watchLine(line: ReturnType<typeof this.createLine>): void {
    [
      line.controls.netAmount,
      line.controls.vatAmount,
      line.controls.withheldAmount,
      line.controls.feesAmount,
      line.controls.stampDutyAmount,
      line.controls.otherTaxesAmount,
      line.controls.deductionsAmount,
    ].forEach((control) => control.valueChanges.subscribe(() => this.recalculateTotal()));
    line.controls.vatCategory.valueChanges.subscribe((vatCategory) => {
      if (vatCategory === 'VAT_24')
        line.controls.vatAmount.setValue(roundMoney(line.controls.netAmount.value * 0.24));
      if (vatCategory === 'VAT_13')
        line.controls.vatAmount.setValue(roundMoney(line.controls.netAmount.value * 0.13));
      if (vatCategory === 'VAT_6')
        line.controls.vatAmount.setValue(roundMoney(line.controls.netAmount.value * 0.06));
      if (vatCategory === 'VAT_0' || vatCategory === 'NO_VAT') line.controls.vatAmount.setValue(0);
    });
  }

  private watchPayment(payment: ReturnType<typeof this.createPayment>): void {
    payment.controls.amount.valueChanges.subscribe(() => {
      this.formMessage = '';
    });
  }

  paymentTotal(): number {
    return roundMoney(
      this.paymentControls.reduce(
        (total, payment) => total + Number(payment.controls.amount.value),
        0,
      ),
    );
  }

  paymentDifference(): number {
    return roundMoney(this.form.controls.totalAmount.value - this.paymentTotal());
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

    for (const [index, line] of value.lines.entries()) {
      const lineLabel = `Γραμμή ${index + 1}`;
      const vatExemption =
        positiveOrUndefined(line.vatExemptionCategory) ??
        (index === 0 ? positiveOrUndefined(value.vatExemptionCategory) : undefined);
      if (line.vatCategory === 'VAT_0' && !vatExemption) {
        return `${lineLabel}: επίλεξε αιτία απαλλαγής ΦΠΑ.`;
      }
      if (
        Boolean(line.incomeClassificationType.trim()) !==
          Boolean(line.incomeClassificationCategory.trim()) ||
        Boolean(line.expenseClassificationType.trim()) !==
          Boolean(line.expenseClassificationCategory.trim())
      ) {
        return `${lineLabel}: type και category χαρακτηρισμού συμπληρώνονται μαζί.`;
      }

      const lineTaxes: Array<[string, number, number | string]> = [
        [
          'παρακράτησης',
          lineTaxValue(line.withheldAmount, value.withheldAmount, index),
          positiveOrUndefined(line.withheldCategory) ??
            (index === 0 ? positiveOrUndefined(value.withheldCategory) : undefined) ??
            0,
        ],
        [
          'τελών',
          lineTaxValue(line.feesAmount, value.feesAmount, index),
          positiveOrUndefined(line.feesCategory) ??
            (index === 0 ? positiveOrUndefined(value.feesCategory) : undefined) ??
            0,
        ],
        [
          'ψηφιακού τέλους',
          lineTaxValue(line.stampDutyAmount, value.stampDutyAmount, index),
          positiveOrUndefined(line.stampDutyCategory) ??
            (index === 0 ? positiveOrUndefined(value.stampDutyCategory) : undefined) ??
            0,
        ],
        [
          'λοιπών φόρων',
          lineTaxValue(line.otherTaxesAmount, value.otherTaxesAmount, index),
          positiveOrUndefined(line.otherTaxesCategory) ??
            (index === 0 ? positiveOrUndefined(value.otherTaxesCategory) : undefined) ??
            0,
        ],
      ];
      const missingLineCategory = lineTaxes.find(
        ([, amount, category]) => Number(amount) > 0 && Number(category) <= 0,
      );
      if (missingLineCategory) {
        return `${lineLabel}: συμπλήρωσε κατηγορία ${missingLineCategory[0]}.`;
      }
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

type LineTaxAmountField =
  'withheldAmount' | 'feesAmount' | 'stampDutyAmount' | 'otherTaxesAmount' | 'deductionsAmount';

function lineTaxValue(lineAmount: number, headerAmount: number, lineIndex: number): number {
  return Number(lineAmount) > 0 ? Number(lineAmount) : lineIndex === 0 ? Number(headerAmount) : 0;
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
