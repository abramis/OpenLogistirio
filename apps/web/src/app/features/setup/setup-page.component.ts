import { NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService, InitialSetupRequest } from '../../core/auth/auth.service';
import { readSetupToken } from './setup-token';

@Component({
  selector: 'ol-setup-page',
  standalone: true,
  imports: [FormsModule, NgIf],
  template: `
    <main class="setup-wrap">
      <section class="setup-card" aria-labelledby="setup-title">
        <header class="setup-header">
          <div class="setup-logo" aria-hidden="true">
            <span class="material-symbols-outlined">account_balance</span>
          </div>
          <div>
            <p class="eyebrow">Open Logistirio</p>
            <h1 id="setup-title">Αρχική ρύθμιση</h1>
            <p>Συμπληρώστε τα στοιχεία του γραφείου και του πρώτου διαχειριστή.</p>
          </div>
        </header>

        <div class="setup-state" *ngIf="checking">
          <span class="material-symbols-outlined" aria-hidden="true">progress_activity</span>
          <strong>Έλεγχος εγκατάστασης...</strong>
          <span>Περιμένετε λίγα δευτερόλεπτα.</span>
        </div>

        <div class="setup-state setup-state-error" *ngIf="!checking && blockingError">
          <span class="material-symbols-outlined" aria-hidden="true">error</span>
          <strong>Δεν μπορεί να συνεχιστεί η ρύθμιση</strong>
          <span>{{ blockingError }}</span>
          <button class="btn btn-secondary" type="button" (click)="goToLogin()">
            Μετάβαση στη σύνδεση
          </button>
        </div>

        <form
          *ngIf="ready"
          #setupForm="ngForm"
          class="setup-form"
          novalidate
          (ngSubmit)="submit(setupForm)"
        >
          <fieldset>
            <legend>
              <span class="material-symbols-outlined" aria-hidden="true">store</span>
              Στοιχεία λογιστικού γραφείου
            </legend>
            <p class="section-note">Μόνο η επωνυμία είναι υποχρεωτική.</p>

            <div class="form-grid">
              <label class="field field-wide">
                <span>Επωνυμία γραφείου <b>*</b></span>
                <input
                  [(ngModel)]="officeName"
                  name="officeName"
                  autocomplete="organization"
                  minlength="2"
                  maxlength="160"
                  required
                />
              </label>

              <label class="field">
                <span>ΑΦΜ γραφείου <small>προαιρετικό</small></span>
                <input
                  [(ngModel)]="officeVatNumber"
                  name="officeVatNumber"
                  inputmode="numeric"
                  maxlength="9"
                  pattern="[0-9]{9}"
                  placeholder="9 ψηφία"
                />
              </label>

              <label class="field">
                <span>Email γραφείου <small>προαιρετικό</small></span>
                <input
                  [(ngModel)]="officeEmail"
                  name="officeEmail"
                  type="email"
                  autocomplete="email"
                  maxlength="160"
                />
              </label>

              <label class="field">
                <span>Τηλέφωνο <small>προαιρετικό</small></span>
                <input
                  [(ngModel)]="officePhone"
                  name="officePhone"
                  type="tel"
                  autocomplete="tel"
                  maxlength="40"
                />
              </label>

              <label class="field">
                <span>Διεύθυνση <small>προαιρετικό</small></span>
                <input
                  [(ngModel)]="officeAddress"
                  name="officeAddress"
                  autocomplete="street-address"
                  maxlength="255"
                />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>
              <span class="material-symbols-outlined" aria-hidden="true">admin_panel_settings</span>
              Πρώτος διαχειριστής
            </legend>
            <p class="section-note">Με αυτά τα στοιχεία θα γίνει η πρώτη σύνδεση.</p>

            <div class="form-grid">
              <label class="field">
                <span>Ονοματεπώνυμο <b>*</b></span>
                <input
                  [(ngModel)]="adminFullName"
                  name="adminFullName"
                  autocomplete="name"
                  minlength="2"
                  maxlength="160"
                  required
                />
              </label>

              <label class="field">
                <span>Email διαχειριστή <b>*</b></span>
                <input
                  [(ngModel)]="adminEmail"
                  name="adminEmail"
                  type="email"
                  autocomplete="username"
                  maxlength="160"
                  required
                />
              </label>

              <label class="field">
                <span>Κωδικός <b>*</b></span>
                <input
                  [(ngModel)]="adminPassword"
                  name="adminPassword"
                  type="password"
                  autocomplete="new-password"
                  minlength="14"
                  maxlength="120"
                  required
                />
              </label>

              <label class="field">
                <span>Επιβεβαίωση κωδικού <b>*</b></span>
                <input
                  [(ngModel)]="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autocomplete="new-password"
                  minlength="14"
                  maxlength="120"
                  required
                />
              </label>
            </div>

            <p class="password-help">
              Τουλάχιστον 14 χαρακτήρες, με πεζό, κεφαλαίο, αριθμό και σύμβολο. Μην χρησιμοποιήσετε
              προεπιλεγμένο ή κοινό κωδικό.
            </p>
          </fieldset>

          <div class="form-error" role="alert" *ngIf="errorMessage">
            <span class="material-symbols-outlined" aria-hidden="true">error</span>
            {{ errorMessage }}
          </div>

          <footer class="setup-actions">
            <p><b>*</b> Υποχρεωτικά πεδία</p>
            <button class="btn btn-primary" type="submit" [disabled]="busy">
              <span class="material-symbols-outlined" aria-hidden="true">check_circle</span>
              {{ busy ? 'Ολοκλήρωση...' : 'Ολοκλήρωση ρύθμισης' }}
            </button>
          </footer>
        </form>
      </section>
    </main>
  `,
  styles: [
    `
      .setup-wrap {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 28px 20px;
        background: var(--bg);
      }

      .setup-card {
        width: min(100%, 860px);
        overflow: hidden;
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        background: var(--surface);
        box-shadow: var(--shadow-md);
      }

      .setup-header {
        display: flex;
        align-items: center;
        gap: 18px;
        padding: 25px 30px;
        color: #e2e8f0;
        background: var(--sidebar-bg);
      }

      .setup-logo {
        flex: 0 0 auto;
        display: grid;
        place-items: center;
        width: 56px;
        height: 56px;
        border-radius: 14px;
        background: var(--primary);
      }

      .setup-logo .material-symbols-outlined {
        font-size: 30px;
      }

      .eyebrow {
        margin: 0 0 2px;
        color: #8fa0be;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      h1 {
        margin: 0;
        font-size: 1.45rem;
      }

      .setup-header p:last-child {
        margin: 4px 0 0;
        color: #aebdca;
        font-size: 0.84rem;
      }

      .setup-form {
        display: grid;
        gap: 18px;
        padding: 24px 30px 28px;
      }

      fieldset {
        min-width: 0;
        margin: 0;
        padding: 18px;
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        background: var(--surface-2);
      }

      legend {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 0 7px;
        color: var(--text);
        font-size: 0.93rem;
        font-weight: 700;
      }

      legend .material-symbols-outlined {
        color: var(--primary);
      }

      .section-note {
        margin: 0 0 14px;
        color: var(--muted);
        font-size: 0.78rem;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px 18px;
      }

      .field {
        display: grid;
        align-content: start;
        gap: 6px;
      }

      .field-wide {
        grid-column: 1 / -1;
      }

      .field > span {
        color: var(--text-2);
        font-size: 0.79rem;
        font-weight: 650;
      }

      .field small {
        display: inline;
        margin-left: 4px;
        color: var(--muted);
        font-size: 0.68rem;
        font-weight: 500;
      }

      b {
        color: var(--err);
      }

      .password-help {
        margin: 13px 0 0;
        padding: 9px 11px;
        border: 1px solid var(--inf-bd);
        border-radius: var(--radius-sm);
        color: var(--inf-t);
        background: var(--inf-bg);
        font-size: 0.75rem;
      }

      .form-error {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 10px 12px;
        border: 1px solid var(--err-bd);
        border-radius: var(--radius-sm);
        color: var(--err);
        background: var(--err-bg);
        font-size: 0.82rem;
        font-weight: 650;
      }

      .setup-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }

      .setup-actions p {
        margin: 0;
        color: var(--muted);
        font-size: 0.73rem;
      }

      .setup-actions .btn {
        min-height: 42px;
      }

      .setup-state {
        min-height: 260px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 36px;
        color: var(--text-2);
        text-align: center;
      }

      .setup-state > .material-symbols-outlined {
        margin-bottom: 4px;
        color: var(--primary);
        font-size: 38px;
      }

      .setup-state span:not(.material-symbols-outlined) {
        max-width: 58ch;
        color: var(--muted);
      }

      .setup-state .btn {
        margin-top: 12px;
      }

      .setup-state-error > .material-symbols-outlined {
        color: var(--err);
      }

      @media (max-width: 660px) {
        .setup-wrap {
          padding: 0;
        }

        .setup-card {
          min-height: 100vh;
          border: 0;
          border-radius: 0;
        }

        .setup-header,
        .setup-form {
          padding-left: 20px;
          padding-right: 20px;
        }

        .form-grid {
          grid-template-columns: 1fr;
        }

        .field-wide {
          grid-column: auto;
        }

        .setup-actions {
          align-items: stretch;
          flex-direction: column;
        }

        .setup-actions .btn {
          justify-content: center;
        }
      }
    `,
  ],
})
export class SetupPageComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly changeDetector = inject(ChangeDetectorRef);

  setupToken = '';
  officeName = '';
  officeVatNumber = '';
  officeEmail = '';
  officePhone = '';
  officeAddress = '';
  adminFullName = '';
  adminEmail = '';
  adminPassword = '';
  confirmPassword = '';

  checking = true;
  ready = false;
  busy = false;
  blockingError = '';
  errorMessage = '';

  ngOnInit(): void {
    this.setupToken = readSetupToken(this.route.snapshot.fragment) ?? '';
    this.authService
      .getInitialSetupStatus()
      .pipe(finalize(() => this.changeDetector.markForCheck()))
      .subscribe({
        next: (status) => {
          if (!status.required) {
            void this.router.navigate(['/login'], { replaceUrl: true });
            return;
          }

          this.checking = false;
          if (!status.available) {
            this.blockingError =
              'Η εγκατάσταση δεν έχει ενεργό σύνδεσμο αρχικής ρύθμισης. Εκτελέστε ξανά την εγκατάσταση.';
            return;
          }
          if (this.setupToken.length < 32 || this.setupToken.length > 256) {
            this.blockingError =
              'Ο σύνδεσμος δεν περιέχει έγκυρο token. Ανοίξτε τον σύνδεσμο που έδωσε η εγκατάσταση.';
            return;
          }

          this.ready = true;
        },
        error: () => {
          this.checking = false;
          this.blockingError =
            'Δεν ήταν δυνατή η επικοινωνία με την εφαρμογή. Ελέγξτε ότι η εγκατάσταση λειτουργεί και δοκιμάστε ξανά.';
        },
      });
  }

  submit(form: NgForm): void {
    if (this.busy) {
      return;
    }

    this.errorMessage = this.validationError();
    if (form.invalid || this.errorMessage) {
      this.errorMessage ||= 'Συμπληρώστε σωστά όλα τα υποχρεωτικά πεδία.';
      return;
    }

    this.busy = true;
    this.authService
      .completeInitialSetup(this.request())
      .pipe(finalize(() => this.changeDetector.markForCheck()))
      .subscribe({
        next: () => {
          this.busy = false;
          void this.router.navigate(['/'], { replaceUrl: true });
        },
        error: (error: unknown) => {
          this.busy = false;
          this.errorMessage = apiErrorMessage(error);
        },
      });
  }

  goToLogin(): void {
    void this.router.navigate(['/login'], { replaceUrl: true });
  }

  private request(): InitialSetupRequest {
    return {
      setupToken: this.setupToken,
      officeName: this.officeName.trim(),
      officeVatNumber: optional(this.officeVatNumber),
      officeEmail: optional(this.officeEmail)?.toLowerCase(),
      officePhone: optional(this.officePhone),
      officeAddress: optional(this.officeAddress),
      adminFullName: this.adminFullName.trim(),
      adminEmail: this.adminEmail.trim().toLowerCase(),
      adminPassword: this.adminPassword,
    };
  }

  private validationError(): string {
    if (this.officeName.trim().length < 2) {
      return 'Η επωνυμία του γραφείου πρέπει να έχει τουλάχιστον 2 χαρακτήρες.';
    }
    if (this.officeVatNumber.trim() && !/^\d{9}$/.test(this.officeVatNumber.trim())) {
      return 'Το ΑΦΜ του γραφείου πρέπει να έχει ακριβώς 9 ψηφία.';
    }
    if (this.officeEmail.trim() && !isEmail(this.officeEmail)) {
      return 'Το email του γραφείου δεν είναι έγκυρο.';
    }
    if (this.officePhone.trim() && this.officePhone.trim().length < 3) {
      return 'Το τηλέφωνο του γραφείου πρέπει να έχει τουλάχιστον 3 χαρακτήρες.';
    }
    if (this.officeAddress.trim() && this.officeAddress.trim().length < 3) {
      return 'Η διεύθυνση του γραφείου πρέπει να έχει τουλάχιστον 3 χαρακτήρες.';
    }
    if (this.adminFullName.trim().length < 2) {
      return 'Το ονοματεπώνυμο του διαχειριστή πρέπει να έχει τουλάχιστον 2 χαρακτήρες.';
    }
    if (!isEmail(this.adminEmail)) {
      return 'Το email του διαχειριστή δεν είναι έγκυρο.';
    }
    if (this.adminPassword.length < 14) {
      return 'Ο κωδικός πρέπει να έχει τουλάχιστον 14 χαρακτήρες.';
    }
    if (
      !/[a-z]/.test(this.adminPassword) ||
      !/[A-Z]/.test(this.adminPassword) ||
      !/\d/.test(this.adminPassword) ||
      !/[^A-Za-z0-9]/.test(this.adminPassword)
    ) {
      return 'Ο κωδικός πρέπει να περιέχει πεζό, κεφαλαίο, αριθμό και σύμβολο.';
    }
    if (/changeme|password|openlogistirio|admin123/i.test(this.adminPassword)) {
      return 'Ο κωδικός περιέχει μη ασφαλές, προεπιλεγμένο μοτίβο.';
    }
    if (this.adminPassword !== this.confirmPassword) {
      return 'Η επιβεβαίωση του κωδικού δεν ταιριάζει.';
    }
    return '';
  }
}

function optional(value: string): string | undefined {
  return value.trim() || undefined;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function apiErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const message = error.error?.message;
    if (Array.isArray(message)) {
      return message.join(' ');
    }
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }
  return 'Δεν ήταν δυνατή η ολοκλήρωση της ρύθμισης. Ελέγξτε τα στοιχεία και δοκιμάστε ξανά.';
}
