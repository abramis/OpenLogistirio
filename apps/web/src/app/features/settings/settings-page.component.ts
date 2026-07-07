import { NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'ol-settings-page',
  standalone: true,
  imports: [FormsModule, NgIf],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Ρυθμίσεις</h1>
        <p class="page-subtitle">Προφίλ χρήστη και ασφάλεια λογαριασμού.</p>
      </div>
    </section>

    <section class="settings-grid">
      <article class="card profile-card">
        <div class="card-header">
          <div>
            <h2 class="card-title">
              <span class="material-symbols-outlined">person</span>
              Χρήστης
            </h2>
            <p class="card-subtitle">{{ auth.user()?.accountingOffice?.name || '-' }}</p>
          </div>
        </div>
        <div class="card-body profile-body">
          <div>
            <span>Ονοματεπώνυμο</span>
            <strong>{{ auth.user()?.fullName || '-' }}</strong>
          </div>
          <div>
            <span>Email</span>
            <strong>{{ auth.user()?.email || '-' }}</strong>
          </div>
          <div>
            <span>Ρόλος</span>
            <strong>{{ auth.user()?.role || '-' }}</strong>
          </div>
        </div>
      </article>

      <article class="card password-card">
        <div class="card-header">
          <div>
            <h2 class="card-title">
              <span class="material-symbols-outlined">lock_reset</span>
              Αλλαγή κωδικού
            </h2>
          </div>
        </div>
        <form class="card-body password-form" (ngSubmit)="changePassword()">
          <label>
            Τρέχων κωδικός
            <input
              [(ngModel)]="currentPassword"
              name="currentPassword"
              type="password"
              autocomplete="current-password"
            />
          </label>
          <label>
            Νέος κωδικός
            <input
              [(ngModel)]="newPassword"
              name="newPassword"
              type="password"
              autocomplete="new-password"
            />
          </label>
          <label>
            Επιβεβαίωση
            <input
              [(ngModel)]="confirmPassword"
              name="confirmPassword"
              type="password"
              autocomplete="new-password"
            />
          </label>

          <div class="alert alert-success" *ngIf="message">{{ message }}</div>
          <div class="alert alert-danger" *ngIf="errorMessage">{{ errorMessage }}</div>

          <button class="btn btn-primary" type="submit" [disabled]="busy">
            <span class="material-symbols-outlined">save</span>
            {{ busy ? 'Αποθήκευση...' : 'Αποθήκευση' }}
          </button>
        </form>
      </article>
    </section>
  `,
  styles: [
    `
      .settings-grid {
        display: grid;
        grid-template-columns: minmax(280px, 0.8fr) minmax(320px, 1fr);
        gap: 16px;
      }

      .profile-body,
      .password-form {
        display: grid;
        gap: 14px;
      }

      .profile-body div {
        display: grid;
        gap: 4px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border);
      }

      .profile-body div:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }

      .profile-body span,
      label {
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 700;
      }

      .profile-body strong {
        color: var(--text);
        font-size: 0.95rem;
      }

      label {
        display: grid;
        gap: 6px;
      }

      .password-form button {
        justify-self: start;
      }

      @media (max-width: 900px) {
        .settings-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class SettingsPageComponent {
  readonly auth = inject(AuthService);

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  busy = false;
  message = '';
  errorMessage = '';

  changePassword(): void {
    this.message = '';
    this.errorMessage = '';

    if (this.newPassword.length < 8) {
      this.errorMessage = 'Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Η επιβεβαίωση δεν ταιριάζει με τον νέο κωδικό.';
      return;
    }

    this.busy = true;
    this.auth.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: () => {
        this.busy = false;
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.message = 'Ο κωδικός ενημερώθηκε.';
      },
      error: (error: unknown) => {
        this.busy = false;
        this.errorMessage =
          error instanceof HttpErrorResponse && error.status === 400
            ? 'Ο τρέχων κωδικός δεν είναι σωστός ή ο νέος κωδικός δεν είναι αποδεκτός.'
            : 'Δεν ήταν δυνατή η αλλαγή κωδικού.';
      },
    });
  }
}
