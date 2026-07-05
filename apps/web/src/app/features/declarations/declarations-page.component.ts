import { AsyncPipe, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, switchMap } from 'rxjs';
import { CompaniesApiService } from '../../core/api/companies-api.service';
import {
  DeclarationWorkpaper,
  DeclarationsApiService,
} from '../../core/api/declarations-api.service';

@Component({
  selector: 'ol-declarations-page',
  standalone: true,
  imports: [AsyncPipe, DatePipe, DecimalPipe, FormsModule, NgFor, NgIf],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Δηλωτικά workpapers</h1>
        <p class="page-subtitle">
          Προετοιμασία δηλώσεων από τα δεδομένα του γραφείου, χωρίς επίσημη υποβολή.
        </p>
      </div>
    </section>

    <div class="alert alert-success" *ngIf="message">{{ message }}</div>
    <div class="alert alert-danger" *ngIf="errorMessage">{{ errorMessage }}</div>

    <section class="card generator">
      <div class="card-header">
        <div>
          <h2 class="card-title">
            <span class="material-symbols-outlined">summarize</span> Generate ΦΠΑ workpaper
          </h2>
          <p class="card-subtitle">
            Υπολογίζει πωλήσεις, αγορές, ΦΠΑ και αποτυχίες myDATA από τα παραστατικά.
          </p>
        </div>
      </div>
      <div class="card-body form-grid">
        <label>
          Πελάτης
          <select [(ngModel)]="clientCompanyId">
            <option value="">Επιλογή</option>
            <option *ngFor="let company of companies$ | async" [value]="company.id">
              {{ company.legalName }}
            </option>
          </select>
        </label>
        <label>
          Έτος
          <input [(ngModel)]="year" type="number" />
        </label>
        <label>
          Μήνας
          <input [(ngModel)]="month" type="number" min="1" max="12" />
        </label>
        <div class="actions">
          <button class="btn btn-primary" type="button" (click)="generate()">Generate</button>
        </div>
      </div>
    </section>

    <section class="table-wrap" *ngIf="workpapers$ | async as workpapers">
      <table>
        <thead>
          <tr>
            <th>Workpaper</th>
            <th>Πελάτης</th>
            <th>Περίοδος</th>
            <th>Πωλήσεις ΦΠΑ</th>
            <th>Αγορές ΦΠΑ</th>
            <th>Πληρωτέο</th>
            <th>myDATA fails</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let workpaper of workpapers">
            <td>
              <strong>{{ workpaper.title }}</strong>
              <small>{{ workpaper.generatedAt | date: 'dd/MM/yyyy HH:mm' }}</small>
            </td>
            <td>
              {{ workpaper.clientCompany?.legalName || '-' }}
              <small>{{ workpaper.clientCompany?.vatNumber || '-' }}</small>
            </td>
            <td>{{ periodLabel(workpaper) }}</td>
            <td>{{ workpaper.totals.salesVat || 0 | number: '1.2-2' }}</td>
            <td>{{ workpaper.totals.purchasesVat || 0 | number: '1.2-2' }}</td>
            <td>
              <strong>{{ workpaper.totals.payableVat || 0 | number: '1.2-2' }}</strong>
            </td>
            <td>
              <span
                class="badge"
                [class.badge-danger]="(workpaper.totals.failedMyData || 0) > 0"
                [class.badge-success]="(workpaper.totals.failedMyData || 0) === 0"
              >
                {{ workpaper.totals.failedMyData || 0 }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" *ngIf="workpapers.length === 0">
        <span class="material-symbols-outlined">summarize</span>
        Δεν υπάρχουν workpapers ακόμα.
      </div>
    </section>
  `,
  styles: [
    `
      .generator {
        margin-bottom: 16px;
      }

      .form-grid {
        display: grid;
        grid-template-columns: 2fr 1fr 1fr auto;
        gap: 12px;
        align-items: end;
      }

      label {
        display: grid;
        gap: 6px;
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 700;
      }

      @media (max-width: 900px) {
        .form-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class DeclarationsPageComponent {
  private readonly declarationsApi = inject(DeclarationsApiService);
  private readonly reload$ = new BehaviorSubject<void>(undefined);

  readonly companies$ = inject(CompaniesApiService).findAll();
  readonly workpapers$ = this.reload$.pipe(switchMap(() => this.declarationsApi.findWorkpapers()));
  clientCompanyId = '';
  year = new Date().getFullYear();
  month = new Date().getMonth() + 1;
  message = '';
  errorMessage = '';

  generate(): void {
    this.message = '';
    this.errorMessage = '';
    this.declarationsApi
      .generateVatWorkpaper({
        clientCompanyId: this.clientCompanyId,
        year: this.year,
        month: this.month,
      })
      .subscribe({
        next: () => {
          this.message = 'Το ΦΠΑ workpaper δημιουργήθηκε.';
          this.reload$.next();
        },
        error: (error: unknown) => this.showError(error),
      });
  }

  periodLabel(workpaper: DeclarationWorkpaper): string {
    return workpaper.periodMonth
      ? `${String(workpaper.periodMonth).padStart(2, '0')}/${workpaper.periodYear}`
      : String(workpaper.periodYear);
  }

  private showError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      const message = error.error?.message;
      this.errorMessage = Array.isArray(message) ? message.join(' ') : message || error.message;
      return;
    }
    this.errorMessage = 'Request failed.';
  }
}
