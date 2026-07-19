import { AsyncPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OfficeUser, UsersApiService } from '../../core/api/users-api.service';
import { UserRole } from '../../core/auth/user-roles';

const DEVELOPMENT_PASSWORD_DEFAULT = environment.production ? '' : 'ChangeMe123!';

@Component({
  selector: 'ol-users-page',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, NgFor, NgIf],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Χρήστες</h1>
        <p class="page-subtitle">Διαχείριση χρηστών και ρόλων του λογιστικού γραφείου.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" type="button" (click)="reload()">
          <span class="material-symbols-outlined">refresh</span>
          Ανανέωση
        </button>
      </div>
    </section>

    <div class="alert alert-success" *ngIf="message">{{ message }}</div>
    <div class="alert alert-danger" *ngIf="errorMessage">{{ errorMessage }}</div>

    <section class="workspace">
      <article class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">
              <span class="material-symbols-outlined">person_add</span>
              Νέος χρήστης
            </h2>
          </div>
        </div>
        <form class="card-body user-form" (ngSubmit)="createUser()">
          <label>
            Ονοματεπώνυμο
            <input [(ngModel)]="newFullName" name="newFullName" />
          </label>
          <label>
            Email
            <input [(ngModel)]="newEmail" name="newEmail" type="email" />
          </label>
          <label>
            Ρόλος
            <select [(ngModel)]="newRole" name="newRole">
              <option *ngFor="let role of assignableRoles" [value]="role">{{ role }}</option>
            </select>
          </label>
          <label>
            Προσωρινός κωδικός
            <input [(ngModel)]="newPassword" name="newPassword" type="password" />
          </label>
          <button class="btn btn-primary" type="submit" [disabled]="busy">
            <span class="material-symbols-outlined">save</span>
            Δημιουργία
          </button>
        </form>
      </article>

      <section class="table-wrap" *ngIf="users$ | async as users">
        <table>
          <thead>
            <tr>
              <th>Χρήστης</th>
              <th>Ρόλος</th>
              <th>Status</th>
              <th>Δημιουργία</th>
              <th>Ενέργεια</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let user of users">
              <td>
                <input class="inline-input" [(ngModel)]="user.fullName" />
                <small>{{ user.email }}</small>
              </td>
              <td>
                <select [(ngModel)]="user.role" [disabled]="user.role === 'SUPER_ADMIN'">
                  <option *ngFor="let role of assignableRoles" [value]="role">{{ role }}</option>
                  <option *ngIf="user.role === 'SUPER_ADMIN'" value="SUPER_ADMIN">
                    SUPER_ADMIN
                  </option>
                </select>
              </td>
              <td>
                <span
                  class="badge"
                  [class.badge-danger]="user.disabledAt"
                  [class.badge-warning]="!user.disabledAt && user.lockedUntil"
                  [class.badge-success]="!user.disabledAt && !user.lockedUntil"
                >
                  {{ user.disabledAt ? 'DISABLED' : user.lockedUntil ? 'LOCKED' : 'ACTIVE' }}
                </span>
                <small *ngIf="user.failedLoginAttempts > 0">
                  failed {{ user.failedLoginAttempts }}
                </small>
              </td>
              <td>{{ user.createdAt | date: 'dd/MM/yyyy HH:mm' }}</td>
              <td>
                <button class="btn btn-secondary btn-sm" type="button" (click)="saveUser(user)">
                  <span class="material-symbols-outlined">save</span>
                  Save
                </button>
                <button
                  class="btn btn-danger btn-sm"
                  type="button"
                  *ngIf="!user.disabledAt"
                  (click)="disableUser(user)"
                >
                  <span class="material-symbols-outlined">block</span>
                  Disable
                </button>
                <button
                  class="btn btn-secondary btn-sm"
                  type="button"
                  *ngIf="user.disabledAt"
                  (click)="enableUser(user)"
                >
                  <span class="material-symbols-outlined">check_circle</span>
                  Enable
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="empty-state" *ngIf="users.length === 0">
          <span class="material-symbols-outlined">group</span>
          Δεν υπάρχουν χρήστες.
        </div>
      </section>
    </section>
  `,
  styles: [
    `
      .workspace {
        display: grid;
        gap: 16px;
      }

      .user-form {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
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

      td small {
        display: block;
        color: var(--muted);
        margin-top: 4px;
      }

      .inline-input {
        width: min(100%, 260px);
      }

      td:last-child {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }

      @media (max-width: 1100px) {
        .user-form {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 720px) {
        .user-form {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class UsersPageComponent {
  private readonly usersApi = inject(UsersApiService);
  private readonly reload$ = new BehaviorSubject<void>(undefined);

  readonly assignableRoles: UserRole[] = [
    'ACCOUNTING_OFFICE_ADMIN',
    'ACCOUNTANT',
    'ASSISTANT',
    'CLIENT_READONLY',
  ];
  readonly users$ = this.reload$.pipe(switchMap(() => this.usersApi.findAll()));

  newFullName = '';
  newEmail = '';
  newRole: UserRole = 'ACCOUNTANT';
  newPassword = DEVELOPMENT_PASSWORD_DEFAULT;
  busy = false;
  message = '';
  errorMessage = '';

  reload(): void {
    this.reload$.next();
  }

  createUser(): void {
    this.clearMessages();
    this.busy = true;
    this.usersApi
      .create({
        email: this.newEmail,
        fullName: this.newFullName,
        role: this.newRole,
        password: this.newPassword,
      })
      .subscribe({
        next: () => {
          this.busy = false;
          this.newFullName = '';
          this.newEmail = '';
          this.newRole = 'ACCOUNTANT';
          this.newPassword = DEVELOPMENT_PASSWORD_DEFAULT;
          this.message = 'Ο χρήστης δημιουργήθηκε.';
          this.reload();
        },
        error: (error: unknown) => {
          this.busy = false;
          this.errorMessage = userErrorMessage(error);
        },
      });
  }

  saveUser(user: OfficeUser): void {
    this.clearMessages();
    this.usersApi.update(user.id, { fullName: user.fullName, role: user.role }).subscribe({
      next: () => {
        this.message = 'Ο χρήστης ενημερώθηκε.';
        this.reload();
      },
      error: (error: unknown) => {
        this.errorMessage = userErrorMessage(error);
      },
    });
  }

  disableUser(user: OfficeUser): void {
    this.clearMessages();
    this.usersApi.disable(user.id).subscribe({
      next: () => {
        this.message = 'Ο χρήστης απενεργοποιήθηκε και τα refresh tokens ανακλήθηκαν.';
        this.reload();
      },
      error: (error: unknown) => {
        this.errorMessage = userErrorMessage(error);
      },
    });
  }

  enableUser(user: OfficeUser): void {
    this.clearMessages();
    this.usersApi.enable(user.id).subscribe({
      next: () => {
        this.message = 'Ο χρήστης ενεργοποιήθηκε.';
        this.reload();
      },
      error: (error: unknown) => {
        this.errorMessage = userErrorMessage(error);
      },
    });
  }

  private clearMessages(): void {
    this.message = '';
    this.errorMessage = '';
  }
}

function userErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 400) {
    return 'Τα στοιχεία χρήστη δεν είναι αποδεκτά ή το email υπάρχει ήδη.';
  }

  return 'Δεν ήταν δυνατή η αποθήκευση χρήστη.';
}
