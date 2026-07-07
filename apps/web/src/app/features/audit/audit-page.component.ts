import { AsyncPipe, DatePipe, JsonPipe, NgClass, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, switchMap, tap } from 'rxjs';
import { AuditAction, AuditApiService, AuditLogEntry } from '../../core/api/audit-api.service';

@Component({
  selector: 'ol-audit-page',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, JsonPipe, NgClass, NgFor, NgIf],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Audit Trail</h1>
        <p class="page-subtitle">Ιστορικό αλλαγών ανά χρήστη, οντότητα και ενέργεια.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" type="button" (click)="reload()">
          <span class="material-symbols-outlined">refresh</span>
          Ανανέωση
        </button>
      </div>
    </section>

    <section class="card audit-filter">
      <div class="card-body filter-row">
        <label>
          Ενέργεια
          <select [(ngModel)]="action">
            <option value="">Όλες</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
          </select>
        </label>
        <label>
          Οντότητα
          <input [(ngModel)]="entityType" placeholder="ClientCompany" />
        </label>
        <label>
          Entity ID
          <input [(ngModel)]="entityId" />
        </label>
        <label>
          Από
          <input [(ngModel)]="dateFrom" type="date" />
        </label>
        <label>
          Έως
          <input [(ngModel)]="dateTo" type="date" />
        </label>
        <label>
          Όριο
          <input [(ngModel)]="take" type="number" min="1" max="200" />
        </label>
        <button class="btn btn-primary" type="button" (click)="reload()">
          <span class="material-symbols-outlined">filter_alt</span>
          Φίλτρο
        </button>
      </div>
    </section>

    <section class="metrics">
      <article class="card metric">
        <span>Σύνολο</span>
        <strong>{{ latestLogs.length }}</strong>
      </article>
      <article class="card metric">
        <span>Creates</span>
        <strong>{{ countByAction('CREATE') }}</strong>
      </article>
      <article class="card metric">
        <span>Updates</span>
        <strong>{{ countByAction('UPDATE') }}</strong>
      </article>
      <article class="card metric danger">
        <span>Deletes</span>
        <strong>{{ countByAction('DELETE') }}</strong>
      </article>
    </section>

    <section class="table-wrap" *ngIf="logs$ | async as logs">
      <table>
        <thead>
          <tr>
            <th>Χρόνος</th>
            <th>Χρήστης</th>
            <th>Ενέργεια</th>
            <th>Οντότητα</th>
            <th>Πριν</th>
            <th>Μετά</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let log of logs">
            <td>{{ log.createdAt | date: 'dd/MM/yyyy HH:mm:ss' }}</td>
            <td>
              <strong>{{ log.user?.fullName || 'System' }}</strong>
              <small>{{ log.user?.email || log.userId || '-' }}</small>
            </td>
            <td>
              <span class="badge" [ngClass]="badgeClass(log.action)">{{ log.action }}</span>
            </td>
            <td>
              <strong>{{ log.entityType }}</strong>
              <small>{{ log.entityId }}</small>
            </td>
            <td>
              <details *ngIf="hasValue(log.oldValue)">
                <summary>JSON</summary>
                <pre>{{ log.oldValue | json }}</pre>
              </details>
              <span class="muted" *ngIf="!hasValue(log.oldValue)">-</span>
            </td>
            <td>
              <details *ngIf="hasValue(log.newValue)">
                <summary>JSON</summary>
                <pre>{{ log.newValue | json }}</pre>
              </details>
              <span class="muted" *ngIf="!hasValue(log.newValue)">-</span>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" *ngIf="logs.length === 0">
        <span class="material-symbols-outlined">history</span>
        Δεν υπάρχουν audit entries για αυτά τα φίλτρα.
      </div>
    </section>
  `,
  styles: [
    `
      .audit-filter {
        margin-bottom: 16px;
      }

      .filter-row {
        display: grid;
        grid-template-columns:
          minmax(130px, 0.9fr) minmax(150px, 1fr) minmax(150px, 1fr) repeat(3, minmax(110px, 0.8fr))
          auto;
        align-items: end;
        gap: 12px;
      }

      label {
        display: grid;
        gap: 6px;
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 700;
      }

      .metrics {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }

      .metric {
        display: grid;
        gap: 8px;
        padding: 14px;
      }

      .metric span {
        color: var(--muted);
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      .metric strong {
        font-size: 1.35rem;
      }

      .metric.danger {
        border-color: var(--err-bd);
      }

      td small {
        display: block;
        max-width: 220px;
        overflow: hidden;
        color: var(--muted);
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      details {
        max-width: 360px;
      }

      summary {
        cursor: pointer;
        color: var(--primary);
        font-size: 0.78rem;
        font-weight: 700;
      }

      pre {
        max-height: 220px;
        margin: 8px 0 0;
        overflow: auto;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg);
        padding: 10px;
        color: var(--text);
        font-size: 0.72rem;
      }

      .muted {
        color: var(--muted);
      }

      @media (max-width: 1100px) {
        .filter-row,
        .metrics {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 720px) {
        .filter-row,
        .metrics {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AuditPageComponent {
  private readonly auditApi = inject(AuditApiService);
  private readonly reload$ = new BehaviorSubject<void>(undefined);

  latestLogs: AuditLogEntry[] = [];
  action: AuditAction | '' = '';
  entityType = '';
  entityId = '';
  dateFrom = '';
  dateTo = '';
  take = 100;

  readonly logs$ = this.reload$.pipe(
    switchMap(() =>
      this.auditApi.findAll({
        action: this.action,
        entityType: this.entityType.trim(),
        entityId: this.entityId.trim(),
        dateFrom: this.dateFrom,
        dateTo: this.dateTo,
        take: this.take,
      }),
    ),
    tap((logs) => {
      this.latestLogs = logs;
    }),
  );

  reload(): void {
    this.reload$.next();
  }

  countByAction(action: AuditAction): number {
    return this.latestLogs.filter((log) => log.action === action).length;
  }

  badgeClass(action: AuditAction): string {
    return {
      CREATE: 'badge-success',
      UPDATE: 'badge-info',
      DELETE: 'badge-danger',
    }[action];
  }

  hasValue(value: unknown): boolean {
    return value !== null && value !== undefined;
  }
}
