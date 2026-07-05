import { NgFor } from '@angular/common';
import { Component } from '@angular/core';

interface Capability {
  title: string;
  icon: string;
  status: string;
  items: string[];
}

const capabilities: Capability[] = [
  {
    title: 'Μητρώο πελατών',
    icon: 'groups',
    status: 'Δουλεύει',
    items: [
      'Εταιρείες, ατομικές, ελεύθεροι επαγγελματίες',
      'ΑΦΜ, ΔΟΥ, ΚΑΔ, ΦΠΑ, βιβλία',
      'AADE setup ανά πελάτη',
    ],
  },
  {
    title: 'Παραστατικά & myDATA',
    icon: 'receipt_long',
    status: 'Δουλεύει / test',
    items: [
      'Πωλήσεις, αγορές, πιστωτικά, λιανική',
      'XML preview',
      'AADE test send για έσοδα',
      'Mock receiver flow για έξοδα',
    ],
  },
  {
    title: 'Βιβλίο ΦΠΑ & reports',
    icon: 'calculate',
    status: 'Δουλεύει',
    items: ['Μηνιαία σύνολα', 'ΦΠΑ πωλήσεων/αγορών', 'Πληρωτέο ΦΠΑ', 'Office summary'],
  },
  {
    title: 'Υποχρεώσεις γραφείου',
    icon: 'event_available',
    status: 'Δουλεύει',
    items: ['Προθεσμίες ανά πελάτη', 'myDATA review', 'Περιοδικές ΦΠΑ', 'Status εργασιών'],
  },
  {
    title: 'Πάγια',
    icon: 'inventory_2',
    status: 'Δουλεύει',
    items: ['Μητρώο παγίων', 'Καθαρή αξία/ΦΠΑ', 'Ετήσιες αποσβέσεις', 'Αναπόσβεστη αξία'],
  },
  {
    title: 'Imports',
    icon: 'upload_file',
    status: 'Δουλεύει',
    items: ['CSV παραστατικών', 'Preview πριν την εισαγωγή', 'Import history', 'Errors ανά γραμμή'],
  },
  {
    title: 'Δηλωτικά workpapers',
    icon: 'summarize',
    status: 'Προετοιμασία',
    items: [
      'ΦΠΑ workpaper από παραστατικά',
      'Έλεγχος myDATA fails',
      'Δεν κάνει επίσημη υποβολή ακόμα',
    ],
  },
  {
    title: 'Κρατικές διασυνδέσεις',
    icon: 'hub',
    status: 'Με ασφάλεια',
    items: [
      'Δεν ζητά TAXISnet password',
      'Δεν hardcode-άρει AADE credentials',
      'Παραγωγικό AADE μόνο με επίσημα specs',
    ],
  },
];

@Component({
  selector: 'ol-about-page',
  standalone: true,
  imports: [NgFor],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Τι κάνει η πλατφόρμα</h1>
        <p class="page-subtitle">Γρήγορη εικόνα για τον λογιστή πριν αρχίσει να δουλεύει.</p>
      </div>
    </section>

    <section class="capability-grid">
      <article class="card" *ngFor="let capability of capabilities">
        <div class="card-header">
          <div>
            <h2 class="card-title">
              <span class="material-symbols-outlined">{{ capability.icon }}</span>
              {{ capability.title }}
            </h2>
            <p class="card-subtitle">{{ capability.status }}</p>
          </div>
        </div>
        <div class="card-body">
          <ul>
            <li *ngFor="let item of capability.items">{{ item }}</li>
          </ul>
        </div>
      </article>
    </section>
  `,
  styles: [
    `
      .capability-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }

      ul {
        display: grid;
        gap: 8px;
        margin: 0;
        padding-left: 18px;
        color: var(--text-2);
      }

      li::marker {
        color: var(--primary);
      }

      @media (max-width: 900px) {
        .capability-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AboutPageComponent {
  readonly capabilities = capabilities;
}
