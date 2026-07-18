import { AsyncPipe, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { MyDataApiService } from '../core/api/mydata-api.service';
import { SystemApiService } from '../core/api/system-api.service';
import { ACCOUNTING_CONTROL_ROLES, ADMIN_ROLES } from '../core/auth/user-roles';

@Component({
  selector: 'ol-shell',
  standalone: true,
  imports: [AsyncPipe, NgIf, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <div class="brand-logomark">
            <span class="material-symbols-outlined">account_balance</span>
          </div>
          <div>
            <div class="brand-name">Open Logistirio</div>
            <div class="brand-sub">Λογιστικό γραφείο ERP</div>
          </div>
        </div>

        <nav class="sidebar-nav" aria-label="Κύρια πλοήγηση">
          <div class="nav-label">Καθημερινή εργασία</div>
          <a
            class="nav-item"
            routerLink="/"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
          >
            <span class="material-symbols-outlined">dashboard</span>
            <span>Cockpit</span>
          </a>
          <a class="nav-item" routerLink="/companies" routerLinkActive="active">
            <span class="material-symbols-outlined">groups</span>
            <span>Πελάτες</span>
          </a>
          <a class="nav-item" routerLink="/documents" routerLinkActive="active">
            <span class="material-symbols-outlined">receipt_long</span>
            <span>Παραστατικά</span>
          </a>
          <a class="nav-item" routerLink="/mydata" routerLinkActive="active">
            <span class="material-symbols-outlined">sync_alt</span>
            <span>myDATA Συμφωνία</span>
          </a>
          <a class="nav-item" routerLink="/counterparties" routerLinkActive="active">
            <span class="material-symbols-outlined">contacts</span>
            <span>Αντισυμβαλλόμενοι</span>
          </a>
          <div class="nav-label">Λογιστική & φορολογία</div>
          <a class="nav-item" routerLink="/vat-book" routerLinkActive="active">
            <span class="material-symbols-outlined">calculate</span>
            <span>Βιβλία</span>
          </a>
          <a class="nav-item" routerLink="/accounting" routerLinkActive="active">
            <span class="material-symbols-outlined">account_balance</span>
            <span>Λογιστική</span>
          </a>
          <a class="nav-item" routerLink="/obligations" routerLinkActive="active">
            <span class="material-symbols-outlined">event_available</span>
            <span>Υποχρεώσεις</span>
          </a>
          <a class="nav-item" routerLink="/fixed-assets" routerLinkActive="active">
            <span class="material-symbols-outlined">inventory_2</span>
            <span>Πάγια</span>
          </a>
          <div class="nav-label">Εργαλεία γραφείου</div>
          <a class="nav-item" routerLink="/digital-movement" routerLinkActive="active">
            <span class="material-symbols-outlined">local_shipping</span>
            <span>Διακίνηση</span>
          </a>
          <a class="nav-item" routerLink="/imports" routerLinkActive="active">
            <span class="material-symbols-outlined">upload_file</span>
            <span>Imports</span>
          </a>
          <a class="nav-item" routerLink="/declarations" routerLinkActive="active">
            <span class="material-symbols-outlined">summarize</span>
            <span>Workpapers</span>
          </a>
          <a class="nav-item" routerLink="/reports" routerLinkActive="active">
            <span class="material-symbols-outlined">analytics</span>
            <span>Reports</span>
          </a>
          <div class="nav-label">Διαχείριση</div>
          <a *ngIf="canViewAudit()" class="nav-item" routerLink="/audit" routerLinkActive="active">
            <span class="material-symbols-outlined">history</span>
            <span>Audit</span>
          </a>
          <a
            *ngIf="canManageUsers()"
            class="nav-item"
            routerLink="/users"
            routerLinkActive="active"
          >
            <span class="material-symbols-outlined">manage_accounts</span>
            <span>Χρήστες</span>
          </a>
          <a
            *ngIf="canManageUsers()"
            class="nav-item"
            routerLink="/backups"
            routerLinkActive="active"
          >
            <span class="material-symbols-outlined">backup</span>
            <span>Backups</span>
          </a>
          <a class="nav-item" routerLink="/settings" routerLinkActive="active">
            <span class="material-symbols-outlined">settings</span>
            <span>Ρυθμίσεις</span>
          </a>
          <a class="nav-item" routerLink="/about" routerLinkActive="active">
            <span class="material-symbols-outlined">info</span>
            <span>About</span>
          </a>
        </nav>

        <div class="sidebar-footer">
          <div class="ws-label">Ενεργό γραφείο</div>
          <div class="ws-name">{{ auth.user()?.accountingOffice?.name || 'Open Logistirio' }}</div>
          <span class="aade-badge" *ngIf="myDataEnvironment$ | async as environment">
            <span class="material-symbols-outlined">science</span>
            {{
              environment.productionWriteEnabled
                ? 'AADE production writes'
                : environment.productionReadEnabled
                  ? 'AADE production read-only'
                  : 'AADE test mode'
            }}
          </span>
          <div class="build-info" *ngIf="systemHealth$ | async as health">
            v{{ health.version }}
            <span *ngIf="health.gitSha !== 'unknown'">· {{ health.gitSha.slice(0, 7) }}</span>
          </div>
        </div>
      </aside>

      <main class="content">
        <header class="topbar">
          <div class="topbar-context">
            <span class="material-symbols-outlined">domain</span>
            <span>Χώρος εργασίας λογιστικού γραφείου</span>
          </div>
          <div class="user-summary">
            <strong>{{ auth.user()?.fullName || 'Open Logistirio' }}</strong>
            <span>{{ auth.user()?.role || '' }}</span>
          </div>
          <button class="btn btn-secondary btn-sm" type="button" (click)="auth.logout()">
            <span class="material-symbols-outlined">logout</span>
            Έξοδος
          </button>
        </header>
        <div class="workspace">
          <ng-content />
        </div>
      </main>
    </div>
  `,
  styles: [
    `
      .shell {
        display: grid;
        min-height: 100vh;
        grid-template-columns: 256px minmax(0, 1fr);
      }

      /* ── Sidebar ─────────────────────────────────────── */
      .sidebar {
        position: sticky;
        top: 0;
        height: 100vh;
        display: flex;
        flex-direction: column;
        background: var(--sidebar-bg);
        border-right: 1px solid var(--sidebar-line);
        overflow-y: auto;
      }

      /* Brand */
      .sidebar-brand {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 18px 14px 16px;
        border-bottom: 1px solid var(--sidebar-line);
        flex-shrink: 0;
      }

      .brand-logomark {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: var(--primary);
        flex-shrink: 0;
      }
      .brand-logomark .material-symbols-outlined {
        font-size: 20px;
        color: #fff;
      }

      .brand-name {
        font-size: 0.875rem;
        font-weight: 700;
        color: #e2e8f0;
        line-height: 1.3;
      }
      .brand-sub {
        font-size: 0.6875rem;
        color: var(--sidebar-nav-text);
        margin-top: 1px;
      }

      /* Nav */
      .sidebar-nav {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 10px 8px;
      }

      .nav-label {
        padding: 13px 10px 5px;
        color: #70838f;
        font-size: 0.625rem;
        font-weight: 800;
        letter-spacing: 0.11em;
        line-height: 1;
        text-transform: uppercase;
      }

      .nav-label:first-child {
        padding-top: 5px;
      }

      .nav-item {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 9px 10px;
        border-radius: 6px;
        color: var(--sidebar-nav-text);
        font-size: 0.875rem;
        font-weight: 500;
        transition:
          background 100ms,
          color 100ms;
      }
      .nav-item .material-symbols-outlined {
        font-size: 19px;
        flex-shrink: 0;
      }

      .nav-item:hover {
        background: var(--sidebar-nav-hover);
        color: #c8d6e8;
      }
      .nav-item.active {
        background: var(--sidebar-nav-act-bg);
        color: var(--sidebar-nav-act-t);
        font-weight: 600;
        box-shadow: inset 3px 0 0 var(--sidebar-nav-act-i);
      }
      .nav-item.active .material-symbols-outlined {
        color: var(--sidebar-nav-act-i);
      }

      /* Footer */
      .sidebar-footer {
        flex-shrink: 0;
        padding: 14px 14px 18px;
        border-top: 1px solid var(--sidebar-line);
      }

      .ws-label {
        font-size: 0.625rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #6f838f;
        margin-bottom: 4px;
      }
      .ws-name {
        font-size: 0.8125rem;
        color: #7a90ad;
        font-weight: 500;
        line-height: 1.4;
        margin-bottom: 10px;
      }
      .aade-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        border-radius: 4px;
        background: rgba(245, 158, 11, 0.13);
        border: 1px solid rgba(245, 158, 11, 0.28);
        color: #f59e0b;
        font-size: 0.6875rem;
        font-weight: 700;
      }
      .aade-badge .material-symbols-outlined {
        font-size: 13px;
      }

      .build-info {
        margin-top: 9px;
        color: #607684;
        font-size: 0.625rem;
        font-variant-numeric: tabular-nums;
      }

      /* Content */
      .content {
        min-width: 0;
        background: var(--bg);
      }

      .topbar {
        position: sticky;
        top: 0;
        z-index: 20;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-height: 58px;
        padding: 10px 32px;
        border-bottom: 1px solid var(--border);
        background: rgba(251, 252, 253, 0.94);
        backdrop-filter: blur(10px);
      }

      .user-summary {
        display: grid;
        gap: 2px;
        text-align: right;
        margin-left: auto;
      }

      .user-summary strong {
        font-size: 0.85rem;
      }

      .user-summary span {
        color: var(--muted);
        font-size: 0.72rem;
      }

      .topbar-context {
        display: flex;
        align-items: center;
        gap: 7px;
        color: var(--muted);
        font-size: 0.75rem;
        font-weight: 600;
      }

      .topbar-context .material-symbols-outlined {
        color: var(--primary);
        font-size: 17px;
      }

      .workspace {
        width: min(100%, var(--workspace-max));
        margin: 0 auto;
        padding: 26px 32px 48px;
      }

      @media (max-width: 760px) {
        .shell {
          grid-template-columns: 1fr;
        }
        .sidebar {
          position: relative;
          height: auto;
          flex-direction: row;
          flex-wrap: wrap;
          align-items: center;
          padding: 12px 14px;
        }
        .sidebar-brand {
          border-bottom: none;
          padding: 0;
        }
        .sidebar-nav {
          flex-direction: row;
          padding: 0;
          flex: 1;
          overflow-x: auto;
        }
        .nav-label {
          display: none;
        }
        .nav-item {
          flex: 0 0 auto;
        }
        .sidebar-footer {
          display: none;
        }
        .topbar {
          padding: 8px 16px;
        }
        .topbar-context {
          display: none;
        }
        .workspace {
          padding: 18px 16px 36px;
        }
      }
    `,
  ],
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  private readonly myDataApi = inject(MyDataApiService);
  private readonly systemApi = inject(SystemApiService);
  readonly myDataEnvironment$ = this.myDataApi.environment();
  readonly systemHealth$ = this.systemApi.health();

  canViewAudit(): boolean {
    return this.auth.hasAnyRole(ACCOUNTING_CONTROL_ROLES);
  }

  canManageUsers(): boolean {
    return this.auth.hasAnyRole(ADMIN_ROLES);
  }
}
