import { NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'ol-login-page',
  standalone: true,
  imports: [FormsModule, NgIf],
  template: `
    <section class="login-wrap">
      <div class="login-card">
        <div class="login-hero">
          <div class="login-logo">
            <span class="material-symbols-outlined">account_balance</span>
          </div>
          <h1 class="login-title">Open Logistirio</h1>
          <p class="login-sub">Λογιστικό Γραφείο ERP</p>
        </div>

        <form class="login-body" *ngIf="mode === 'login'" (ngSubmit)="login()">
          <label class="field">
            <span class="field-label">
              <span class="material-symbols-outlined">mail</span> Email
            </span>
            <input
              [(ngModel)]="email"
              type="email"
              name="email"
              autocomplete="email"
              placeholder="user@logistirio.gr"
            />
          </label>

          <label class="field">
            <span class="field-label">
              <span class="material-symbols-outlined">lock</span> Κωδικός
            </span>
            <input
              [(ngModel)]="password"
              type="password"
              name="password"
              autocomplete="current-password"
              placeholder="••••••••"
            />
          </label>

          <div class="login-error" *ngIf="errorMessage">{{ errorMessage }}</div>

          <button type="submit" class="btn btn-primary login-btn" [disabled]="busy">
            <span class="material-symbols-outlined">login</span>
            {{ busy ? 'Σύνδεση...' : 'Σύνδεση' }}
          </button>
          <button class="link-button" type="button" (click)="switchMode('reset-request')">
            Ξέχασα τον κωδικό
          </button>
        </form>

        <form class="login-body" *ngIf="mode === 'reset-request'" (ngSubmit)="requestReset()">
          <label class="field">
            <span class="field-label">
              <span class="material-symbols-outlined">mail</span> Email
            </span>
            <input [(ngModel)]="resetEmail" type="email" name="resetEmail" autocomplete="email" />
          </label>
          <div class="login-error" *ngIf="errorMessage">{{ errorMessage }}</div>
          <div class="login-success" *ngIf="message">{{ message }}</div>
          <label class="field" *ngIf="resetToken">
            <span class="field-label">
              <span class="material-symbols-outlined">key</span> Reset token
            </span>
            <input [(ngModel)]="resetToken" name="resetToken" />
          </label>
          <button type="submit" class="btn btn-primary login-btn" [disabled]="busy">
            <span class="material-symbols-outlined">send</span>
            {{ busy ? 'Αποστολή...' : 'Αποστολή reset' }}
          </button>
          <button
            class="btn btn-secondary login-btn"
            type="button"
            [disabled]="!resetToken"
            (click)="switchMode('reset-confirm')"
          >
            <span class="material-symbols-outlined">lock_reset</span>
            Έχω reset token
          </button>
          <button class="link-button" type="button" (click)="switchMode('login')">
            Πίσω στη σύνδεση
          </button>
        </form>

        <form class="login-body" *ngIf="mode === 'reset-confirm'" (ngSubmit)="confirmReset()">
          <label class="field">
            <span class="field-label">
              <span class="material-symbols-outlined">key</span> Reset token
            </span>
            <input [(ngModel)]="resetToken" name="confirmResetToken" />
          </label>
          <label class="field">
            <span class="field-label">
              <span class="material-symbols-outlined">lock_reset</span> Νέος κωδικός
            </span>
            <input
              [(ngModel)]="newPassword"
              type="password"
              name="newPassword"
              autocomplete="new-password"
            />
          </label>
          <div class="login-error" *ngIf="errorMessage">{{ errorMessage }}</div>
          <div class="login-success" *ngIf="message">{{ message }}</div>
          <button type="submit" class="btn btn-primary login-btn" [disabled]="busy">
            <span class="material-symbols-outlined">save</span>
            {{ busy ? 'Αποθήκευση...' : 'Αλλαγή κωδικού' }}
          </button>
          <button class="link-button" type="button" (click)="switchMode('login')">
            Πίσω στη σύνδεση
          </button>
        </form>
      </div>
    </section>
  `,
  styles: [
    `
      .login-wrap {
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: var(--bg);
        padding: 24px;
      }

      .login-card {
        width: min(100%, 390px);
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--surface);
        box-shadow: var(--shadow-md);
        overflow: hidden;
      }

      .login-hero {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 32px 24px 24px;
        background: var(--sidebar-bg);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        text-align: center;
      }

      .login-logo {
        display: grid;
        place-items: center;
        width: 56px;
        height: 56px;
        border-radius: 14px;
        background: var(--primary);
        margin-bottom: 14px;
      }
      .login-logo .material-symbols-outlined {
        font-size: 30px;
        color: #fff;
      }

      .login-title {
        margin: 0 0 4px;
        font-size: 1.25rem;
        font-weight: 700;
        color: #e2e8f0;
      }
      .login-sub {
        margin: 0;
        font-size: 0.8125rem;
        color: #8fa0be;
      }

      .login-body {
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .field-label {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--text-2);
      }
      .field-label .material-symbols-outlined {
        font-size: 15px;
        color: var(--muted);
      }

      .login-btn {
        width: 100%;
        justify-content: center;
        min-height: 40px;
        font-size: 0.875rem;
        margin-top: 4px;
      }

      .login-error,
      .login-success {
        padding: 9px 11px;
        border-radius: 6px;
        font-size: 0.8rem;
        font-weight: 600;
      }

      .login-error {
        border: 1px solid var(--err-bd);
        background: var(--err-bg);
        color: var(--err);
      }

      .login-success {
        border: 1px solid var(--ok-bd);
        background: var(--ok-bg);
        color: var(--ok);
      }

      .link-button {
        border: 0;
        background: transparent;
        color: var(--primary);
        cursor: pointer;
        font-size: 0.8rem;
        font-weight: 700;
        padding: 4px;
      }
    `,
  ],
})
export class LoginPageComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  email = 'admin@example.gr';
  password = 'ChangeMe123!';
  resetEmail = 'admin@example.gr';
  resetToken = '';
  newPassword = '';
  mode: 'login' | 'reset-request' | 'reset-confirm' = 'login';
  busy = false;
  message = '';
  errorMessage = '';

  switchMode(mode: 'login' | 'reset-request' | 'reset-confirm'): void {
    this.mode = mode;
    this.message = '';
    this.errorMessage = '';
  }

  login(): void {
    this.errorMessage = '';
    this.message = '';
    this.busy = true;
    this.authService.login(this.email, this.password).subscribe({
      next: () => {
        this.busy = false;
        void this.router.navigate(['/']);
      },
      error: () => {
        this.busy = false;
        this.errorMessage = 'Δεν ήταν δυνατή η σύνδεση με αυτά τα στοιχεία.';
      },
    });
  }

  requestReset(): void {
    this.errorMessage = '';
    this.message = '';
    this.busy = true;
    this.authService.requestPasswordReset(this.resetEmail).subscribe({
      next: (result) => {
        this.busy = false;
        this.resetToken = result.resetToken ?? this.resetToken;
        this.message = result.resetToken
          ? 'Δημιουργήθηκε reset token για local development.'
          : 'Αν υπάρχει χρήστης με αυτό το email, θα σταλούν οδηγίες reset.';
      },
      error: () => {
        this.busy = false;
        this.errorMessage = 'Δεν ήταν δυνατή η δημιουργία reset request.';
      },
    });
  }

  confirmReset(): void {
    this.errorMessage = '';
    this.message = '';
    if (this.newPassword.length < 8) {
      this.errorMessage = 'Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.';
      return;
    }

    this.busy = true;
    this.authService.confirmPasswordReset(this.resetToken, this.newPassword).subscribe({
      next: () => {
        this.busy = false;
        this.newPassword = '';
        this.message = 'Ο κωδικός άλλαξε. Μπορείς να συνδεθείς.';
        this.mode = 'login';
      },
      error: () => {
        this.busy = false;
        this.errorMessage = 'Το reset token δεν είναι έγκυρο ή έχει λήξει.';
      },
    });
  }
}
