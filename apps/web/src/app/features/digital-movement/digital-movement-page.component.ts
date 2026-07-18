import { DatePipe, DecimalPipe, NgClass, NgFor, NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ClientCompany, CompaniesApiService } from '../../core/api/companies-api.service';
import {
  DigitalMovementApiService,
  DispatchLifecycleEvent,
  DispatchNote,
  DispatchNotePayload,
  InventoryItem,
  StockMovement,
  Vehicle,
  Warehouse,
  WarehouseStock,
} from '../../core/api/digital-movement-api.service';

type Tab = 'dispatch' | 'stock' | 'items' | 'warehouses' | 'vehicles';

@Component({
  selector: 'ol-digital-movement-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, NgClass, NgFor, NgIf],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Ψηφιακή Διακίνηση</h1>
        <p class="page-subtitle">
          Δελτία αποστολής, αποθήκες, είδη, οχήματα και ποσοτική παρακολούθηση.
        </p>
      </div>
      <div class="page-actions">
        <select [(ngModel)]="clientCompanyId" (ngModelChange)="reload()">
          <option value="">Όλες οι εταιρείες</option>
          <option *ngFor="let company of companies" [value]="company.id">
            {{ company.legalName }} — {{ company.vatNumber }}
          </option>
        </select>
      </div>
    </section>

    <div class="alert alert-success" *ngIf="message">{{ message }}</div>
    <div class="alert alert-danger" *ngIf="errorMessage">{{ errorMessage }}</div>

    <nav class="tabs">
      <button type="button" [class.active]="tab === 'dispatch'" (click)="tab = 'dispatch'">
        Δελτία αποστολής
      </button>
      <button type="button" [class.active]="tab === 'stock'" (click)="tab = 'stock'">
        Υπόλοιπα
      </button>
      <button type="button" [class.active]="tab === 'items'" (click)="tab = 'items'">Είδη</button>
      <button type="button" [class.active]="tab === 'warehouses'" (click)="tab = 'warehouses'">
        Αποθήκες
      </button>
      <button type="button" [class.active]="tab === 'vehicles'" (click)="tab = 'vehicles'">
        Οχήματα
      </button>
    </nav>

    <ng-container *ngIf="tab === 'dispatch'">
      <section class="card form-card">
        <div class="card-header">
          <div>
            <h2 class="card-title">
              <span class="material-symbols-outlined">local_shipping</span>
              Νέο δελτίο αποστολής
            </h2>
            <p class="card-subtitle">
              Αποθηκεύεται ως draft. Η έκδοση αφαιρεί τις ποσότητες από την αποθήκη φόρτωσης.
            </p>
          </div>
        </div>
        <form class="card-body form-grid" (ngSubmit)="createDispatch()">
          <label>
            Εταιρεία
            <select
              [(ngModel)]="dispatchForm.clientCompanyId"
              name="dispatchCompany"
              required
              (ngModelChange)="onDispatchCompanyChange()"
            >
              <option value="">Επιλογή</option>
              <option *ngFor="let company of companies" [value]="company.id">
                {{ company.legalName }}
              </option>
            </select>
          </label>
          <label>
            Σειρά
            <input [(ngModel)]="dispatchForm.series" name="series" required />
          </label>
          <label>
            Αριθμός
            <input [(ngModel)]="dispatchForm.number" name="number" required />
          </label>
          <label>
            Ημερομηνία έκδοσης
            <input [(ngModel)]="dispatchForm.issueDate" name="issueDate" type="date" required />
          </label>
          <label>
            Προγραμματισμένη αναχώρηση
            <input
              [(ngModel)]="dispatchForm.plannedDispatchAt"
              name="plannedDispatchAt"
              type="datetime-local"
              required
            />
          </label>
          <label>
            Σκοπός διακίνησης ΑΑΔΕ
            <select [(ngModel)]="dispatchForm.movePurpose" name="movePurpose" required>
              <option *ngFor="let purpose of purposes" [ngValue]="purpose.code">
                {{ purpose.code }} — {{ purpose.label }}
              </option>
            </select>
          </label>
          <label *ngIf="dispatchForm.movePurpose === 19">
            Τίτλος λοιπής διακίνησης
            <input [(ngModel)]="dispatchForm.otherMovePurposeTitle" name="otherPurpose" required />
          </label>
          <label>
            Αποθήκη φόρτωσης
            <select
              [(ngModel)]="dispatchForm.loadingWarehouseId"
              name="loadingWarehouse"
              required
              (ngModelChange)="setLoadingAddress()"
            >
              <option value="">Επιλογή</option>
              <option *ngFor="let warehouse of dispatchWarehouses()" [value]="warehouse.id">
                {{ warehouse.code }} — {{ warehouse.name }}
              </option>
            </select>
          </label>
          <label>
            Αποθήκη παραλαβής (ενδοδιακίνηση)
            <select
              [(ngModel)]="dispatchForm.deliveryWarehouseId"
              name="deliveryWarehouse"
              (ngModelChange)="setDeliveryAddress()"
            >
              <option value="">Εξωτερικός παραλήπτης</option>
              <option
                *ngFor="let warehouse of dispatchWarehouses()"
                [value]="warehouse.id"
                [disabled]="warehouse.id === dispatchForm.loadingWarehouseId"
              >
                {{ warehouse.code }} — {{ warehouse.name }}
              </option>
            </select>
          </label>
          <label>
            Όχημα
            <select [(ngModel)]="dispatchForm.vehicleId" name="vehicleId">
              <option value="">Χωρίς master vehicle</option>
              <option *ngFor="let vehicle of dispatchVehicles()" [value]="vehicle.id">
                {{ vehicle.registrationNumber }} {{ vehicle.description || '' }}
              </option>
            </select>
          </label>
          <label>
            Παραλήπτης
            <input [(ngModel)]="dispatchForm.recipientName" name="recipientName" />
          </label>
          <label>
            ΑΦΜ παραλήπτη
            <input [(ngModel)]="dispatchForm.recipientVatNumber" name="recipientVatNumber" />
          </label>
          <label class="wide">
            Διεύθυνση φόρτωσης
            <input [(ngModel)]="dispatchForm.loadingAddress" name="loadingAddress" />
          </label>
          <label class="wide">
            Διεύθυνση παράδοσης
            <input [(ngModel)]="dispatchForm.deliveryAddress" name="deliveryAddress" required />
          </label>

          <div class="wide lines-panel">
            <div class="lines-title">
              <strong>Γραμμές ειδών</strong>
              <button class="btn btn-sm btn-secondary" type="button" (click)="addLine()">
                + Γραμμή
              </button>
            </div>
            <div class="line-row" *ngFor="let line of dispatchForm.lines; let i = index">
              <select [(ngModel)]="line.itemId" [name]="'lineItem' + i" required>
                <option value="">Επιλογή είδους</option>
                <option *ngFor="let item of dispatchItems()" [value]="item.id">
                  {{ item.code }} — {{ item.name }}
                </option>
              </select>
              <input
                [(ngModel)]="line.quantity"
                [name]="'lineQuantity' + i"
                type="number"
                min="0.001"
                step="0.001"
                required
              />
              <button
                class="btn btn-xs btn-danger"
                type="button"
                [disabled]="dispatchForm.lines.length === 1"
                (click)="removeLine(i)"
              >
                Αφαίρεση
              </button>
            </div>
          </div>

          <label class="wide">
            Σημειώσεις
            <textarea [(ngModel)]="dispatchForm.notes" name="dispatchNotes" rows="2"></textarea>
          </label>
          <div class="wide form-actions">
            <button class="btn btn-primary" type="submit" [disabled]="busy">
              <span class="material-symbols-outlined">save</span>
              Αποθήκευση draft
            </button>
          </div>
        </form>
      </section>

      <section class="card form-card" *ngIf="receivingNote as note">
        <div class="card-header">
          <div>
            <h2 class="card-title">
              <span class="material-symbols-outlined">fact_check</span>
              Παραλαβή {{ note.series }}-{{ note.number }}
            </h2>
            <p class="card-subtitle">
              Καταχώρισε τις πραγματικά αποδεκτές και απορριφθείσες ποσότητες.
            </p>
          </div>
        </div>
        <form class="card-body" (ngSubmit)="submitReceipt()">
          <div class="receipt-row receipt-head">
            <strong>Είδος</strong><strong>Απεστάλη</strong><strong>Παραλήφθηκε</strong
            ><strong>Απορρίφθηκε</strong><strong>Έλλειμμα</strong>
          </div>
          <div class="receipt-row" *ngFor="let line of receiptForm.lines; let i = index">
            <span>{{ line.itemCode }} — {{ line.description }}</span>
            <span>{{ line.orderedQuantity | number: '1.0-3' }}</span>
            <input
              [(ngModel)]="line.acceptedQuantity"
              [name]="'accepted' + i"
              type="number"
              min="0"
              step="0.001"
              required
            />
            <input
              [(ngModel)]="line.rejectedQuantity"
              [name]="'rejected' + i"
              type="number"
              min="0"
              step="0.001"
              required
            />
            <span>{{ receiptMissing(line) | number: '1.0-3' }}</span>
            <input
              class="receipt-note"
              [(ngModel)]="line.qualityNotes"
              [name]="'qualityNotes' + i"
              placeholder="Παρατήρηση ποιότητας / απόκλισης"
            />
          </div>
          <div class="receipt-options">
            <label>
              Σημειώσεις παραλαβής
              <textarea [(ngModel)]="receiptForm.notes" name="receiptNotes" rows="2"></textarea>
            </label>
            <label class="check-label">
              <input
                [(ngModel)]="receiptForm.deliveredWithoutRecipient"
                name="deliveredWithoutRecipient"
                type="checkbox"
              />
              Παράδοση χωρίς παρουσία παραλήπτη
            </label>
          </div>
          <div class="form-actions">
            <button class="btn btn-secondary" type="button" (click)="receivingNote = undefined">
              Κλείσιμο
            </button>
            <button class="btn btn-primary" type="submit" [disabled]="busy">
              Οριστικοποίηση παραλαβής
            </button>
          </div>
        </form>
      </section>

      <section class="card form-card" *ngIf="historyNote as note">
        <div class="card-header">
          <h2 class="card-title">Ιστορικό {{ note.series }}-{{ note.number }}</h2>
          <button class="btn btn-xs btn-secondary" type="button" (click)="historyNote = undefined">
            Κλείσιμο
          </button>
        </div>
        <div class="card-body timeline">
          <div *ngFor="let event of note.lifecycleEvents">
            <strong>{{ eventLabel(event.eventType) }}</strong>
            <span>{{ event.eventAt | date: 'dd/MM/yyyy HH:mm:ss' }}</span>
          </div>
          <div *ngIf="note.lifecycleEvents.length === 0">Δεν υπάρχουν καταχωρισμένα γεγονότα.</div>
        </div>
        <div class="card-body receipt-summary" *ngIf="note.deliveryReceipt as receipt">
          <strong>
            Αποτέλεσμα παραλαβής: {{ receiptOutcomeLabel(receipt.outcome) }} —
            {{ receipt.receivedAt | date: 'dd/MM/yyyy HH:mm' }}
          </strong>
          <div *ngFor="let line of receipt.lines">
            <span>{{ receiptLineLabel(note, line.dispatchNoteLineId) }}</span>
            <span>Απεστάλη: {{ line.orderedQuantity | number: '1.0-3' }}</span>
            <span>Παραλήφθηκε: {{ line.acceptedQuantity | number: '1.0-3' }}</span>
            <span>Απορρίφθηκε: {{ line.rejectedQuantity | number: '1.0-3' }}</span>
            <span>Έλλειμμα: {{ line.missingQuantity | number: '1.0-3' }}</span>
          </div>
        </div>
      </section>

      <section class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Δελτίο</th>
              <th>Διακίνηση</th>
              <th>Διαδρομή</th>
              <th>Είδη</th>
              <th>Κατάσταση</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let note of dispatchNotes">
              <td>
                <strong>{{ note.series }}-{{ note.number }}</strong
                ><small>{{ note.clientCompany.legalName }}</small>
              </td>
              <td>
                {{ note.plannedDispatchAt | date: 'dd/MM/yyyy HH:mm'
                }}<small>{{ purposeLabel(note.movePurpose) }}</small>
              </td>
              <td>
                {{ note.loadingWarehouse.name }} →
                {{ note.deliveryWarehouse?.name || note.recipientName || 'Παραλήπτης'
                }}<small>{{ note.vehicleNumber || '-' }}</small>
              </td>
              <td>
                {{ note.lines.length }} γραμμές<small
                  >{{ totalQuantity(note) | number: '1.0-3' }} συνολική ποσότητα</small
                >
              </td>
              <td>
                <span class="badge" [ngClass]="statusClass(note.status)">{{
                  statusLabel(note.status)
                }}</span>
              </td>
              <td class="row-actions">
                <button
                  *ngIf="note.status === 'DRAFT'"
                  class="btn btn-xs btn-primary"
                  type="button"
                  (click)="transition(note, 'issue')"
                >
                  Έκδοση
                </button>
                <button
                  *ngIf="note.status === 'ISSUED'"
                  class="btn btn-xs btn-primary"
                  type="button"
                  (click)="openReceipt(note)"
                >
                  Παραλαβή
                </button>
                <button class="btn btn-xs btn-secondary" type="button" (click)="historyNote = note">
                  Ιστορικό
                </button>
                <button
                  *ngIf="note.status !== 'CANCELLED'"
                  class="btn btn-xs btn-danger"
                  type="button"
                  (click)="transition(note, 'cancel')"
                >
                  Ακύρωση
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="empty-state" *ngIf="dispatchNotes.length === 0">
          Δεν υπάρχουν δελτία αποστολής.
        </div>
      </section>
    </ng-container>

    <ng-container *ngIf="tab === 'stock'">
      <section class="card form-card">
        <div class="card-header">
          <h2 class="card-title">
            <span class="material-symbols-outlined">tune</span>Αρχικό υπόλοιπο / διόρθωση
          </h2>
        </div>
        <form class="card-body compact-grid" (ngSubmit)="adjustStock()">
          <select [(ngModel)]="stockForm.warehouseId" name="stockWarehouse" required>
            <option value="">Αποθήκη</option>
            <option *ngFor="let warehouse of warehouses" [value]="warehouse.id">
              {{ warehouse.clientCompany?.legalName }} — {{ warehouse.code }}
            </option>
          </select>
          <select [(ngModel)]="stockForm.itemId" name="stockItem" required>
            <option value="">Είδος</option>
            <option *ngFor="let item of stockItems()" [value]="item.id">
              {{ item.code }} — {{ item.name }}
            </option>
          </select>
          <input
            [(ngModel)]="stockForm.quantity"
            name="stockQuantity"
            type="number"
            step="0.001"
            placeholder="Μεταβολή (+/-)"
            required
          />
          <input [(ngModel)]="stockForm.reason" name="stockReason" placeholder="Αιτιολογία" />
          <button class="btn btn-primary" type="submit">Καταχώριση</button>
        </form>
      </section>
      <section class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Αποθήκη</th>
              <th>Είδος</th>
              <th>Μονάδα</th>
              <th>Υπόλοιπο</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of stock">
              <td>{{ row.warehouse.code }} — {{ row.warehouse.name }}</td>
              <td>
                <strong>{{ row.item.code }}</strong
                ><small>{{ row.item.name }}</small>
              </td>
              <td>{{ unitLabel(row.item.measurementUnit) }}</td>
              <td>
                <strong>{{ row.quantity | number: '1.0-3' }}</strong>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="empty-state" *ngIf="stock.length === 0">
          Δεν υπάρχουν καταχωρισμένα υπόλοιπα.
        </div>
      </section>
      <section class="table-wrap ledger">
        <div class="table-title">Αναλυτικό καθολικό κινήσεων</div>
        <table>
          <thead>
            <tr>
              <th>Ημερομηνία</th>
              <th>Αποθήκη</th>
              <th>Είδος</th>
              <th>Κίνηση</th>
              <th>Δελτίο</th>
              <th>Ποσότητα</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let movement of stockMovements">
              <td>{{ movement.occurredAt | date: 'dd/MM/yyyy HH:mm' }}</td>
              <td>{{ movement.warehouse.code }}</td>
              <td>{{ movement.item.code }} — {{ movement.item.name }}</td>
              <td>{{ movementKindLabel(movement.kind) }}</td>
              <td>
                {{ movement.dispatchNote
                  ? movement.dispatchNote.series + '-' + movement.dispatchNote.number
                  : '-' }}
              </td>
              <td [class.positive]="movement.signedQuantity > 0" [class.negative]="movement.signedQuantity < 0">
                {{ movement.signedQuantity | number: '1.0-3' }}
              </td>
            </tr>
          </tbody>
        </table>
        <div class="empty-state" *ngIf="stockMovements.length === 0">
          Δεν υπάρχουν κινήσεις αποθήκης.
        </div>
      </section>
    </ng-container>

    <ng-container *ngIf="tab === 'items'">
      <section class="card form-card">
        <div class="card-header">
          <h2 class="card-title">
            <span class="material-symbols-outlined">inventory_2</span>Νέο είδος
          </h2>
        </div>
        <form class="card-body compact-grid" (ngSubmit)="createItem()">
          <select [(ngModel)]="itemForm.clientCompanyId" name="itemCompany" required>
            <option value="">Εταιρεία</option>
            <option *ngFor="let company of companies" [value]="company.id">
              {{ company.legalName }}
            </option>
          </select>
          <input [(ngModel)]="itemForm.code" name="itemCode" placeholder="Κωδικός" required />
          <input
            [(ngModel)]="itemForm.name"
            name="itemName"
            placeholder="Περιγραφή είδους"
            required
          />
          <select [(ngModel)]="itemForm.measurementUnit" name="itemUnit">
            <option *ngFor="let unit of units" [ngValue]="unit.code">{{ unit.label }}</option>
          </select>
          <button class="btn btn-primary" type="submit">Προσθήκη</button>
        </form>
      </section>
      <section class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Κωδικός</th>
              <th>Είδος</th>
              <th>Εταιρεία</th>
              <th>Μονάδα</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of items">
              <td>
                <strong>{{ item.code }}</strong>
              </td>
              <td>{{ item.name }}</td>
              <td>{{ item.clientCompany?.legalName }}</td>
              <td>{{ unitLabel(item.measurementUnit) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </ng-container>

    <ng-container *ngIf="tab === 'warehouses'">
      <section class="card form-card">
        <div class="card-header">
          <h2 class="card-title">
            <span class="material-symbols-outlined">warehouse</span>Νέα αποθήκη
          </h2>
        </div>
        <form class="card-body compact-grid" (ngSubmit)="createWarehouse()">
          <select [(ngModel)]="warehouseForm.clientCompanyId" name="warehouseCompany" required>
            <option value="">Εταιρεία</option>
            <option *ngFor="let company of companies" [value]="company.id">
              {{ company.legalName }}
            </option>
          </select>
          <input
            [(ngModel)]="warehouseForm.code"
            name="warehouseCode"
            placeholder="Κωδικός"
            required
          />
          <input
            [(ngModel)]="warehouseForm.name"
            name="warehouseName"
            placeholder="Ονομασία"
            required
          />
          <input
            [(ngModel)]="warehouseForm.address"
            name="warehouseAddress"
            placeholder="Διεύθυνση"
          />
          <button class="btn btn-primary" type="submit">Προσθήκη</button>
        </form>
      </section>
      <section class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Κωδικός</th>
              <th>Αποθήκη</th>
              <th>Εταιρεία</th>
              <th>Διεύθυνση</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let warehouse of warehouses">
              <td>
                <strong>{{ warehouse.code }}</strong>
              </td>
              <td>{{ warehouse.name }}</td>
              <td>{{ warehouse.clientCompany?.legalName }}</td>
              <td>{{ warehouse.address || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </ng-container>

    <ng-container *ngIf="tab === 'vehicles'">
      <section class="card form-card">
        <div class="card-header">
          <h2 class="card-title">
            <span class="material-symbols-outlined">local_shipping</span>Νέο όχημα
          </h2>
        </div>
        <form class="card-body compact-grid" (ngSubmit)="createVehicle()">
          <select [(ngModel)]="vehicleForm.clientCompanyId" name="vehicleCompany" required>
            <option value="">Εταιρεία</option>
            <option *ngFor="let company of companies" [value]="company.id">
              {{ company.legalName }}
            </option>
          </select>
          <input
            [(ngModel)]="vehicleForm.registrationNumber"
            name="registrationNumber"
            placeholder="Αριθμός κυκλοφορίας"
            required
          />
          <input
            [(ngModel)]="vehicleForm.vehicleType"
            name="vehicleType"
            placeholder="Τύπος (VAN, TRUCK...)"
          />
          <input
            [(ngModel)]="vehicleForm.description"
            name="vehicleDescription"
            placeholder="Περιγραφή"
          />
          <button class="btn btn-primary" type="submit">Προσθήκη</button>
        </form>
      </section>
      <section class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Αριθμός</th>
              <th>Τύπος</th>
              <th>Εταιρεία</th>
              <th>Περιγραφή</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let vehicle of vehicles">
              <td>
                <strong>{{ vehicle.registrationNumber }}</strong>
              </td>
              <td>{{ vehicle.vehicleType || '-' }}</td>
              <td>{{ vehicle.clientCompany?.legalName }}</td>
              <td>{{ vehicle.description || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </ng-container>
  `,
  styles: [
    `
      .tabs {
        display: flex;
        gap: 4px;
        margin-bottom: 16px;
        border-bottom: 1px solid var(--border);
      }
      .tabs button {
        border: 0;
        border-bottom: 2px solid transparent;
        background: transparent;
        padding: 10px 14px;
        color: var(--muted);
        cursor: pointer;
        font-weight: 600;
      }
      .tabs button.active {
        color: var(--primary);
        border-bottom-color: var(--primary);
      }
      .form-card {
        margin-bottom: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }
      .compact-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 10px;
        align-items: end;
      }
      label {
        display: grid;
        gap: 5px;
        color: var(--muted);
        font-size: 0.75rem;
        font-weight: 700;
      }
      .wide {
        grid-column: 1 / -1;
      }
      .form-actions {
        display: flex;
        justify-content: flex-end;
      }
      .lines-panel {
        border: 1px solid var(--border);
        border-radius: 7px;
        padding: 12px;
        background: var(--surface-2);
      }
      .lines-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .line-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 160px auto;
        gap: 8px;
        margin-top: 7px;
      }
      .receipt-row {
        display: grid;
        grid-template-columns: minmax(220px, 2fr) repeat(4, minmax(100px, 1fr));
        gap: 8px;
        align-items: center;
        padding: 7px 0;
        border-bottom: 1px solid var(--border);
      }
      .receipt-head {
        color: var(--muted);
        font-size: 0.75rem;
      }
      .receipt-note {
        grid-column: 1 / -1;
      }
      .receipt-options {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 16px;
        margin: 14px 0;
      }
      .check-label {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .timeline {
        display: grid;
        gap: 8px;
      }
      .timeline > div {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        border-left: 3px solid var(--primary);
        padding: 5px 10px;
      }
      .receipt-summary {
        border-top: 1px solid var(--border);
        display: grid;
        gap: 8px;
      }
      .receipt-summary > div {
        display: grid;
        grid-template-columns: 2fr repeat(4, 1fr);
        gap: 8px;
        font-size: 0.82rem;
      }
      .table-title {
        padding: 14px;
        font-weight: 700;
      }
      .ledger {
        margin-top: 16px;
      }
      .positive {
        color: var(--success);
        font-weight: 700;
      }
      .negative {
        color: var(--danger);
        font-weight: 700;
      }
      td small {
        display: block;
        color: var(--muted);
        margin-top: 2px;
      }
      .row-actions {
        display: flex;
        gap: 5px;
        justify-content: flex-end;
      }
      @media (max-width: 1000px) {
        .form-grid,
        .compact-grid {
          grid-template-columns: 1fr 1fr;
        }
      }
      @media (max-width: 680px) {
        .form-grid,
        .compact-grid,
        .line-row,
        .receipt-row,
        .receipt-options,
        .receipt-summary > div {
          grid-template-columns: 1fr;
        }
        .tabs {
          overflow-x: auto;
        }
      }
    `,
  ],
})
export class DigitalMovementPageComponent implements OnInit {
  private readonly api = inject(DigitalMovementApiService);
  private readonly companiesApi = inject(CompaniesApiService);

  tab: Tab = 'dispatch';
  clientCompanyId = '';
  companies: ClientCompany[] = [];
  items: InventoryItem[] = [];
  warehouses: Warehouse[] = [];
  vehicles: Vehicle[] = [];
  dispatchNotes: DispatchNote[] = [];
  stock: WarehouseStock[] = [];
  stockMovements: StockMovement[] = [];
  receivingNote?: DispatchNote;
  historyNote?: DispatchNote;
  receiptForm = this.emptyReceiptForm();
  busy = false;
  message = '';
  errorMessage = '';

  readonly units = [
    { code: 1, label: 'Τεμάχια' },
    { code: 2, label: 'Κιλά' },
    { code: 3, label: 'Λίτρα' },
    { code: 4, label: 'Μέτρα' },
    { code: 5, label: 'Τετραγωνικά μέτρα' },
    { code: 6, label: 'Κυβικά μέτρα' },
    { code: 7, label: 'Τεμάχια / λοιπές περιπτώσεις' },
  ];
  readonly purposes = [
    { code: 1, label: 'Πώληση' },
    { code: 2, label: 'Πώληση για λογαριασμό τρίτων' },
    { code: 3, label: 'Δειγματισμός' },
    { code: 4, label: 'Έκθεση' },
    { code: 5, label: 'Επιστροφή' },
    { code: 7, label: 'Επεξεργασία / συναρμολόγηση / αποσυναρμολόγηση' },
    { code: 8, label: 'Ενδοδιακίνηση' },
    { code: 9, label: 'Αγορά' },
    { code: 10, label: 'Εφοδιασμός πλοίων και αεροσκαφών' },
    { code: 11, label: 'Δωρεάν διάθεση' },
    { code: 12, label: 'Εγγύηση' },
    { code: 13, label: 'Χρησιδανεισμός' },
    { code: 14, label: 'Αποθήκευση σε τρίτους' },
    { code: 19, label: 'Λοιπές διακινήσεις' },
    { code: 20, label: 'Μεταφορές – ταχυμεταφορές' },
  ];

  itemForm = { clientCompanyId: '', code: '', name: '', measurementUnit: 1 };
  warehouseForm = { clientCompanyId: '', code: '', name: '', address: '' };
  vehicleForm = { clientCompanyId: '', registrationNumber: '', vehicleType: '', description: '' };
  stockForm = { warehouseId: '', itemId: '', quantity: 0, reason: '' };
  dispatchForm = this.emptyDispatchForm();

  ngOnInit(): void {
    this.companiesApi.findAll().subscribe({
      next: (companies) => {
        this.companies = companies;
        this.reload();
      },
      error: (error) => this.handleError(error),
    });
  }

  reload(): void {
    forkJoin({
      items: this.api.findItems(this.clientCompanyId),
      warehouses: this.api.findWarehouses(this.clientCompanyId),
      vehicles: this.api.findVehicles(this.clientCompanyId),
      dispatchNotes: this.api.findDispatchNotes(this.clientCompanyId),
      stock: this.api.findStock(this.clientCompanyId),
      stockMovements: this.api.findStockMovements(this.clientCompanyId),
    }).subscribe({
      next: (data) => {
        Object.assign(this, data);
        this.errorMessage = '';
      },
      error: (error) => this.handleError(error),
    });
  }

  createItem(): void {
    this.api.createItem({ ...this.itemForm, trackInventory: true }).subscribe({
      next: () => {
        this.itemForm = {
          clientCompanyId: this.itemForm.clientCompanyId,
          code: '',
          name: '',
          measurementUnit: 1,
        };
        this.done('Το είδος καταχωρίστηκε.');
      },
      error: (error) => this.handleError(error),
    });
  }

  createWarehouse(): void {
    this.api.createWarehouse(this.warehouseForm).subscribe({
      next: () => {
        this.warehouseForm = {
          clientCompanyId: this.warehouseForm.clientCompanyId,
          code: '',
          name: '',
          address: '',
        };
        this.done('Η αποθήκη καταχωρίστηκε.');
      },
      error: (error) => this.handleError(error),
    });
  }

  createVehicle(): void {
    this.api.createVehicle(this.vehicleForm).subscribe({
      next: () => {
        this.vehicleForm = {
          clientCompanyId: this.vehicleForm.clientCompanyId,
          registrationNumber: '',
          vehicleType: '',
          description: '',
        };
        this.done('Το όχημα καταχωρίστηκε.');
      },
      error: (error) => this.handleError(error),
    });
  }

  adjustStock(): void {
    const warehouse = this.warehouses.find((row) => row.id === this.stockForm.warehouseId);
    const item = this.items.find((row) => row.id === this.stockForm.itemId);
    if (!warehouse || !item || warehouse.clientCompanyId !== item.clientCompanyId) {
      this.errorMessage = 'Η αποθήκη και το είδος πρέπει να ανήκουν στην ίδια εταιρεία.';
      return;
    }
    this.api.adjustStock(this.stockForm).subscribe({
      next: () => {
        this.stockForm.quantity = 0;
        this.stockForm.reason = '';
        this.done('Το υπόλοιπο ενημερώθηκε.');
      },
      error: (error) => this.handleError(error),
    });
  }

  createDispatch(): void {
    this.busy = true;
    const payload: DispatchNotePayload = {
      ...this.dispatchForm,
      plannedDispatchAt: new Date(this.dispatchForm.plannedDispatchAt).toISOString(),
      otherMovePurposeTitle:
        this.dispatchForm.movePurpose === 19 ? this.dispatchForm.otherMovePurposeTitle : undefined,
      deliveryWarehouseId: this.dispatchForm.deliveryWarehouseId || undefined,
      vehicleId: this.dispatchForm.vehicleId || undefined,
      lines: this.dispatchForm.lines.map((line) => ({
        itemId: line.itemId,
        quantity: Number(line.quantity),
      })),
    };
    this.api.createDispatchNote(payload).subscribe({
      next: () => {
        const companyId = this.dispatchForm.clientCompanyId;
        this.dispatchForm = this.emptyDispatchForm();
        this.dispatchForm.clientCompanyId = companyId;
        this.busy = false;
        this.done('Το δελτίο αποθηκεύτηκε ως draft.');
      },
      error: (error) => {
        this.busy = false;
        this.handleError(error);
      },
    });
  }

  transition(note: DispatchNote, action: 'issue' | 'cancel'): void {
    const labels = { issue: 'έκδοση', cancel: 'ακύρωση' };
    if (!confirm(`Επιβεβαίωση για ${labels[action]} του ${note.series}-${note.number};`)) return;
    this.api[action](note.id).subscribe({
      next: () => this.done(`Η ${labels[action]} ολοκληρώθηκε.`),
      error: (error) => this.handleError(error),
    });
  }

  openReceipt(note: DispatchNote): void {
    this.receivingNote = note;
    this.receiptForm = {
      deliveredWithoutRecipient: false,
      notes: '',
      lines: note.lines.map((line) => ({
        dispatchNoteLineId: line.id,
        itemCode: line.itemCode,
        description: line.description,
        orderedQuantity: Number(line.quantity),
        acceptedQuantity: Number(line.quantity),
        rejectedQuantity: 0,
        qualityNotes: '',
      })),
    };
  }

  submitReceipt(): void {
    if (!this.receivingNote) return;
    const invalid = this.receiptForm.lines.some(
      (line) =>
        Number(line.acceptedQuantity) < 0 ||
        Number(line.rejectedQuantity) < 0 ||
        Number(line.acceptedQuantity) + Number(line.rejectedQuantity) > line.orderedQuantity,
    );
    if (invalid) {
      this.errorMessage =
        'Οι παραληφθείσες και απορριφθείσες ποσότητες δεν μπορούν να υπερβαίνουν τις απεσταλμένες.';
      return;
    }
    this.busy = true;
    this.api
      .complete(this.receivingNote.id, {
        deliveredWithoutRecipient: this.receiptForm.deliveredWithoutRecipient,
        notes: this.receiptForm.notes || undefined,
        lines: this.receiptForm.lines.map((line) => ({
          dispatchNoteLineId: line.dispatchNoteLineId,
          acceptedQuantity: Number(line.acceptedQuantity),
          rejectedQuantity: Number(line.rejectedQuantity),
          qualityNotes: line.qualityNotes || undefined,
        })),
      })
      .subscribe({
        next: () => {
          this.busy = false;
          this.receivingNote = undefined;
          this.done('Η πραγματική παραλαβή και οι αποκλίσεις καταχωρίστηκαν.');
        },
        error: (error) => {
          this.busy = false;
          this.handleError(error);
        },
      });
  }

  receiptMissing(line: { orderedQuantity: number; acceptedQuantity: number; rejectedQuantity: number }) {
    return Math.max(
      0,
      Number(line.orderedQuantity) -
        Number(line.acceptedQuantity) -
        Number(line.rejectedQuantity),
    );
  }

  addLine(): void {
    this.dispatchForm.lines.push({ itemId: '', quantity: 1 });
  }
  removeLine(index: number): void {
    if (this.dispatchForm.lines.length > 1) this.dispatchForm.lines.splice(index, 1);
  }
  onDispatchCompanyChange(): void {
    this.dispatchForm.loadingWarehouseId = '';
    this.dispatchForm.deliveryWarehouseId = '';
    this.dispatchForm.vehicleId = '';
    this.dispatchForm.lines = [{ itemId: '', quantity: 1 }];
  }
  dispatchItems(): InventoryItem[] {
    return this.items.filter(
      (row) => row.clientCompanyId === this.dispatchForm.clientCompanyId && row.isActive,
    );
  }
  dispatchWarehouses(): Warehouse[] {
    return this.warehouses.filter(
      (row) => row.clientCompanyId === this.dispatchForm.clientCompanyId && row.isActive,
    );
  }
  dispatchVehicles(): Vehicle[] {
    return this.vehicles.filter(
      (row) => row.clientCompanyId === this.dispatchForm.clientCompanyId && row.isActive,
    );
  }
  stockItems(): InventoryItem[] {
    const warehouse = this.warehouses.find((row) => row.id === this.stockForm.warehouseId);
    return warehouse
      ? this.items.filter(
          (row) => row.clientCompanyId === warehouse.clientCompanyId && row.trackInventory,
        )
      : this.items.filter((row) => row.trackInventory);
  }
  setLoadingAddress(): void {
    this.dispatchForm.loadingAddress =
      this.warehouses.find((row) => row.id === this.dispatchForm.loadingWarehouseId)?.address ?? '';
  }
  setDeliveryAddress(): void {
    const warehouse = this.warehouses.find(
      (row) => row.id === this.dispatchForm.deliveryWarehouseId,
    );
    if (warehouse) this.dispatchForm.deliveryAddress = warehouse.address ?? '';
  }
  totalQuantity(note: DispatchNote): number {
    return note.lines.reduce((sum, line) => sum + Number(line.quantity), 0);
  }
  purposeLabel(code: number): string {
    return this.purposes.find((row) => row.code === code)?.label ?? `Κωδικός ${code}`;
  }
  unitLabel(code: number): string {
    return this.units.find((row) => row.code === code)?.label ?? `Κωδικός ${code}`;
  }
  statusLabel(status: DispatchNote['status']): string {
    return {
      DRAFT: 'Draft',
      ISSUED: 'Σε διακίνηση',
      COMPLETED: 'Ολοκληρωμένο',
      PARTIALLY_RECEIVED: 'Μερική παραλαβή',
      REJECTED: 'Μη παραληφθέν',
      CANCELLED: 'Ακυρωμένο',
    }[status];
  }
  statusClass(status: DispatchNote['status']): string {
    return {
      DRAFT: 'badge-neutral',
      ISSUED: 'badge-warning',
      COMPLETED: 'badge-success',
      PARTIALLY_RECEIVED: 'badge-warning',
      REJECTED: 'badge-danger',
      CANCELLED: 'badge-danger',
    }[status];
  }
  eventLabel(event: DispatchLifecycleEvent['eventType']): string {
    return {
      CREATED: 'Δημιουργία',
      UPDATED: 'Ενημέρωση draft',
      ISSUED: 'Έκδοση / αναχώρηση',
      DELIVERY_COMPLETED: 'Πλήρης παραλαβή',
      DELIVERY_PARTIAL: 'Μερική παραλαβή',
      DELIVERY_REJECTED: 'Μη παραλαβή',
      CANCELLED: 'Ακύρωση / αντιλογισμός',
    }[event];
  }
  movementKindLabel(kind: StockMovement['kind']): string {
    return {
      ADJUSTMENT: 'Διόρθωση',
      DISPATCH_OUT: 'Αποστολή',
      DELIVERY_IN: 'Παραλαβή',
      CANCEL_OUT_REVERSAL: 'Αντιλογισμός αποστολής',
      CANCEL_IN_REVERSAL: 'Αντιλογισμός παραλαβής',
    }[kind];
  }
  receiptOutcomeLabel(outcome: 'FULL' | 'PARTIAL' | 'NONE'): string {
    return { FULL: 'Πλήρης', PARTIAL: 'Μερική', NONE: 'Μη παραλαβή' }[outcome];
  }
  receiptLineLabel(note: DispatchNote, dispatchNoteLineId: string): string {
    const line = note.lines.find((candidate) => candidate.id === dispatchNoteLineId);
    return line ? `${line.itemCode} — ${line.description}` : dispatchNoteLineId;
  }

  private emptyDispatchForm() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString();
    return {
      clientCompanyId: '',
      series: 'ΔΑ',
      number: '',
      issueDate: local.slice(0, 10),
      plannedDispatchAt: local.slice(0, 16),
      movePurpose: 1,
      otherMovePurposeTitle: '',
      recipientName: '',
      recipientVatNumber: '',
      loadingWarehouseId: '',
      deliveryWarehouseId: '',
      vehicleId: '',
      vehicleNumber: '',
      loadingAddress: '',
      deliveryAddress: '',
      notes: '',
      lines: [{ itemId: '', quantity: 1 }],
    };
  }

  private emptyReceiptForm() {
    return {
      deliveredWithoutRecipient: false,
      notes: '',
      lines: [] as Array<{
        dispatchNoteLineId: string;
        itemCode: string;
        description: string;
        orderedQuantity: number;
        acceptedQuantity: number;
        rejectedQuantity: number;
        qualityNotes: string;
      }>,
    };
  }

  private done(message: string): void {
    this.message = message;
    this.errorMessage = '';
    this.reload();
  }
  private handleError(error: unknown): void {
    const response = error as HttpErrorResponse;
    const body = response.error as { message?: string | string[] } | undefined;
    this.errorMessage = Array.isArray(body?.message)
      ? body.message.join(' · ')
      : (body?.message ?? 'Η ενέργεια απέτυχε.');
    this.message = '';
  }
}
