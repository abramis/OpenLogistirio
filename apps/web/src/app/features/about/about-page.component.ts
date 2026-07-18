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
    status: 'Production pilot με ελεγχόμενες αποστολές',
    items: [
      'Πωλήσεις, αγορές, πιστωτικά, ακυρώσεις και αντικαταστάσεις',
      'Πολλαπλές γραμμές, ΦΠΑ, φόροι, εκπτώσεις, πληρωμές και XML preview',
      'Εισερχόμενα myDATA σε ελεγχόμενα παραστατικά αγορών',
      'Χαρακτηρισμοί εξόδων μόνο μετά από ρητή έγκριση χρήστη',
    ],
  },
  {
    title: 'Βιβλία, ΦΠΑ & κλείσιμο',
    icon: 'calculate',
    status: 'Δουλεύει',
    items: [
      'Βιβλίο εσόδων-εξόδων και λογιστικές εγγραφές',
      'Quarterly VAT workpaper και period-close reviews',
      'Year-end closing entries με supporting documents',
      'Οι φορολογικοί κανόνες χρειάζονται έγκριση λογιστή πριν από πραγματική χρήση',
    ],
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
    items: [
      'CSV και XLSX παραστατικών',
      'Preview, duplicate detection και rollback',
      'Import history και errors ανά γραμμή',
    ],
  },
  {
    title: 'Δηλωτικά workpapers',
    icon: 'summarize',
    status: 'Workpaper και εσωτερική έγκριση',
    items: [
      'ΦΠΑ workpaper από παραστατικά και έλεγχος myDATA αποκλίσεων',
      'Declaration workflow, audit και supporting documents',
      'Δεν κάνει ακόμη επίσημη υποβολή δηλώσεων',
    ],
  },
  {
    title: 'Γνωστοί περιορισμοί',
    icon: 'info',
    status: 'Εκτός τρέχουσας έκδοσης',
    items: [
      'Μισθοδοσία, ΑΠΔ και ΕΡΓΑΝΗ',
      'Επίσημες υποβολές δηλώσεων και πλήρης TAXISnet/ΓΓΠΣ ροή',
      'Το production myDATA write είναι κλειστό εκ προεπιλογής και δεν είναι smoke test',
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
