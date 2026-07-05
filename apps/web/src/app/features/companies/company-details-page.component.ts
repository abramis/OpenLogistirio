import { AsyncPipe, DatePipe, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { CompaniesApiService } from '../../core/api/companies-api.service';

@Component({
  selector: 'ol-company-details-page',
  standalone: true,
  imports: [AsyncPipe, DatePipe, NgIf, RouterLink],
  template: `
    <ng-container *ngIf="company$ | async as company">
      <section class="page-header">
        <div>
          <h1 class="page-title">{{ company.legalName }}</h1>
          <p class="page-subtitle">
            {{ entityTypeLabel(company.entityType) }}
            <span *ngIf="company.professionLabel"> — {{ company.professionLabel }}</span>
          </p>
        </div>
        <div class="page-actions">
          <a class="btn btn-secondary" routerLink="/companies">
            <span class="material-symbols-outlined">arrow_back</span>
            Πίσω
          </a>
          <a class="btn btn-primary" [routerLink]="['/companies', company.id, 'edit']">
            <span class="material-symbols-outlined">edit</span>
            Επεξεργασία
          </a>
        </div>
      </section>

      <div class="details-grid">
        <div class="card detail-section">
          <div class="card-header">
            <h2 class="card-title">
              <span class="material-symbols-outlined">badge</span>
              Ταυτότητα
            </h2>
          </div>
          <dl class="detail-dl">
            <div class="detail-row">
              <dt>Επωνυμία</dt>
              <dd>{{ company.legalName }}</dd>
            </div>
            <div class="detail-row">
              <dt>Διακριτικός τίτλος</dt>
              <dd>{{ company.tradeName || '—' }}</dd>
            </div>
            <div class="detail-row">
              <dt>Τύπος</dt>
              <dd>{{ entityTypeLabel(company.entityType) }}</dd>
            </div>
            <div class="detail-row">
              <dt>Επάγγελμα</dt>
              <dd>{{ company.professionLabel || '—' }}</dd>
            </div>
          </dl>
        </div>

        <div class="card detail-section">
          <div class="card-header">
            <h2 class="card-title">
              <span class="material-symbols-outlined">account_balance</span>
              Φορολογικά
            </h2>
          </div>
          <dl class="detail-dl">
            <div class="detail-row">
              <dt>ΑΦΜ</dt>
              <dd class="mono">{{ company.vatNumber }}</dd>
            </div>
            <div class="detail-row">
              <dt>ΔΟΥ</dt>
              <dd>{{ company.taxOffice || '—' }}</dd>
            </div>
            <div class="detail-row">
              <dt>ΚΑΔ</dt>
              <dd>{{ company.activityCodes?.join(', ') || '—' }}</dd>
            </div>
            <div class="detail-row">
              <dt>Καθεστώς ΦΠΑ</dt>
              <dd>{{ vatRegimeLabel(company.vatRegime) }}</dd>
            </div>
            <div class="detail-row">
              <dt>Κατηγορία βιβλίων</dt>
              <dd>{{ accountingCategoryLabel(company.accountingCategory) }}</dd>
            </div>
            <div class="detail-row">
              <dt>Φορολογικό έτος</dt>
              <dd>{{ company.fiscalYearStart }} – {{ company.fiscalYearEnd }}</dd>
            </div>
          </dl>
        </div>

        <div class="card detail-section">
          <div class="card-header">
            <h2 class="card-title">
              <span class="material-symbols-outlined">cloud_sync</span>
              AADE myDATA
            </h2>
          </div>
          <dl class="detail-dl">
            <div class="detail-row">
              <dt>Τρόπος διαβίβασης</dt>
              <dd>{{ myDataModeLabel(company.myDataMode) }}</dd>
            </div>
            <div class="detail-row">
              <dt>Εξουσιοδότηση λογιστή</dt>
              <dd>
                <span
                  class="badge"
                  [class.badge-success]="company.myDataAuthorized"
                  [class.badge-neutral]="!company.myDataAuthorized"
                >
                  {{ company.myDataAuthorized ? 'Ενεργή' : 'Δεν έχει σημειωθεί' }}
                </span>
              </dd>
            </div>
            <div class="detail-row">
              <dt>Env credentials ref</dt>
              <dd class="mono">{{ company.myDataCredentialRef || '—' }}</dd>
            </div>
          </dl>
        </div>

        <div class="card detail-section">
          <div class="card-header">
            <h2 class="card-title">
              <span class="material-symbols-outlined">contact_mail</span>
              Επικοινωνία
            </h2>
          </div>
          <dl class="detail-dl">
            <div class="detail-row">
              <dt>Διεύθυνση</dt>
              <dd>{{ company.address || '—' }}</dd>
            </div>
            <div class="detail-row">
              <dt>Email</dt>
              <dd>{{ company.email || '—' }}</dd>
            </div>
            <div class="detail-row">
              <dt>Τηλέφωνο</dt>
              <dd>{{ company.phone || '—' }}</dd>
            </div>
            <div class="detail-row">
              <dt>Τελευταία ενημέρωση</dt>
              <dd>{{ company.updatedAt | date: 'dd/MM/yyyy HH:mm' }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </ng-container>
  `,
  styles: [
    `
      .details-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }

      .detail-section {
        min-width: 0;
      }

      .detail-dl {
        margin: 0;
      }

      .detail-row {
        display: grid;
        grid-template-columns: 140px 1fr;
        gap: 8px;
        padding: 10px 18px;
        border-bottom: 1px solid var(--border);
        font-size: 0.875rem;
        align-items: baseline;
      }
      .detail-row:last-child {
        border-bottom: none;
      }

      dt {
        color: var(--muted);
        font-size: 0.8rem;
        font-weight: 600;
      }
      dd {
        margin: 0;
        font-weight: 500;
      }

      .mono {
        font-family: ui-monospace, monospace;
        font-size: 0.8125rem;
      }

      @media (max-width: 900px) {
        .details-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class CompanyDetailsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly companiesApi = inject(CompaniesApiService);

  readonly company$ = this.route.paramMap.pipe(
    map((params) => params.get('id') ?? ''),
    switchMap((id) => this.companiesApi.findOne(id)),
  );

  entityTypeLabel(entityType: string): string {
    const labels: Record<string, string> = {
      COMPANY: 'Εταιρεία',
      FREELANCER: 'Ελεύθερος επαγγελματίας',
      SOLE_PROPRIETOR: 'Ατομική επιχείρηση',
      NON_PROFIT: 'Μη κερδοσκοπικός φορέας',
      OTHER: 'Άλλο',
    };

    return labels[entityType] ?? entityType;
  }

  accountingCategoryLabel(value?: string | null): string {
    const labels: Record<string, string> = {
      SIMPLE_BOOKS: 'Απλογραφικά',
      DOUBLE_ENTRY: 'Διπλογραφικά',
      EXEMPT_BOOKS: 'Χωρίς τήρηση βιβλίων',
    };

    return value ? (labels[value] ?? value) : '-';
  }

  vatRegimeLabel(value?: string | null): string {
    const labels: Record<string, string> = {
      NORMAL: 'Κανονικό',
      EXEMPT: 'Απαλλασσόμενο',
      SMALL_BUSINESS: 'Μικρών επιχειρήσεων',
      ARTICLE_39: 'Άρθρο 39',
      INTRA_COMMUNITY: 'Ενδοκοινοτικές συναλλαγές',
    };

    return value ? (labels[value] ?? value) : '-';
  }

  myDataModeLabel(value: string): string {
    const labels: Record<string, string> = {
      ACCOUNTING_OFFICE_AUTHORIZED: 'Με εξουσιοδότηση λογιστικού γραφείου',
      OWN_API_CREDENTIALS_ENV_REF: 'Με δικά του API credentials από env',
      MANUAL_UPLOAD: 'Χειροκίνητη αποστολή/ανέβασμα',
      NOT_CONFIGURED: 'Δεν έχει ρυθμιστεί',
    };

    return labels[value] ?? value;
  }
}
