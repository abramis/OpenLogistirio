import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, switchMap } from 'rxjs';
import { CompaniesApiService, ClientCompany } from '../../core/api/companies-api.service';

@Component({
  selector: 'ol-companies-list-page',
  standalone: true,
  imports: [AsyncPipe, NgFor, NgIf, RouterLink],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Πελάτες</h1>
        <p class="page-subtitle">Εταιρείες, ατομικές επιχειρήσεις και ελεύθεροι επαγγελματίες</p>
      </div>
      <a class="btn btn-primary" routerLink="/companies/new">
        <span class="material-symbols-outlined">person_add</span>
        Νέος πελάτης
      </a>
    </section>

    <ng-container *ngIf="companies$ | async as companies">
      <div class="table-wrap" *ngIf="companies.length > 0; else noCompanies">
        <table>
          <thead>
            <tr>
              <th>Πελάτης</th>
              <th>ΑΦΜ</th>
              <th>Τύπος</th>
              <th>Βιβλία / ΦΠΑ</th>
              <th>AADE myDATA</th>
              <th>ΔΟΥ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let company of companies">
              <td>
                <a class="row-link" [routerLink]="['/companies', company.id]">{{
                  company.legalName
                }}</a>
                <small *ngIf="company.tradeName">{{ company.tradeName }}</small>
                <small *ngIf="company.email">{{ company.email }}</small>
              </td>
              <td class="mono">{{ company.vatNumber }}</td>
              <td>
                {{ entityTypeLabel(company.entityType) }}
                <small *ngIf="company.professionLabel">{{ company.professionLabel }}</small>
              </td>
              <td>
                {{ accountingCategoryLabel(company.accountingCategory) }}
                <small>{{ vatRegimeLabel(company.vatRegime) }}</small>
              </td>
              <td>
                <span
                  class="badge"
                  [class.badge-success]="
                    company.myDataAuthorized && company.myDataMode !== 'NOT_CONFIGURED'
                  "
                  [class.badge-warning]="company.myDataMode === 'MANUAL_UPLOAD'"
                  [class.badge-danger]="company.myDataMode === 'NOT_CONFIGURED'"
                  [class.badge-info]="company.myDataMode === 'OWN_API_CREDENTIALS_ENV_REF'"
                  [class.badge-neutral]="
                    company.myDataMode === 'ACCOUNTING_OFFICE_AUTHORIZED' &&
                    !company.myDataAuthorized
                  "
                  >{{ myDataModeLabel(company.myDataMode) }}</span
                >
                <small>{{
                  company.myDataAuthorized ? 'Εξουσιοδότηση ενεργή' : 'Θέλει έλεγχο'
                }}</small>
              </td>
              <td>{{ company.taxOffice || '-' }}</td>
              <td class="row-actions">
                <a
                  class="btn btn-sm btn-secondary"
                  [routerLink]="['/companies', company.id, 'edit']"
                  title="Επεξεργασία"
                >
                  <span class="material-symbols-outlined">edit</span>
                </a>
                <button
                  type="button"
                  class="btn btn-sm btn-danger"
                  (click)="deleteCompany(company)"
                  title="Διαγραφή"
                >
                  <span class="material-symbols-outlined">delete</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ng-template #noCompanies>
        <div class="card">
          <div class="empty-state">
            <span class="material-symbols-outlined">groups</span>
            <p>Δεν υπάρχουν εταιρείες ακόμη.</p>
            <a class="btn btn-primary" routerLink="/companies/new">
              <span class="material-symbols-outlined">person_add</span>
              Προσθήκη πρώτου πελάτη
            </a>
          </div>
        </div>
      </ng-template>
    </ng-container>
  `,
  styles: [
    `
      .mono {
        font-family: ui-monospace, monospace;
        font-size: 0.8125rem;
      }

      .row-link {
        font-weight: 600;
        color: var(--primary-t);
      }
      .row-link:hover {
        color: var(--primary);
        text-decoration: underline;
      }

      .row-actions {
        display: flex;
        gap: 6px;
        justify-content: flex-end;
      }
    `,
  ],
})
export class CompaniesListPageComponent {
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly reload$ = new BehaviorSubject<void>(undefined);

  readonly companies$ = this.reload$.pipe(switchMap(() => this.companiesApi.findAll()));

  deleteCompany(company: ClientCompany): void {
    this.companiesApi.delete(company.id).subscribe(() => this.reload$.next());
  }

  entityTypeLabel(entityType: string): string {
    const labels: Record<string, string> = {
      COMPANY: 'Εταιρεία',
      FREELANCER: 'Ελεύθερος επαγγελματίας',
      SOLE_PROPRIETOR: 'Ατομική επιχείρηση',
      NON_PROFIT: 'Μη κερδοσκοπικός',
      OTHER: 'Άλλο',
    };

    return labels[entityType] ?? entityType;
  }

  accountingCategoryLabel(value?: string | null): string {
    const labels: Record<string, string> = {
      SIMPLE_BOOKS: 'Απλογραφικά',
      DOUBLE_ENTRY: 'Διπλογραφικά',
      EXEMPT_BOOKS: 'Χωρίς βιβλία',
    };

    return value ? (labels[value] ?? value) : '-';
  }

  vatRegimeLabel(value?: string | null): string {
    const labels: Record<string, string> = {
      NORMAL: 'Κανονικό ΦΠΑ',
      EXEMPT: 'Απαλλασσόμενο',
      SMALL_BUSINESS: 'Μικρών επιχειρήσεων',
      ARTICLE_39: 'Άρθρο 39',
      INTRA_COMMUNITY: 'Ενδοκοινοτικά',
    };

    return value ? (labels[value] ?? value) : '-';
  }

  myDataModeLabel(value: string): string {
    const labels: Record<string, string> = {
      ACCOUNTING_OFFICE_AUTHORIZED: 'Γραφείο',
      OWN_API_CREDENTIALS_ENV_REF: 'Ίδια credentials',
      MANUAL_UPLOAD: 'Χειροκίνητα',
      NOT_CONFIGURED: 'Αρρύθμιστο',
    };

    return labels[value] ?? value;
  }
}
