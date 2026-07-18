import { AsyncPipe, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { BehaviorSubject, switchMap } from 'rxjs';
import { BackupsApiService, BackupFileInfo } from '../../core/api/backups-api.service';

@Component({
  selector: 'ol-backups-page',
  standalone: true,
  imports: [AsyncPipe, DatePipe, DecimalPipe, NgFor, NgIf],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Αντίγραφα ασφαλείας</h1>
        <p class="page-subtitle">Backup και επαναφορά βάσης δεδομένων</p>
      </div>
      <button
        type="button"
        class="btn btn-primary"
        [disabled]="isCreating"
        (click)="createBackup()"
      >
        <span class="material-symbols-outlined">backup</span>
        {{ isCreating ? 'Δημιουργία...' : 'Νέο backup' }}
      </button>
    </section>

    <div class="alert alert-success" *ngIf="message">
      <span class="material-symbols-outlined">check_circle</span>
      {{ message }}
    </div>
    <div class="alert alert-danger" *ngIf="errorMessage">
      <span class="material-symbols-outlined">error</span>
      {{ errorMessage }}
    </div>

    <section class="coverage-grid" *ngIf="status$ | async as status">
      <article class="coverage-card" [class.coverage-ok]="status.database.fresh">
        <span class="material-symbols-outlined">database</span>
        <div>
          <small>Βάση δεδομένων</small>
          <strong>{{ status.database.fileName || 'Δεν υπάρχει backup' }}</strong>
          <span>{{ artifactStatusLabel(status.database, status.maxAgeHours) }}</span>
        </div>
      </article>
      <article class="coverage-card" [class.coverage-ok]="status.supportingDocuments.fresh">
        <span class="material-symbols-outlined">folder_copy</span>
        <div>
          <small>Supporting documents</small>
          <strong>{{ status.supportingDocuments.fileName || 'Δεν υπάρχει archive' }}</strong>
          <span>{{ artifactStatusLabel(status.supportingDocuments, status.maxAgeHours) }}</span>
        </div>
      </article>
      <div class="coverage-summary" [class.summary-ok]="status.healthy">
        <span class="material-symbols-outlined">{{ status.healthy ? 'verified' : 'warning' }}</span>
        {{
          status.healthy ? 'Η κάλυψη backup είναι εντός ορίου.' : 'Η κάλυψη backup θέλει έλεγχο.'
        }}
      </div>
    </section>

    <section class="card backup-card">
      <div class="card-header">
        <h2 class="card-title">
          <span class="material-symbols-outlined">database</span>
          Διαθέσιμα backups
        </h2>
      </div>

      <ng-container *ngIf="backups$ | async as backups">
        <div class="empty-state compact" *ngIf="backups.length === 0">
          <span class="material-symbols-outlined">folder_off</span>
          <p>Δεν έχει δημιουργηθεί ακόμα backup.</p>
        </div>

        <div class="table-wrap" *ngIf="backups.length > 0">
          <table>
            <thead>
              <tr>
                <th>Αρχείο</th>
                <th>Ημερομηνία</th>
                <th>Ακεραιότητα</th>
                <th class="tr">Μέγεθος</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let backup of backups">
                <td>
                  <strong>{{ backup.fileName }}</strong>
                  <small *ngIf="backup.fileName.includes('pre-restore')">safety backup</small>
                </td>
                <td>{{ backup.createdAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                <td>
                  <span
                    class="badge"
                    [class.badge-success]="backup.checksumSha256"
                    [class.badge-warning]="!backup.checksumSha256"
                  >
                    {{ backup.checksumSha256 ? 'SHA-256 διαθέσιμο' : 'Legacy — χωρίς checksum' }}
                  </span>
                </td>
                <td class="tr">{{ backup.sizeBytes / 1024 / 1024 | number: '1.2-2' }} MB</td>
                <td class="actions">
                  <button
                    type="button"
                    class="btn btn-xs btn-secondary"
                    (click)="downloadBackup(backup)"
                  >
                    <span class="material-symbols-outlined">download</span>
                    Λήψη
                  </button>
                  <button
                    type="button"
                    class="btn btn-xs btn-danger"
                    [disabled]="isRestoring"
                    (click)="restoreBackup(backup)"
                  >
                    <span class="material-symbols-outlined">restore</span>
                    Επαναφορά
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ng-container>
    </section>
  `,
  styles: [
    `
      .backup-card {
        margin-top: 16px;
      }

      .coverage-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }

      .coverage-card {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 12px;
        padding: 14px;
        border: 1px solid var(--warn-bd);
        border-radius: var(--radius-md);
        background: var(--warn-bg);
      }

      .coverage-card.coverage-ok {
        border-color: var(--ok-bd);
        background: var(--ok-bg);
      }

      .coverage-card > .material-symbols-outlined {
        color: var(--muted);
        font-size: 22px;
      }

      .coverage-card div,
      .coverage-card strong,
      .coverage-card span,
      .coverage-card small {
        display: block;
        min-width: 0;
      }

      .coverage-card small {
        margin: 0 0 3px;
        font-weight: 700;
      }

      .coverage-card strong {
        overflow: hidden;
        font-size: 0.82rem;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .coverage-card div > span {
        margin-top: 4px;
        color: var(--muted);
        font-size: 0.74rem;
      }

      .coverage-summary {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        gap: 7px;
        color: var(--warn);
        font-size: 0.8rem;
        font-weight: 700;
      }

      .coverage-summary.summary-ok {
        color: var(--ok);
      }

      @media (max-width: 720px) {
        .coverage-grid {
          grid-template-columns: 1fr;
        }
      }

      .compact {
        padding: 24px;
      }

      .tr {
        text-align: right;
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
        flex-wrap: wrap;
      }

      td strong,
      td small {
        display: block;
      }

      td small {
        margin-top: 3px;
        color: var(--muted);
      }
    `,
  ],
})
export class BackupsPageComponent {
  private readonly backupsApi = inject(BackupsApiService);
  private readonly reload$ = new BehaviorSubject<void>(undefined);

  readonly backups$ = this.reload$.pipe(switchMap(() => this.backupsApi.list()));
  readonly status$ = this.reload$.pipe(switchMap(() => this.backupsApi.status()));
  isCreating = false;
  isRestoring = false;
  message = '';
  errorMessage = '';

  createBackup(): void {
    this.clearMessages();
    this.isCreating = true;

    this.backupsApi.create().subscribe({
      next: (backup) => {
        this.isCreating = false;
        this.message = `Δημιουργήθηκε backup: ${backup.fileName}`;
        this.reload$.next();
      },
      error: (error: { error?: { message?: string | string[] }; message?: string }) => {
        this.isCreating = false;
        this.showError(error);
      },
    });
  }

  restoreBackup(backup: BackupFileInfo): void {
    const integrityWarning = backup.checksumSha256
      ? 'Το SHA-256 θα επαληθευτεί πριν ξεκινήσει η επαναφορά.'
      : 'ΠΡΟΣΟΧΗ: πρόκειται για legacy backup χωρίς αποθηκευμένο checksum.';
    const confirmed = window.confirm(
      `Θα γίνει επαναφορά από το ${backup.fileName}. ${integrityWarning} Πριν την επαναφορά θα δημιουργηθεί αυτόματα safety backup. Συνέχεια;`,
    );

    if (!confirmed) {
      return;
    }

    this.clearMessages();
    this.isRestoring = true;

    this.backupsApi.restore(backup.fileName).subscribe({
      next: (result) => {
        this.isRestoring = false;
        this.message = `Έγινε επαναφορά από ${result.restoredFrom}. Safety backup: ${result.safetyBackup.fileName}`;
        this.reload$.next();
      },
      error: (error: { error?: { message?: string | string[] }; message?: string }) => {
        this.isRestoring = false;
        this.showError(error);
      },
    });
  }

  downloadBackup(backup: BackupFileInfo): void {
    this.clearMessages();
    this.backupsApi.download(backup.fileName).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = backup.fileName;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: (error: { error?: { message?: string | string[] }; message?: string }) =>
        this.showError(error),
    });
  }

  artifactStatusLabel(
    artifact: { ageHours: number | null; checksumAvailable: boolean; fresh: boolean },
    maxAgeHours: number,
  ): string {
    if (artifact.ageHours === null) {
      return 'Δεν βρέθηκε ολοκληρωμένο artifact.';
    }
    const age = artifact.ageHours < 1 ? '<1' : Math.floor(artifact.ageHours).toString();
    const checksum = artifact.checksumAvailable ? 'checksum διαθέσιμο' : 'χωρίς checksum';
    return `${age} ώρες πριν · ${checksum}${artifact.fresh ? '' : ` · όριο ${maxAgeHours} ωρών`}`;
  }

  private clearMessages(): void {
    this.message = '';
    this.errorMessage = '';
  }

  private showError(error: { error?: { message?: string | string[] }; message?: string }): void {
    const message = error.error?.message ?? error.message;
    this.errorMessage = Array.isArray(message)
      ? message.join(' ')
      : (message ?? 'Η ενέργεια backup απέτυχε.');
  }
}
