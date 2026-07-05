import { AsyncPipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { map } from 'rxjs';
import { DocumentListItem, DocumentsApiService } from '../../core/api/documents-api.service';

interface VatPeriodRow {
  period: string;
  salesNet: number;
  salesVat: number;
  purchasesNet: number;
  purchasesVat: number;
  payableVat: number;
  documents: number;
}

@Component({
  selector: 'ol-vat-book-page',
  standalone: true,
  imports: [AsyncPipe, DecimalPipe, NgFor, NgIf],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Βιβλίο ΦΠΑ</h1>
        <p class="page-subtitle">Μηνιαία σύνοψη εσόδων, εξόδων και πληρωτέου ΦΠΑ</p>
      </div>
    </section>

    <ng-container *ngIf="rows$ | async as rows">
      <div class="table-wrap" *ngIf="rows.length > 0; else noRows">
        <table>
          <thead>
            <tr>
              <th>Περίοδος</th>
              <th class="tr">Καθ. εσόδων</th>
              <th class="tr">ΦΠΑ εσόδων</th>
              <th class="tr">Καθ. εξόδων</th>
              <th class="tr">ΦΠΑ εξόδων</th>
              <th class="tr">Πληρωτέο ΦΠΑ</th>
              <th class="tr">Παρ.</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of rows">
              <td>
                <strong>{{ row.period }}</strong>
              </td>
              <td class="tr">{{ row.salesNet | number: '1.2-2' }}</td>
              <td class="tr">{{ row.salesVat | number: '1.2-2' }}</td>
              <td class="tr">{{ row.purchasesNet | number: '1.2-2' }}</td>
              <td class="tr">{{ row.purchasesVat | number: '1.2-2' }}</td>
              <td class="tr" [class.credit]="row.payableVat < 0">
                <strong>{{ row.payableVat | number: '1.2-2' }}</strong>
              </td>
              <td class="tr">{{ row.documents }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <ng-template #noRows>
        <div class="card">
          <div class="empty-state">
            <span class="material-symbols-outlined">calculate</span>
            <p>Δεν υπάρχουν παραστατικά ακόμα.</p>
          </div>
        </div>
      </ng-template>
    </ng-container>
  `,
  styles: [
    `
      .tr {
        text-align: right;
      }
      .credit strong {
        color: var(--ok);
      }
    `,
  ],
})
export class VatBookPageComponent {
  private readonly documentsApi = inject(DocumentsApiService);

  readonly rows$ = this.documentsApi.findAll().pipe(map((documents) => toVatRows(documents)));
}

function toVatRows(documents: DocumentListItem[]): VatPeriodRow[] {
  const periods = new Map<string, VatPeriodRow>();

  for (const document of documents) {
    const period = document.issueDate.slice(0, 7);
    const row =
      periods.get(period) ??
      ({
        period,
        salesNet: 0,
        salesVat: 0,
        purchasesNet: 0,
        purchasesVat: 0,
        payableVat: 0,
        documents: 0,
      } satisfies VatPeriodRow);

    const net = Number(document.netAmount || 0);
    const vat = Number(document.vatAmount || 0);

    if (document.documentType === 'PURCHASE_INVOICE') {
      row.purchasesNet += net;
      row.purchasesVat += vat;
    } else {
      row.salesNet += net;
      row.salesVat += vat;
    }

    row.payableVat = row.salesVat - row.purchasesVat;
    row.documents += 1;
    periods.set(period, row);
  }

  return [...periods.values()].sort((a, b) => b.period.localeCompare(a.period));
}
