import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'ol-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
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
          <a class="nav-item" routerLink="/counterparties" routerLinkActive="active">
            <span class="material-symbols-outlined">contacts</span>
            <span>Αντισυμβαλλόμενοι</span>
          </a>
          <a class="nav-item" routerLink="/vat-book" routerLinkActive="active">
            <span class="material-symbols-outlined">calculate</span>
            <span>Βιβλίο ΦΠΑ</span>
          </a>
          <a class="nav-item" routerLink="/obligations" routerLinkActive="active">
            <span class="material-symbols-outlined">event_available</span>
            <span>Υποχρεώσεις</span>
          </a>
          <a class="nav-item" routerLink="/fixed-assets" routerLinkActive="active">
            <span class="material-symbols-outlined">inventory_2</span>
            <span>Πάγια</span>
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
          <a class="nav-item" routerLink="/about" routerLinkActive="active">
            <span class="material-symbols-outlined">info</span>
            <span>About</span>
          </a>
        </nav>

        <div class="sidebar-footer">
          <div class="ws-label">Ενεργό γραφείο</div>
          <div class="ws-name">Ανοιχτό Λογιστήριο Αθήνας</div>
          <span class="aade-badge">
            <span class="material-symbols-outlined">science</span>
            AADE test mode
          </span>
        </div>
      </aside>

      <main class="content">
        <ng-content />
      </main>
    </div>
  `,
  styles: [
    `
      .shell {
        display: grid;
        min-height: 100vh;
        grid-template-columns: 242px minmax(0, 1fr);
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
        color: #3d5070;
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

      /* Content */
      .content {
        min-width: 0;
        padding: 28px 32px;
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
        }
        .sidebar-footer {
          display: none;
        }
        .content {
          padding: 16px;
        }
      }
    `,
  ],
})
export class ShellComponent {}
