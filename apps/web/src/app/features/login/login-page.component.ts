import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'ol-login-page',
  standalone: true,
  imports: [FormsModule],
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

        <form class="login-body">
          <label class="field">
            <span class="field-label">
              <span class="material-symbols-outlined">mail</span> Email
            </span>
            <input
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
              type="password"
              name="password"
              autocomplete="current-password"
              placeholder="••••••••"
            />
          </label>

          <button type="button" class="btn btn-primary login-btn">
            <span class="material-symbols-outlined">login</span>
            Σύνδεση
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
    `,
  ],
})
export class LoginPageComponent {}
