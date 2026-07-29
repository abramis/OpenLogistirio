import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CompaniesApiService, ClientCompany } from '../../core/api/companies-api.service';
import {
  PayrollApiService,
  PayrollEmployee,
  PayrollErganiDeclaration,
  PayrollErganiDeclarationType,
  PayrollEvent,
  PayrollLeave,
  PayrollPeriod,
  PayrollTermination,
  PayrollWorkspace,
} from '../../core/api/payroll-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ACCOUNTING_CONTROL_ROLES } from '../../core/auth/user-roles';

interface EntryOverrideForm {
  insuranceDays?: number;
  overtimeGross: number;
  nightHours: number;
  sundayHolidayHours: number;
  extraWorkHours: number;
  legalOvertimeHours: number;
  approvedOvertimeHours: number;
  illegalOvertimeHours: number;
  partTimeAdditionalHours: number;
  overtimeErganiProtocol: string;
  bonusGross: number;
  otherGross: number;
  otherDeductions: number;
}

@Component({
  selector: 'ol-payroll-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page-header">
      <div>
        <h1 class="page-title">Μισθοδοσία</h1>
        <p class="page-subtitle">
          Εργαζόμενοι, συμβάσεις, υπολογισμός αποδοχών 2026 και αρχείο ΑΠΔ e-ΕΦΚΑ.
        </p>
      </div>
      <label class="company-picker">
        Επιχείρηση
        <select [(ngModel)]="companyId" (ngModelChange)="loadWorkspace()" name="company">
          <option value="">Επιλέξτε επιχείρηση</option>
          <option *ngFor="let company of companies" [value]="company.id">
            {{ company.legalName }} — {{ company.vatNumber }}
          </option>
        </select>
      </label>
    </section>

    <div class="alert alert-success" *ngIf="message">{{ message }}</div>
    <div class="alert alert-danger" *ngIf="errorMessage">{{ errorMessage }}</div>

    <section class="empty-state card" *ngIf="!companyId">
      <span class="material-symbols-outlined">badge</span>
      <h2>Επιλέξτε εργοδότη</h2>
      <p>Όλα τα στοιχεία μισθοδοσίας τηρούνται χωριστά ανά πελάτη.</p>
    </section>

    <ng-container *ngIf="companyId">
      <nav class="section-tabs">
        <button type="button" [class.active]="tab === 'period'" (click)="tab = 'period'">
          Περίοδος
        </button>
        <button type="button" [class.active]="tab === 'employees'" (click)="tab = 'employees'">
          Εργαζόμενοι
        </button>
        <button type="button" [class.active]="tab === 'ergani'" (click)="tab = 'ergani'">
          ΕΡΓΑΝΗ ΙΙ
        </button>
        <button type="button" [class.active]="tab === 'leaves'" (click)="tab = 'leaves'">Άδειες</button>
        <button type="button" [class.active]="tab === 'terminations'" (click)="tab = 'terminations'">Αποχωρήσεις</button>
        <button type="button" [class.active]="tab === 'settings'" (click)="tab = 'settings'">
          Στοιχεία ΑΠΔ
        </button>
      </nav>

      <section *ngIf="tab === 'settings'" class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Μητρώο εργοδότη e-ΕΦΚΑ</h2>
            <p class="card-subtitle">Υποχρεωτικά στοιχεία εγγραφής τύπου 1 του αρχείου ΑΠΔ.</p>
          </div>
        </div>
        <form class="card-body form-grid" (ngSubmit)="saveSettings()">
          <label>ΑΜΕ <input name="ame" [(ngModel)]="settings.employerRegistryNumber" maxlength="10" required /></label>
          <label>Κωδικός υπηρεσίας υποβολής <input name="officeCode" [(ngModel)]="settings.submissionOfficeCode" maxlength="10" required /></label>
          <label class="wide">Ονομασία υπηρεσίας <input name="officeName" [(ngModel)]="settings.submissionOfficeName" maxlength="50" required /></label>
          <label>Οδός <input name="street" [(ngModel)]="settings.street" maxlength="50" required /></label>
          <label>Αριθμός <input name="streetNo" [(ngModel)]="settings.streetNumber" maxlength="10" /></label>
          <label>Τ.Κ. <input name="postal" [(ngModel)]="settings.postalCode" maxlength="5" required /></label>
          <label>Πόλη <input name="city" [(ngModel)]="settings.city" maxlength="30" required /></label>
          <label class="wide">Ταυτότητα πληρωμής RF e-ΕΦΚΑ <input name="rf" [(ngModel)]="settings.efkaPaymentRf" maxlength="23" /></label>
          <label class="wide">Ταυτότητα πληρωμής RF ΤΕΚΑ <input name="tekaRf" [(ngModel)]="settings.tekaPaymentRf" maxlength="25" /></label>
          <div class="wide form-actions">
            <button class="btn btn-primary" type="submit">Αποθήκευση στοιχείων ΑΠΔ</button>
          </div>
        </form>
      </section>

      <ng-container *ngIf="tab === 'employees'">
        <section class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Νέος εργαζόμενος</h2>
              <p class="card-subtitle">Τα ατομικά στοιχεία που απαιτούνται από την ΑΠΔ.</p>
            </div>
          </div>
          <form class="card-body form-grid" (ngSubmit)="createEmployee()">
            <label>Κωδικός <input name="employeeCode" [(ngModel)]="employee.code" required /></label>
            <label>Επώνυμο <input name="lastName" [(ngModel)]="employee.lastName" required /></label>
            <label>Όνομα <input name="firstName" [(ngModel)]="employee.firstName" required /></label>
            <label>Όνομα πατέρα <input name="fatherName" [(ngModel)]="employee.fatherName" required /></label>
            <label>Όνομα μητέρας <input name="motherName" [(ngModel)]="employee.motherName" required /></label>
            <label>Ημερομηνία γέννησης <input name="birthDate" [(ngModel)]="employee.birthDate" type="date" required /></label>
            <label>ΑΦΜ <input name="afm" [(ngModel)]="employee.afm" maxlength="9" required /></label>
            <label>ΑΜΚΑ <input name="amka" [(ngModel)]="employee.amka" maxlength="11" required /></label>
            <label>Αριθμός μητρώου ασφάλισης <input name="insuranceNo" [(ngModel)]="employee.insuranceRegistryNumber" maxlength="9" required /></label>
            <label>Εξαρτώμενα τέκνα <input name="children" [(ngModel)]="employee.dependentChildren" type="number" min="0" max="20" /></label>
            <label>Αναγνωρισμένη προηγούμενη προϋπηρεσία (έτη) <input name="priorService" [(ngModel)]="employee.recognizedPriorServiceYears" type="number" min="0" max="60" /></label>
            <label class="check"><input name="tekaInsured" [(ngModel)]="employee.tekaInsured" type="checkbox" /> Νέο Επικουρικό — υπαγωγή στο ΤΕΚΑ</label>
            <label>Κατάσταση
              <select name="employeeStatus" [(ngModel)]="employee.status">
                <option value="ACTIVE">Ενεργός</option>
                <option value="INACTIVE">Ανενεργός</option>
              </select>
            </label>
            <div class="wide form-actions">
              <button *ngIf="editingEmployeeId" class="btn btn-secondary" type="button" (click)="cancelEmployeeEdit()">Ακύρωση</button>
              <button class="btn btn-primary" type="submit">{{ editingEmployeeId ? 'Αποθήκευση αλλαγών' : 'Καταχώριση εργαζομένου' }}</button>
            </div>
          </form>
        </section>

        <section class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Νέα σύμβαση</h2>
              <p class="card-subtitle">Αποδοχές, ωράριο και κωδικοποίηση ΑΠΔ.</p>
            </div>
          </div>
          <form class="card-body form-grid" (ngSubmit)="createContract()">
            <label class="wide">
              Εργαζόμενος
              <select name="contractEmployee" [(ngModel)]="contract.employeeId" required>
                <option value="">Επιλέξτε εργαζόμενο</option>
                <option *ngFor="let item of workspace.employees" [value]="item.id">
                  {{ item.lastName }} {{ item.firstName }} — {{ item.amka }}
                </option>
              </select>
            </label>
            <label>Έναρξη <input name="startDate" [(ngModel)]="contract.startDate" type="date" required /></label>
            <label>Λήξη <input name="endDate" [(ngModel)]="contract.endDate" type="date" /></label>
            <label *ngIf="!editingContractId">Ακριβής έναρξη εργασίας
              <input name="erganiStartAt" [(ngModel)]="contract.erganiEffectiveAt" type="datetime-local" required />
            </label>
            <ng-container *ngIf="editingContractId">
              <label>Τύπος μεταβολής ΕΡΓΑΝΗ ΙΙ
                <select name="contractErganiType" [(ngModel)]="contract.erganiDeclarationType">
                  <option value="">Μόνο αν αλλάζουν ουσιώδεις όροι</option>
                  <option *ngFor="let option of erganiChangeTypes" [value]="option.value">{{ option.label }}</option>
                </select>
              </label>
              <label>Εφαρμογή μεταβολής
                <input name="contractErganiAt" [(ngModel)]="contract.erganiEffectiveAt" type="datetime-local" />
              </label>
            </ng-container>
            <label>
              Τύπος αμοιβής
              <select name="compensationType" [(ngModel)]="contract.compensationType">
                <option value="MONTHLY">Μηνιαίος μισθός</option>
                <option value="DAILY">Ημερομίσθιο</option>
              </select>
            </label>
            <label *ngIf="contract.compensationType === 'MONTHLY'">Μηνιαίος μισθός <input name="monthlySalary" [(ngModel)]="contract.monthlySalary" type="number" min="0" step="0.01" required /></label>
            <label *ngIf="contract.compensationType === 'DAILY'">Ημερομίσθιο <input name="dailyWage" [(ngModel)]="contract.dailyWage" type="number" min="0" step="0.01" required /></label>
            <label *ngIf="contract.compensationType === 'MONTHLY'">Νόμιμη βάση προσαυξήσεων <input name="statutoryMonthlySalary" [(ngModel)]="contract.statutoryMonthlySalary" type="number" min="0" step="0.01" placeholder="Κενό = νόμιμος κατώτατος" /></label>
            <label *ngIf="contract.compensationType === 'DAILY'">Νόμιμο ημερομίσθιο προσαυξήσεων <input name="statutoryDailyWage" [(ngModel)]="contract.statutoryDailyWage" type="number" min="0" step="0.01" placeholder="Κενό = νόμιμο κατώτατο" /></label>
            <label>Ώρες εβδομάδας <input name="weeklyHours" [(ngModel)]="contract.weeklyHours" type="number" min="1" max="40" step="0.5" /></label>
            <label>Ημέρες εβδομάδας <input name="workDays" [(ngModel)]="contract.workDaysPerWeek" type="number" min="1" max="6" /></label>
            <div class="wide schedule-days">
              <span>Ημέρες εργασίας</span>
              <div class="weekday-options">
                <label *ngFor="let day of weekdays">
                  <input type="checkbox" [checked]="workdaySelected(day.value)" (change)="toggleWorkday(day.value)" />
                  {{ day.label }}
                </label>
              </div>
            </div>
            <label>Καθημερινή έναρξη <input name="dailyStartTime" [(ngModel)]="contract.dailyStartTime" type="time" required /></label>
            <label>Καθημερινή λήξη <input name="dailyEndTime" [(ngModel)]="contract.dailyEndTime" type="time" required /></label>
            <label>Διάλειμμα (λεπτά) <input name="breakMinutes" [(ngModel)]="contract.breakMinutes" type="number" min="0" max="120" /></label>
            <label class="check"><input name="breakWithin" [(ngModel)]="contract.breakWithinWorkingTime" type="checkbox" /> Διάλειμμα εντός χρόνου εργασίας</label>
            <label class="check"><input name="digitalCard" [(ngModel)]="contract.digitalCardEnabled" type="checkbox" /> Υπαγωγή στην Ψηφιακή Κάρτα</label>
            <label>Ευέλικτη προσέλευση (λεπτά) <input name="flexibleArrival" [(ngModel)]="contract.flexibleArrivalMinutes" type="number" min="0" max="120" /></label>
            <label class="check"><input name="fullTime" [(ngModel)]="contract.fullTime" type="checkbox" /> Πλήρης απασχόληση</label>
            <label>ΚΑΔ ΑΠΔ <input name="apdKad" [(ngModel)]="contract.apdKad" maxlength="4" required /></label>
            <label>Κωδικός ειδικότητας <input name="specialty" [(ngModel)]="contract.apdSpecialtyCode" maxlength="6" required /></label>
            <label>ΚΠΚ <input name="kpk" [(ngModel)]="contract.apdCoveragePackageCode" maxlength="4" required /></label>
            <label>Εισφορά εργαζομένου % <input name="employeeRate" [(ngModel)]="contract.employeeContributionRate" type="number" step="0.001" /></label>
            <label>Εισφορά εργοδότη % <input name="employerRate" [(ngModel)]="contract.employerContributionRate" type="number" step="0.001" /></label>
            <div class="wide form-actions">
              <button *ngIf="editingContractId" class="btn btn-secondary" type="button" (click)="cancelContractEdit()">Ακύρωση</button>
              <button class="btn btn-primary" type="submit">{{ editingContractId ? 'Αποθήκευση αλλαγών' : 'Καταχώριση σύμβασης' }}</button>
            </div>
            <div class="wide event-guidance" *ngIf="!editingContractId">
              Με την αποθήκευση δημιουργούνται αυτόματα η Ψηφιακή Αναγγελία Έναρξης Εργασίας και η αυθημερόν Αρχική Ψηφιακή Οργάνωση Χρόνου. Η μισθοδοσία δεν ανοίγει μέχρι να περαστούν τα πραγματικά πρωτόκολλα.
            </div>
          </form>
        </section>

        <section class="table-wrap" *ngIf="workspace.employees.length">
          <table>
            <thead><tr><th>Εργαζόμενος</th><th>ΑΦΜ / ΑΜΚΑ</th><th>Τέκνα</th><th>Τρέχουσα σύμβαση</th><th>Κατάσταση</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let item of workspace.employees">
                <td><strong>{{ item.lastName }} {{ item.firstName }}</strong><small>{{ item.code }}<span *ngIf="item.tekaInsured"> · Νέο Επικουρικό ΤΕΚΑ</span></small></td>
                <td>{{ item.afm }}<small>{{ item.amka }}</small></td>
                <td>{{ item.dependentChildren }}</td>
                <td>
                  <ng-container *ngIf="item.contracts[0] as active; else noContract">
                    {{ active.compensationType === 'MONTHLY' ? (active.monthlySalary | number:'1.2-2') + ' €' : (active.dailyWage | number:'1.2-2') + ' €/ημ.' }}
                    <small>ΚΠΚ {{ active.apdCoveragePackageCode }} · {{ active.startDate | date:'dd/MM/yyyy' }}</small>
                    <small>{{ active.dailyStartTime }}–{{ active.dailyEndTime }} · {{ workdayLabels(active.workWeekdays) }}</small>
                  </ng-container>
                  <ng-template #noContract>Χωρίς σύμβαση</ng-template>
                </td>
                <td><span class="status" [class.ok]="item.status === 'ACTIVE'">{{ item.status === 'ACTIVE' ? 'Ενεργός' : 'Ανενεργός' }}</span></td>
                <td class="row-actions">
                  <button class="btn btn-secondary btn-sm" type="button" (click)="editEmployee(item)">Εργαζόμενος</button>
                  <button *ngIf="item.contracts[0]" class="btn btn-secondary btn-sm" type="button" (click)="editContract(item.contracts[0])">Σύμβαση</button>
                  <button *ngIf="item.contracts[0] && hasPendingHiring(item.contracts[0].id)" class="btn btn-secondary btn-sm" type="button" (click)="deleteContract(item.contracts[0].id)">Ακύρωση νέας σύμβασης</button>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </ng-container>

      <section *ngIf="tab === 'ergani'" class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Δηλώσεις ΕΡΓΑΝΗ ΙΙ παραγωγής</h2>
            <p class="card-subtitle">Έναρξη και μεταβολές εργασιακής σχέσης με προθεσμία, αποδοχή εργαζομένου και πραγματικό πρωτόκολλο.</p>
          </div>
        </div>
        <form class="card-body form-grid" (ngSubmit)="createErganiDeclaration()">
          <label class="wide">Εργαζόμενος
            <select name="erganiEmployee" [(ngModel)]="erganiDeclaration.employeeId" required>
              <option value="">Επιλέξτε ενεργό εργαζόμενο</option>
              <option *ngFor="let item of employeesWithContracts" [value]="item.id">{{ item.lastName }} {{ item.firstName }}</option>
            </select>
          </label>
          <label>Τύπος μεταβολής
            <select name="erganiType" [(ngModel)]="erganiDeclaration.type">
              <option *ngFor="let option of erganiChangeTypes" [value]="option.value">{{ option.label }}</option>
            </select>
          </label>
          <label>Ακριβής χρόνος εφαρμογής
            <input name="erganiEffectiveAt" [(ngModel)]="erganiDeclaration.effectiveAt" type="datetime-local" required />
          </label>
          <label class="wide">Σημειώσεις / τι αλλάζει
            <input name="erganiNotes" [(ngModel)]="erganiDeclaration.notes" />
          </label>
          <div class="wide event-guidance">
            Οι προσλήψεις δημιουργούνται από τη «Νέα σύμβαση». Οι υπόλοιπες μεταβολές υποβάλλονται πριν εφαρμοστούν· μόνο η αύξηση αποδοχών από νόμο ή ΣΣΕ έχει προθεσμία 30 ημερών και δεν απαιτεί αποδοχή εργαζομένου.
          </div>
          <div class="wide form-actions">
            <button class="btn btn-primary" type="submit">Προετοιμασία δήλωσης μεταβολής</button>
          </div>
        </form>

        <div class="table-wrap compact" *ngIf="workspace.erganiDeclarations.length">
          <table>
            <thead><tr><th>Εργαζόμενος</th><th>Δήλωση</th><th>Εφαρμογή / προθεσμία</th><th>Κατάσταση</th><th>Αποδοχή</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let item of workspace.erganiDeclarations">
                <td><strong>{{ item.employee.lastName }} {{ item.employee.firstName }}</strong></td>
                <td>{{ erganiTypeName(item.type) }}</td>
                <td>
                  {{ item.effectiveAt | date:'dd/MM/yyyy HH:mm' }}
                  <small>Προθεσμία {{ item.deadlineAt | date:'dd/MM/yyyy HH:mm' }}</small>
                </td>
                <td>
                  <span class="status" [class.ok]="item.status === 'COMPLETED'" [class.danger]="item.status === 'DRAFT' && isErganiOverdue(item)">
                    {{ item.status === 'COMPLETED' ? 'Υποβλήθηκε' : (isErganiOverdue(item) ? 'Εκπρόθεσμη εκκρεμότητα' : 'Εκκρεμεί') }}
                  </span>
                  <small *ngIf="item.erganiProtocol">Πρωτ. {{ item.erganiProtocol }}</small>
                  <small *ngIf="item.lateSubmission">Καταχωρίστηκε ως εκπρόθεσμη</small>
                </td>
                <td>
                  {{ item.acceptanceMethod ? erganiAcceptanceName(item.acceptanceMethod) : ((item.type === 'PAY_CHANGE_LEGISLATION' || item.type === 'INITIAL_WORK_SCHEDULE') ? 'Δεν απαιτείται χωριστά' : 'Εκκρεμεί') }}
                  <small *ngIf="item.acceptanceReference">{{ item.acceptanceReference }}</small>
                </td>
                <td class="row-actions">
                  <button *ngIf="canApprove && item.status === 'DRAFT'" class="btn btn-primary btn-sm" type="button" (click)="completeErganiDeclaration(item)">Πρωτόκολλο</button>
                  <button *ngIf="item.status === 'DRAFT' && item.type !== 'HIRING' && item.type !== 'INITIAL_WORK_SCHEDULE'" class="btn btn-secondary btn-sm" type="button" (click)="deleteErganiDeclaration(item)">Διαγραφή</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section *ngIf="tab === 'leaves'" class="card">
        <div class="card-header"><div><h2 class="card-title">Βιβλίο αδειών</h2><p class="card-subtitle">Δικαίωμα, ληφθείσες και υπόλοιπο ανά εργαζόμενο.</p></div></div>
        <form class="card-body form-grid" (ngSubmit)="createLeave()">
          <label class="wide">Εργαζόμενος<select name="leaveEmployee" [(ngModel)]="leave.employeeId" required><option value="">Επιλέξτε</option><option *ngFor="let item of workspace.employees" [value]="item.id">{{ item.lastName }} {{ item.firstName }} — υπόλοιπο {{ leaveBalance(item.id)?.remaining ?? 0 }}</option></select></label>
          <label>Τύπος<select name="leaveType" [(ngModel)]="leave.type" (ngModelChange)="leaveTypeChanged()"><option value="ANNUAL">Κανονική</option><option value="UNPAID">Άνευ αποδοχών</option><option value="MATERNITY">Κυοφορίας/λοχείας (17 εβδομάδες)</option><option value="SPECIAL_MATERNITY_PROTECTION">Ειδική προστασία μητρότητας (9 μήνες)</option><option value="PATERNITY">Πατρότητας (14 εργάσιμες)</option><option value="PARENTAL">Γονική (4 μήνες)</option><option value="CAREGIVER">Φροντιστή</option><option value="OTHER">Άλλη</option></select></label>
          <label>Από<input name="leaveFrom" [(ngModel)]="leave.dateFrom" type="date" required /></label>
          <label>Έως<input name="leaveTo" [(ngModel)]="leave.dateTo" type="date" required /></label>
          <label>Εργάσιμες ημέρες<input name="leaveDays" [(ngModel)]="leave.workingDays" type="number" min=".5" step=".5" required /></label>
          <label>Πηγή αποδοχών<select name="leavePaymentSource" [(ngModel)]="leave.paymentSource"><option value="EMPLOYER">Εργοδότης</option><option value="E_EFKA_DYPA">e-ΕΦΚΑ / ΔΥΠΑ</option><option value="DYPA">ΔΥΠΑ</option><option value="UNPAID">Χωρίς αποδοχές</option><option value="MIXED">Μικτή / εργοδοτική διαφορά</option></select></label>
          <label>Εργοδοτικές μικτές αποδοχές<input name="leaveEmployerGross" [(ngModel)]="leave.employerGrossAmount" type="number" min="0" step="0.01" /></label>
          <label class="wide">Αίτηση εργαζομένου / δικαιολογητικό<input name="leaveRequestRef" [(ngModel)]="leave.employeeRequestReference" /></label>
          <label class="wide">Απόφαση/αίτηση e-ΕΦΚΑ ή ΔΥΠΑ<input name="leaveBenefitRef" [(ngModel)]="leave.externalBenefitReference" /></label>
          <label>Πρωτόκολλο ΕΡΓΑΝΗ Ε.14<input name="leaveErganiProtocol" [(ngModel)]="leave.erganiProtocol" /></label>
          <label>Υποβολή ΕΡΓΑΝΗ<input name="leaveErganiAt" [(ngModel)]="leave.erganiSubmittedAt" type="datetime-local" /></label>
          <label class="wide">Σημειώσεις<input name="leaveNotes" [(ngModel)]="leave.notes" /></label>
          <div class="wide event-guidance">Η γονική άδεια περνά χωριστά: έως 2 μήνες με πηγή «ΔΥΠΑ» και το υπόλοιπο με «Χωρίς αποδοχές». Η άδεια μητρότητας καταχωρίζεται ανά περίοδο πληρωτή· τυχόν πραγματική εργοδοτική διαφορά γράφεται ρητά και δεν υπολογίζεται κατά προσέγγιση.</div>
          <div class="wide form-actions"><button class="btn btn-primary" type="submit">Καταχώριση άδειας</button></div>
        </form>
        <div class="table-wrap compact" *ngIf="workspace.leaves.length"><table><thead><tr><th>Εργαζόμενος</th><th>Τύπος</th><th>Διάστημα</th><th>Ημέρες</th><th>Πληρωτής / τεκμηρίωση</th><th></th></tr></thead><tbody><tr *ngFor="let item of workspace.leaves"><td>{{ item.employee.lastName }} {{ item.employee.firstName }}</td><td>{{ leaveTypeName(item.type) }}</td><td>{{ item.dateFrom | date:'dd/MM/yyyy' }}–{{ item.dateTo | date:'dd/MM/yyyy' }}</td><td>{{ item.workingDays }}</td><td>{{ leavePaymentName(item.paymentSource) }}<small *ngIf="+item.employerGrossAmount">Εργοδότης: {{ item.employerGrossAmount | number:'1.2-2' }} €</small><small *ngIf="item.erganiProtocol">ΕΡΓΑΝΗ {{ item.erganiProtocol }}</small><small *ngIf="item.externalBenefitReference">{{ item.externalBenefitReference }}</small></td><td><button *ngIf="!item.payrollEventId" class="btn btn-secondary btn-sm" type="button" (click)="deleteLeave(item)">Διαγραφή</button><small *ngIf="item.payrollEventId">Διαχείριση από μισθοδοσία</small></td></tr></tbody></table></div>
      </section>

      <section *ngIf="tab === 'terminations'" class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Λύση σύμβασης και ΕΡΓΑΝΗ ΙΙ</h2>
            <p class="card-subtitle">Υπολογισμός αποζημίωσης, τραπεζική πληρωμή και καταγραφή του πρωτοκόλλου της Ψηφιακής Αναγγελίας Λύσης Απασχόλησης.</p>
          </div>
        </div>
        <form class="card-body form-grid" (ngSubmit)="createTermination()">
          <label class="wide">Εργαζόμενος
            <select name="terminationEmployee" [(ngModel)]="termination.employeeId" (ngModelChange)="prefillTerminationEarnings()" required>
              <option value="">Επιλέξτε ενεργό εργαζόμενο</option>
              <option *ngFor="let item of employeesWithContracts" [value]="item.id">{{ item.lastName }} {{ item.firstName }}</option>
            </select>
          </label>
          <label>Τρόπος λύσης
            <select name="terminationType" [(ngModel)]="termination.type">
              <option value="EMPLOYER_DISMISSAL">Καταγγελία από εργοδότη</option>
              <option value="VOLUNTARY_RESIGNATION">Οικειοθελής αποχώρηση</option>
              <option value="FIXED_TERM_EXPIRY">Λήξη ορισμένου χρόνου</option>
              <option value="RETIREMENT">Συνταξιοδότηση</option>
              <option value="DEATH">Θάνατος</option>
              <option value="OTHER">Άλλη περίπτωση</option>
            </select>
          </label>
          <label>Ημερομηνία λύσης<input name="terminationDate" [(ngModel)]="termination.terminationDate" type="date" required /></label>
          <label>Τακτικές μικτές αποδοχές τελευταίου μήνα
            <input name="regularEarnings" [(ngModel)]="termination.regularMonthlyEarnings" type="number" min="0" step="0.01" required />
            <small>Πριν από την προσαύξηση 1/6 για δώρα και επίδομα αδείας.</small>
          </label>
          <label class="check" *ngIf="termination.type === 'EMPLOYER_DISMISSAL'">
            <input name="withNotice" [(ngModel)]="termination.withNotice" type="checkbox" /> Με νόμιμη προειδοποίηση
          </label>
          <label>Τελική αποζημίωση (προαιρετική διόρθωση)
            <input name="severanceOverride" [(ngModel)]="termination.severanceAmount" type="number" min="0" step="0.01" placeholder="Αυτόματος υπολογισμός" />
          </label>
          <label class="wide">Σημειώσεις<input name="terminationNotes" [(ngModel)]="termination.notes" /></label>
          <div class="wide event-guidance">
            Η εφαρμογή υπολογίζει τον επίσημο πίνακα αποζημίωσης και την αναλογία 1/6. Πριν από απόλυση ελέγξτε τυχόν ειδική προστασία εργαζομένου. Η ολοκλήρωση κλείνει τη σύμβαση μόνο αφού περαστεί το πρωτόκολλο ΕΡΓΑΝΗ ΙΙ.
          </div>
          <div class="wide form-actions"><button class="btn btn-primary" type="submit">Προετοιμασία λύσης σύμβασης</button></div>
        </form>

        <div class="table-wrap compact" *ngIf="workspace.terminations.length">
          <table>
            <thead><tr><th>Εργαζόμενος</th><th>Λύση</th><th>Υπηρεσία</th><th>Αποζημίωση</th><th>ΕΡΓΑΝΗ ΙΙ / πληρωμή</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let item of workspace.terminations">
                <td><strong>{{ item.employee.lastName }} {{ item.employee.firstName }}</strong><small>{{ item.terminationDate | date:'dd/MM/yyyy' }}</small></td>
                <td>{{ terminationTypeName(item.type) }}<small *ngIf="item.withNotice">Προειδοποίηση {{ item.noticeMonths }} μηνών</small></td>
                <td>{{ item.completedServiceYears }} έτη</td>
                <td><strong>{{ item.severanceAmount | number:'1.2-2' }} €</strong><small>Νόμιμη: {{ item.statutorySeverance | number:'1.2-2' }} €</small></td>
                <td>
                  <span class="status" [class.ok]="item.status === 'COMPLETED'">{{ item.status === 'COMPLETED' ? 'Ολοκληρώθηκε' : 'Πρόχειρο' }}</span>
                  <small *ngIf="item.erganiProtocol">Πρωτ. {{ item.erganiProtocol }}</small>
                  <small *ngIf="item.paymentReference">Τράπεζα: {{ item.paymentReference }}</small>
                </td>
                <td class="row-actions">
                  <button *ngIf="canApprove && item.status === 'DRAFT'" class="btn btn-primary btn-sm" type="button" (click)="completeTermination(item)">Ολοκλήρωση</button>
                  <button *ngIf="item.status === 'DRAFT'" class="btn btn-secondary btn-sm" type="button" (click)="deleteTermination(item)">Διαγραφή</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <ng-container *ngIf="tab === 'period'">
        <section class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Ειδικές αποδοχές</h2>
              <p class="card-subtitle">Δώρα, επίδομα αδείας, ασθένεια, αναδρομικά, bonus και υπερωρίες με χωριστό τύπο ΑΠΔ.</p>
            </div>
          </div>
          <form class="card-body form-grid" (ngSubmit)="createEvent()">
            <label class="wide">Εργαζόμενος
              <select name="eventEmployee" [(ngModel)]="event.employeeId" required>
                <option value="">Επιλέξτε εργαζόμενο</option>
                <option *ngFor="let item of workspace.employees" [value]="item.id">{{ item.lastName }} {{ item.firstName }}</option>
              </select>
            </label>
            <label>Τύπος
              <select name="eventType" [(ngModel)]="event.type">
                <option value="CHRISTMAS_BONUS">Δώρο Χριστουγέννων — ΑΠΔ 003</option>
                <option value="EASTER_BONUS">Δώρο Πάσχα — ΑΠΔ 004</option>
                <option value="LEAVE_ALLOWANCE">Επίδομα αδείας — ΑΠΔ 005</option>
                <option value="SICKNESS">Αποδοχές ασθενείας — ΑΠΔ 008</option>
                <option value="RETROACTIVE">Αναδρομικά — ΑΠΔ 009</option>
                <option value="BONUS">Bonus — ΑΠΔ 010</option>
                <option value="OVERTIME">Υπερωρίες — ΑΠΔ 011</option>
              </select>
            </label>
            <label>Περίοδος
              <div class="inline-fields">
                <input name="eventYear" [(ngModel)]="event.periodYear" type="number" min="2026" max="2026" />
                <input name="eventMonth" [(ngModel)]="event.periodMonth" type="number" min="1" max="12" />
              </div>
            </label>
            <label *ngIf="event.type === 'LEAVE_ALLOWANCE'">Ημέρες άδειας
              <input name="eventLeaveDays" [(ngModel)]="event.leaveDays" type="number" min="1" max="31" />
            </label>
            <ng-container *ngIf="event.type === 'SICKNESS'">
              <label>Από<input name="sicknessFrom" [(ngModel)]="event.dateFrom" type="date" required /></label>
              <label>Έως<input name="sicknessTo" [(ngModel)]="event.dateTo" type="date" required /></label>
              <label>Ημέρες απουσίας<input name="sicknessDays" [(ngModel)]="event.leaveDays" type="number" min="1" max="31" required /></label>
              <label>Ηλεκτρονική ιατρική γνωμάτευση
                <input name="medicalCertificate" [(ngModel)]="event.medicalCertificateReference" maxlength="100" required />
              </label>
              <label>Επίδομα ασθενείας e-ΕΦΚΑ
                <select name="sicknessBenefitStatus" [(ngModel)]="event.sicknessBenefitStatus">
                  <option value="PENDING">Εκκρεμεί απόφαση</option>
                  <option value="APPROVED">Εγκρίθηκε</option>
                  <option value="NOT_ELIGIBLE">Δεν δικαιούται</option>
                </select>
              </label>
            </ng-container>
            <label>Ημέρες ασφάλισης ειδικής εγγραφής
              <input name="eventInsuranceDays" [(ngModel)]="event.insuranceDays" type="number" min="0" max="31" />
            </label>
            <label *ngIf="event.type !== 'SICKNESS'">Μικτό ποσό
              <input name="eventGross" [(ngModel)]="event.grossAmount" type="number" min="0" step="0.01" placeholder="Κενό = αυτόματος υπολογισμός δώρου/άδειας" />
            </label>
            <label *ngIf="event.type === 'SICKNESS' && event.sicknessBenefitStatus === 'APPROVED'">Ποσό e-ΕΦΚΑ που αφορά αυτή την περίοδο
              <input name="eventEfka" [(ngModel)]="event.efkaBenefit" type="number" min="0" step="0.01" />
            </label>
            <label class="wide">Σημειώσεις
              <input name="eventNotes" [(ngModel)]="event.notes" />
            </label>
            <div class="wide event-guidance">
              Για ασθένεια το ποσό υπολογίζεται αυτόματα από τις ημέρες, την προϋπηρεσία και το επίδομα e-ΕΦΚΑ. Μισθοδοσία με εκκρεμή απόφαση e-ΕΦΚΑ δεν εγκρίνεται. Για αναδρομικά, bonus και υπερωρίες καταχωρίστε ελεγμένο μικτό ποσό.
            </div>
            <div class="wide form-actions"><button class="btn btn-primary" type="submit">Προσθήκη ειδικής αποδοχής</button></div>
          </form>
          <div class="table-wrap compact" *ngIf="eventsForSelectedPeriod.length">
            <table><thead><tr><th>Εργαζόμενος</th><th>Τύπος</th><th>Ποσό</th><th>Υπολογισμός</th><th></th></tr></thead>
              <tbody><tr *ngFor="let item of eventsForSelectedPeriod">
                <td>{{ item.employee.lastName }} {{ item.employee.firstName }}</td>
                <td>{{ eventTypeName(item.type) }}</td>
                <td>{{ item.grossAmount | number:'1.2-2' }} €</td>
                <td>{{ item.autoCalculated ? 'Αυτόματος' : 'Χειροκίνητος/ελεγμένος' }}<small *ngIf="item.type === 'SICKNESS'">{{ sicknessStatusName(item.sicknessBenefitStatus) }}</small></td>
                <td class="row-actions">
                  <button *ngIf="item.type === 'SICKNESS' && item.sicknessBenefitStatus === 'PENDING'" class="btn btn-primary btn-sm" type="button" (click)="resolveSickness(item)">Απόφαση e-ΕΦΚΑ</button>
                  <button class="btn btn-secondary btn-sm" type="button" (click)="deleteEvent(item)">Διαγραφή</button>
                </td>
              </tr></tbody>
            </table>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Υπολογισμός περιόδου</h2>
              <p class="card-subtitle">Οι 25 ημέρες προτείνονται αυτόματα και μπορούν να διορθωθούν πριν τον υπολογισμό.</p>
            </div>
          </div>
          <form class="card-body" (ngSubmit)="calculate()">
            <div class="period-controls">
              <label>Έτος <input name="periodYear" [(ngModel)]="period.year" type="number" min="2026" max="2026" /></label>
              <label>Μήνας <input name="periodMonth" [(ngModel)]="period.month" type="number" min="1" max="12" /></label>
              <label>Δήλωση
                <select name="declarationType" [(ngModel)]="period.declarationType">
                  <option value="NORMAL">Κανονική</option>
                  <option value="SUPPLEMENTARY">Συμπληρωματική</option>
                </select>
              </label>
            </div>
            <div class="table-wrap compact" *ngIf="employeesWithContracts.length">
              <table>
                <thead><tr><th>Εργαζόμενος</th><th>Ημέρες ΑΠΔ</th><th>Νύχτα ώρες</th><th>Κυριακή/αργία ώρες</th><th>Υπερεργασία ώρες</th><th>Υπερωρία 40% ώρες</th><th>Με άδεια 60% ώρες</th><th>Παράνομη 120% ώρες</th><th>Μερική +12% ώρες</th><th>Πρωτόκολλο υπερωρίας ΕΡΓΑΝΗ</th><th>Λοιπές μικτές</th><th>Λοιπές κρατήσεις</th></tr></thead>
                <tbody>
                  <tr *ngFor="let item of employeesWithContracts">
                    <td>{{ item.lastName }} {{ item.firstName }}</td>
                    <td><input [name]="'days-' + item.id" [(ngModel)]="override(item.id).insuranceDays" type="number" min="0" max="31" placeholder="25" /></td>
                    <td><input [name]="'night-' + item.id" [(ngModel)]="override(item.id).nightHours" type="number" min="0" step="0.25" /></td>
                    <td><input [name]="'holiday-' + item.id" [(ngModel)]="override(item.id).sundayHolidayHours" type="number" min="0" step="0.25" /></td>
                    <td><input [name]="'extra-work-' + item.id" [(ngModel)]="override(item.id).extraWorkHours" type="number" min="0" step="0.25" [disabled]="!item.contracts[0].fullTime" /></td>
                    <td><input [name]="'legal-overtime-' + item.id" [(ngModel)]="override(item.id).legalOvertimeHours" type="number" min="0" step="0.25" [disabled]="!item.contracts[0].fullTime" /></td>
                    <td><input [name]="'approved-overtime-' + item.id" [(ngModel)]="override(item.id).approvedOvertimeHours" type="number" min="0" step="0.25" [disabled]="!item.contracts[0].fullTime" /></td>
                    <td><input [name]="'illegal-overtime-' + item.id" [(ngModel)]="override(item.id).illegalOvertimeHours" type="number" min="0" step="0.25" [disabled]="!item.contracts[0].fullTime" /></td>
                    <td><input [name]="'part-time-extra-' + item.id" [(ngModel)]="override(item.id).partTimeAdditionalHours" type="number" min="0" step="0.25" [disabled]="item.contracts[0].fullTime" /></td>
                    <td><input [name]="'overtime-protocol-' + item.id" [(ngModel)]="override(item.id).overtimeErganiProtocol" [required]="override(item.id).legalOvertimeHours > 0 || override(item.id).approvedOvertimeHours > 0" /></td>
                    <td><input [name]="'other-' + item.id" [(ngModel)]="override(item.id).otherGross" type="number" min="0" step="0.01" /></td>
                    <td><input [name]="'deductions-' + item.id" [(ngModel)]="override(item.id).otherDeductions" type="number" min="0" step="0.01" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="event-guidance">Οι νυχτερινές και Κυριακές/αργίες μπορούν να επικαλύπτονται. Η νόμιμη υπερωρία απαιτεί πραγματικό πρωτόκολλο ΕΡΓΑΝΗ πριν από την έγκριση. Η παράνομη υπερωρία πληρώνεται με +120% και εμφανίζεται ως κρίσιμη παράβαση· δεν «σβήνεται» από τη μισθοδοσία.</div>
            <div class="form-actions">
              <button class="btn btn-primary" type="submit" [disabled]="!employeesWithContracts.length">Υπολογισμός μισθοδοσίας</button>
            </div>
          </form>
        </section>

        <section class="card period-card" *ngFor="let item of workspace.periods">
          <div class="card-header">
            <div>
              <h2 class="card-title">{{ monthName(item.periodMonth) }} {{ item.periodYear }}</h2>
              <p class="card-subtitle">{{ item.declarationType === 'NORMAL' ? 'Κανονική ΑΠΔ' : 'Συμπληρωματική ΑΠΔ' }}</p>
            </div>
            <span class="status" [class.ok]="item.status === 'APPROVED' || item.status === 'PAID'">{{ statusName(item.status) }}</span>
          </div>
          <div class="totals">
            <div><span>Μικτές</span><strong>{{ item.totalGross | number:'1.2-2' }} €</strong></div>
            <div><span>Εισφορές εργαζομένων</span><strong>{{ item.totalEmployeeContributions | number:'1.2-2' }} €</strong></div>
            <div><span>Εισφορές εργοδότη</span><strong>{{ item.totalEmployerContributions | number:'1.2-2' }} €</strong></div>
            <div><span>ΦΜΥ</span><strong>{{ item.totalWithholdingTax | number:'1.2-2' }} €</strong></div>
            <div><span>Καθαρά</span><strong>{{ item.totalNet | number:'1.2-2' }} €</strong></div>
          </div>
          <div class="compliance-grid" *ngIf="item.status === 'APPROVED' || item.status === 'PAID'">
            <article class="compliance-item" [class.late]="item.apdLateSubmission">
              <h3>Υποβολή ΑΠΔ</h3>
              <p>Προθεσμία: <strong>{{ item.apdSubmissionDeadline | date:'dd/MM/yyyy':'Europe/Athens' }}</strong></p>
              <p *ngIf="item.apdSubmittedAt">Πρωτόκολλο: <strong>{{ item.apdProtocol }}</strong> · {{ item.apdSubmittedAt | date:'dd/MM/yyyy HH:mm':'Europe/Athens' }}</p>
              <p *ngIf="!item.apdSubmittedAt" class="pending">Δεν έχει καταχωριστεί επιτυχής υποβολή.</p>
              <span *ngIf="item.apdLateSubmission" class="late-label">Εκπρόθεσμη</span>
              <button *ngIf="canApprove" class="btn btn-secondary btn-sm" type="button" (click)="completeApdSubmission(item)">{{ item.apdSubmittedAt ? 'Διόρθωση υποβολής' : 'Καταχώριση υποβολής' }}</button>
            </article>
            <article class="compliance-item" [class.late]="item.contributionsLatePayment">
              <h3>Πληρωμή εισφορών e-ΕΦΚΑ</h3>
              <p>Ποσό: <strong>{{ efkaContributionTotal(item) | number:'1.2-2' }} €</strong> · Προθεσμία: <strong>{{ item.contributionsPaymentDeadline | date:'dd/MM/yyyy':'Europe/Athens' }}</strong></p>
              <p *ngIf="item.contributionsPaymentDate">Πληρωμή: <strong>{{ item.contributionsPaymentDate | date:'dd/MM/yyyy' }}</strong> · {{ item.contributionsPaymentReference }}</p>
              <p *ngIf="!item.contributionsPaymentDate" class="pending">Δεν έχει καταχωριστεί πληρωμή εισφορών.</p>
              <span *ngIf="item.contributionsLatePayment" class="late-label">Εκπρόθεσμη</span>
              <button *ngIf="canApprove && efkaContributionTotal(item) > 0" class="btn btn-secondary btn-sm" type="button" (click)="markContributionsPaid(item)">{{ item.contributionsPaymentDate ? 'Διόρθωση πληρωμής' : 'Καταχώριση πληρωμής' }}</button>
            </article>
            <article *ngIf="+item.tekaContributionAmount > 0" class="compliance-item" [class.late]="item.tekaLateSubmission || item.tekaLatePayment">
              <h3>ΑΠΔ και πληρωμή ΤΕΚΑ</h3>
              <p>Ποσό: <strong>{{ item.tekaContributionAmount | number:'1.2-2' }} €</strong> · Υποβολή: <strong>{{ item.apdSubmissionDeadline | date:'dd/MM/yyyy':'Europe/Athens' }}</strong></p>
              <p *ngIf="item.tekaSubmittedAt">Πρωτόκολλο: <strong>{{ item.tekaProtocol }}</strong> · {{ item.tekaSubmittedAt | date:'dd/MM/yyyy HH:mm':'Europe/Athens' }}</p>
              <p *ngIf="!item.tekaSubmittedAt" class="pending">Εκκρεμεί η ξεχωριστή ΑΠΔ ΤΕΚΑ μετά την ΑΠΔ e-ΕΦΚΑ.</p>
              <p *ngIf="item.tekaPaymentDate">Πληρωμή: <strong>{{ item.tekaPaymentDate | date:'dd/MM/yyyy' }}</strong> · {{ item.tekaPaymentReference }}</p>
              <p *ngIf="item.tekaSubmittedAt && !item.tekaPaymentDate" class="pending">Εκκρεμεί η ξεχωριστή πληρωμή ΤΕΚΑ.</p>
              <span *ngIf="item.tekaLateSubmission || item.tekaLatePayment" class="late-label">Εκπρόθεσμη ενέργεια</span>
              <div class="compliance-actions" *ngIf="canApprove">
                <button class="btn btn-secondary btn-sm" type="button" (click)="completeTekaSubmission(item)">{{ item.tekaSubmittedAt ? 'Διόρθωση ΑΠΔ ΤΕΚΑ' : 'Καταχώριση ΑΠΔ ΤΕΚΑ' }}</button>
                <button *ngIf="item.tekaSubmittedAt" class="btn btn-secondary btn-sm" type="button" (click)="markTekaPaid(item)">{{ item.tekaPaymentDate ? 'Διόρθωση πληρωμής' : 'Πληρωμή ΤΕΚΑ' }}</button>
              </div>
            </article>
            <article class="compliance-item" [class.late]="item.fmyLateSubmission || item.fmyLatePayment">
              <h3>Δήλωση και πληρωμή ΦΜΥ</h3>
              <p>Ποσό: <strong>{{ item.totalWithholdingTax | number:'1.2-2' }} €</strong> · Προθεσμία: <strong>{{ item.fmySubmissionDeadline | date:'dd/MM/yyyy':'Europe/Athens' }}</strong></p>
              <p *ngIf="item.fmySubmittedAt">Πρωτόκολλο: <strong>{{ item.fmyProtocol }}</strong><span *ngIf="item.fmyDebtId"> · Τ.Ο. {{ item.fmyDebtId }}</span></p>
              <p *ngIf="!item.fmySubmittedAt" class="pending">Δεν έχει καταχωριστεί δήλωση ΦΜΥ.</p>
              <p *ngIf="item.fmyPaymentDate">Πληρωμή: <strong>{{ item.fmyPaymentDate | date:'dd/MM/yyyy' }}</strong> · {{ item.fmyPaymentReference }}</p>
              <p *ngIf="item.fmySubmittedAt && !item.fmyPaymentDate && +item.totalWithholdingTax > 0" class="pending">Η οφειλή δεν έχει σημειωθεί ως πληρωμένη.</p>
              <p *ngIf="item.fmySubmittedAt && +item.totalWithholdingTax === 0">Μηδενική δήλωση — δεν υπάρχει πληρωμή.</p>
              <span *ngIf="item.fmyLateSubmission || item.fmyLatePayment" class="late-label">Εκπρόθεσμη ενέργεια</span>
              <div class="compliance-actions" *ngIf="canApprove">
                <button class="btn btn-secondary btn-sm" type="button" (click)="completeFmySubmission(item)">{{ item.fmySubmittedAt ? 'Διόρθωση δήλωσης' : 'Καταχώριση δήλωσης' }}</button>
                <button *ngIf="item.fmySubmittedAt && +item.totalWithholdingTax > 0" class="btn btn-secondary btn-sm" type="button" (click)="markFmyPaid(item)">{{ item.fmyPaymentDate ? 'Διόρθωση πληρωμής' : 'Καταχώριση πληρωμής' }}</button>
              </div>
            </article>
          </div>
          <div class="table-wrap compact">
            <table>
              <thead><tr><th>Εργαζόμενος</th><th>Τύπος</th><th>Ημέρες</th><th>Μικτά</th><th>Ασφαλιστέα</th><th>Εκτός εισφορών</th><th>Εισφορές</th><th>ΦΜΥ</th><th>Καθαρά</th><th></th></tr></thead>
              <tbody><tr *ngFor="let entry of item.entries">
                <td>{{ entry.employee.lastName }} {{ entry.employee.firstName }}</td>
                <td>{{ earningsTypeName(entry.apdEarningsType) }}</td>
                <td>{{ entry.insuranceDays }}</td>
                <td>{{ entry.grossEarnings | number:'1.2-2' }}</td>
                <td>{{ entry.contributionBase | number:'1.2-2' }}</td>
                <td>{{ entry.contributionExempt | number:'1.2-2' }}<small *ngIf="+entry.illegalOvertimeGross" class="danger-text">Παράνομη υπερωρία {{ entry.illegalOvertimeGross | number:'1.2-2' }} €</small></td>
                <td>{{ entry.employeeContributions | number:'1.2-2' }}</td>
                <td>{{ entry.withholdingTax | number:'1.2-2' }}</td>
                <td><strong>{{ entry.netPayable | number:'1.2-2' }}</strong></td>
                <td><button *ngIf="canApprove && isFirstEmployeeEntry(item, entry) && (item.status === 'APPROVED' || item.status === 'PAID')" class="btn btn-secondary btn-sm" type="button" (click)="downloadPayslip(item, entry)">Εκκαθαριστικό</button></td>
              </tr></tbody>
            </table>
          </div>
          <div class="card-actions">
            <button *ngIf="canApprove && item.status === 'CALCULATED'" class="btn btn-primary" type="button" (click)="approve(item)">Έγκριση</button>
            <button *ngIf="canApprove && item.status === 'APPROVED'" class="btn btn-secondary" type="button" (click)="markPaid(item)">Πληρωμή μισθών</button>
            <button *ngIf="canApprove && (item.status === 'APPROVED' || item.status === 'PAID')" class="btn btn-secondary" type="button" (click)="editComplianceDeadlines(item)">Προθεσμίες ΑΠΔ / ΦΜΥ</button>
            <button *ngIf="canApprove && (item.status === 'APPROVED' || item.status === 'PAID')" class="btn btn-secondary" type="button" (click)="downloadApd(item)">
              <span class="material-symbols-outlined">download</span> Αρχείο ΑΠΔ
            </button>
            <button *ngIf="canApprove && (item.status === 'APPROVED' || item.status === 'PAID')" class="btn btn-secondary" type="button" (click)="downloadBankPayments(item)">
              <span class="material-symbols-outlined">account_balance</span> Πληρωμές τράπεζας
            </button>
            <button *ngIf="canApprove && (item.status === 'APPROVED' || item.status === 'PAID')" class="btn btn-secondary" type="button" (click)="downloadFmy(item)">
              <span class="material-symbols-outlined">request_quote</span> Workpaper ΦΜΥ
            </button>
          </div>
        </section>
      </ng-container>
    </ng-container>
  `,
  styles: [`
    .company-picker { min-width: 330px; }
    .company-picker select { margin-top: .35rem; }
    .section-tabs { display:flex; gap:.5rem; margin:0 0 1rem; border-bottom:1px solid var(--border-color); }
    .section-tabs button { border:0; background:transparent; padding:.8rem 1rem; cursor:pointer; color:var(--text-muted); font-weight:700; }
    .section-tabs button.active { color:var(--primary-color); border-bottom:3px solid var(--primary-color); }
    .card { margin-bottom:1rem; }
    .form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1rem; }
    label { display:flex; flex-direction:column; gap:.35rem; font-size:.82rem; font-weight:700; color:var(--text-secondary); }
    .wide { grid-column:1/-1; }
    .check { flex-direction:row; align-items:center; align-self:end; min-height:40px; }
    .check input { width:auto; }
    .form-actions,.card-actions { display:flex; justify-content:flex-end; gap:.6rem; margin-top:1rem; }
    .period-controls { display:grid; grid-template-columns:repeat(3,minmax(0,220px)); gap:1rem; margin-bottom:1rem; }
    .inline-fields { display:grid; grid-template-columns:1fr 1fr; gap:.5rem; }
    .schedule-days { display:flex; flex-direction:column; gap:.45rem; font-size:.82rem; font-weight:700; color:var(--text-secondary); }
    .weekday-options { display:flex; flex-wrap:wrap; gap:.45rem; }
    .weekday-options label { flex-direction:row; align-items:center; padding:.45rem .65rem; border:1px solid var(--border-color,#d7e0e7); border-radius:8px; background:var(--surface,#fff); }
    .weekday-options input { width:auto; }
    .event-guidance { padding:.75rem; border-radius:8px; background:#eef6fb; color:#365363; font-size:.82rem; }
    .compact { margin:0; }
    .compact input { min-width:80px; padding:.45rem; }
    td small { display:block; color:var(--text-muted); margin-top:.2rem; }
    .status { display:inline-flex; border-radius:999px; padding:.25rem .6rem; background:#eef2f6; font-size:.75rem; font-weight:800; }
    .status.ok { color:#176b45; background:#dff5e9; }
    .status.danger { color:#a32020; background:#fde7e7; }
    .row-actions { display:flex; gap:.35rem; justify-content:flex-end; }
    .totals { display:grid; grid-template-columns:repeat(5,1fr); gap:.75rem; padding:1rem; }
    .totals div { background:var(--surface-muted,#f6f8fa); border-radius:8px; padding:.75rem; }
    .totals span,.totals strong { display:block; }
    .totals span { color:var(--text-muted); font-size:.75rem; margin-bottom:.3rem; }
    .compliance-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:.75rem; padding:0 1rem 1rem; }
    .compliance-item { position:relative; border:1px solid var(--border-color,#d7e0e7); border-radius:10px; padding:.85rem; background:var(--surface,#fff); }
    .compliance-item.late { border-color:#d14343; background:#fff5f5; }
    .compliance-item h3 { margin:0 0 .55rem; font-size:.92rem; }
    .compliance-item p { margin:.3rem 0; font-size:.78rem; }
    .compliance-item .pending { color:#9a5b00; font-weight:700; }
    .late-label { display:block; margin:.25rem 0; color:#a32020; font-size:.75rem; font-weight:800; }
    .danger-text { display:block; color:#a32020; font-weight:800; white-space:nowrap; }
    .compliance-actions { display:flex; flex-wrap:wrap; gap:.4rem; }
    .compliance-item .btn { margin-top:.45rem; }
    .empty-state { text-align:center; padding:4rem 1rem; }
    .empty-state .material-symbols-outlined { font-size:3rem; color:var(--text-muted); }
    @media(max-width:900px){ .form-grid,.period-controls,.totals,.compliance-grid{grid-template-columns:1fr}.wide{grid-column:auto}.company-picker{min-width:0}.page-header{align-items:stretch} }
  `],
})
export class PayrollPageComponent implements OnInit {
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly payrollApi = inject(PayrollApiService);
  private readonly auth = inject(AuthService);

  companies: ClientCompany[] = [];
  companyId = '';
  tab: 'period' | 'employees' | 'ergani' | 'leaves' | 'terminations' | 'settings' = 'period';
  message = '';
  errorMessage = '';
  workspace: PayrollWorkspace = {
    employees: [],
    periods: [],
    events: [],
    leaves: [],
    leaveBalances: [],
    terminations: [],
    erganiDeclarations: [],
  };
  settings = this.emptySettings();
  employee = this.emptyEmployee();
  contract = this.emptyContract();
  period = { year: 2026, month: new Date().getMonth() + 1, declarationType: 'NORMAL' };
  event = this.emptyEvent();
  leave = this.emptyLeave();
  termination = this.emptyTermination();
  erganiDeclaration = this.emptyErganiDeclaration();
  readonly erganiChangeTypes: Array<{
    value: Exclude<
      PayrollErganiDeclarationType,
      'HIRING' | 'INITIAL_WORK_SCHEDULE'
    >;
    label: string;
  }> = [
    { value: 'WORK_SCHEDULE_CHANGE', label: 'Αλλαγή οργάνωσης χρόνου εργασίας' },
    { value: 'PAY_CHANGE_AGREEMENT', label: 'Μεταβολή αποδοχών κατόπιν συμφωνίας' },
    { value: 'PAY_CHANGE_LEGISLATION', label: 'Μεταβολή αποδοχών από νόμο ή ΣΣΕ' },
    { value: 'SPECIALTY_CHANGE', label: 'Μεταβολή ειδικότητας' },
    { value: 'WORKPLACE_CHANGE', label: 'Μεταβολή τόπου εργασίας' },
    { value: 'PART_TIME_TO_FULL_TIME', label: 'Μερική/εκ περιτροπής σε πλήρη' },
    { value: 'FULL_TIME_TO_PART_TIME', label: 'Πλήρης σε μερική' },
    { value: 'FULL_TIME_TO_ROTATING', label: 'Πλήρης σε εκ περιτροπής' },
    { value: 'FULL_TIME_TO_ROTATING_UNILATERAL', label: 'Μονομερής εκ περιτροπής' },
    { value: 'FIXED_TO_OPEN_ENDED', label: 'Ορισμένου σε αορίστου χρόνου' },
    { value: 'FIXED_TERM_EXTENSION', label: 'Παράταση σύμβασης ορισμένου χρόνου' },
    { value: 'DIGITAL_CARD_ENROLLMENT', label: 'Ένταξη στην ψηφιακή κάρτα' },
    { value: 'EXECUTIVE_STATUS_ACQUIRED', label: 'Κτήση ιδιότητας διευθυντικού στελέχους' },
    { value: 'EXECUTIVE_STATUS_LOST', label: 'Απώλεια ιδιότητας διευθυντικού στελέχους' },
    { value: 'WORK_TIME_ARRANGEMENT', label: 'Διευθέτηση χρόνου εργασίας' },
    { value: 'OTHER', label: 'Άλλη μεταβολή' },
  ];
  readonly weekdays = [
    { value: 1, label: 'Δευ' },
    { value: 2, label: 'Τρι' },
    { value: 3, label: 'Τετ' },
    { value: 4, label: 'Πεμ' },
    { value: 5, label: 'Παρ' },
    { value: 6, label: 'Σαβ' },
    { value: 7, label: 'Κυρ' },
  ];
  private readonly overrideForms: Record<string, EntryOverrideForm> = {};
  editingEmployeeId = '';
  editingContractId = '';

  ngOnInit() {
    this.companiesApi.findAll().subscribe({
      next: (companies) => (this.companies = companies),
      error: (error) => this.fail(error),
    });
  }

  get employeesWithContracts(): PayrollEmployee[] {
    return this.workspace.employees.filter((item) => item.status === 'ACTIVE' && item.contracts.length);
  }

  get eventsForSelectedPeriod(): PayrollEvent[] {
    return this.workspace.events.filter(
      (item) =>
        item.periodYear === Number(this.event.periodYear) &&
        item.periodMonth === Number(this.event.periodMonth),
    );
  }

  get canApprove(): boolean {
    const role = this.auth.user()?.role;
    return !!role && ACCOUNTING_CONTROL_ROLES.includes(role);
  }

  workdaySelected(day: number): boolean {
    return this.contract.workWeekdays
      .split(',')
      .filter(Boolean)
      .map(Number)
      .includes(day);
  }

  toggleWorkday(day: number) {
    const selected = new Set(
      this.contract.workWeekdays.split(',').filter(Boolean).map(Number),
    );
    if (selected.has(day)) selected.delete(day);
    else selected.add(day);
    const days = [...selected].sort((a, b) => a - b);
    if (days.length > 6) {
      this.fail({ error: { message: 'Επιτρέπονται έως έξι ημέρες εργασίας την εβδομάδα.' } });
      return;
    }
    this.contract.workWeekdays = days.join(',');
    this.contract.workDaysPerWeek = days.length;
    this.contract.weeklySystem = days.length === 6 ? 'SIX_DAY' : 'FIVE_DAY';
  }

  workdayLabels(value: string): string {
    const labels = new Map(this.weekdays.map((day) => [day.value, day.label]));
    return value
      .split(',')
      .filter(Boolean)
      .map((day) => labels.get(Number(day)) ?? day)
      .join(', ');
  }

  loadWorkspace() {
    this.clearMessages();
    if (!this.companyId) {
      this.workspace = {
        employees: [],
        periods: [],
        events: [],
        leaves: [],
        leaveBalances: [],
        terminations: [],
        erganiDeclarations: [],
      };
      return;
    }
    this.payrollApi.workspace(this.companyId).subscribe({
      next: (workspace) => {
        this.workspace = workspace;
        this.settings = workspace.settings
          ? {
              ...workspace.settings,
              efkaPaymentRf: workspace.settings.efkaPaymentRf ?? '',
              tekaPaymentRf: workspace.settings.tekaPaymentRf ?? '',
            }
          : this.emptySettings();
      },
      error: (error) => this.fail(error),
    });
  }

  saveSettings() {
    this.payrollApi.saveSettings({
      ...this.settings,
      clientCompanyId: this.companyId,
      efkaPaymentRf: this.settings.efkaPaymentRf || undefined,
      tekaPaymentRf: this.settings.tekaPaymentRf || undefined,
    }).subscribe({
      next: () => this.done('Τα στοιχεία εργοδότη ΑΠΔ αποθηκεύτηκαν.'),
      error: (error) => this.fail(error),
    });
  }

  createEmployee() {
    const request = this.editingEmployeeId
      ? this.payrollApi.updateEmployee(this.editingEmployeeId, { ...this.employee })
      : this.payrollApi.createEmployee({ ...this.employee, clientCompanyId: this.companyId });
    request.subscribe({
      next: () => {
        const edited = !!this.editingEmployeeId;
        this.cancelEmployeeEdit();
        this.done(edited ? 'Ο εργαζόμενος ενημερώθηκε.' : 'Ο εργαζόμενος καταχωρίστηκε.');
      },
      error: (error) => this.fail(error),
    });
  }

  createContract() {
    const payload: Record<string, unknown> = { ...this.contract };
    if (this.editingContractId) delete payload['employeeId'];
    if (!this.editingContractId) delete payload['erganiDeclarationType'];
    if (!payload['erganiDeclarationType']) delete payload['erganiDeclarationType'];
    if (payload['erganiEffectiveAt']) {
      payload['erganiEffectiveAt'] = new Date(
        String(payload['erganiEffectiveAt']),
      ).toISOString();
    } else {
      delete payload['erganiEffectiveAt'];
    }
    if (this.contract.compensationType === 'MONTHLY') {
      delete payload['dailyWage'];
      delete payload['statutoryDailyWage'];
      if (!payload['statutoryMonthlySalary']) delete payload['statutoryMonthlySalary'];
    } else {
      delete payload['monthlySalary'];
      delete payload['statutoryMonthlySalary'];
      if (!payload['statutoryDailyWage']) delete payload['statutoryDailyWage'];
    }
    if (!payload['endDate']) delete payload['endDate'];
    const request = this.editingContractId
      ? this.payrollApi.updateContract(this.editingContractId, payload)
      : this.payrollApi.createContract(payload);
    request.subscribe({
      next: () => {
        const edited = !!this.editingContractId;
        this.cancelContractEdit();
        this.done(
          edited
            ? 'Η σύμβαση ενημερώθηκε. Αν άλλαξαν ουσιώδεις όροι, δημιουργήθηκε η αντίστοιχη μεταβολή ΕΡΓΑΝΗ ΙΙ.'
            : 'Η σύμβαση καταχωρίστηκε. Ολοκληρώστε τώρα την πρόσληψη και την αρχική δήλωση ωραρίου στην καρτέλα ΕΡΓΑΝΗ ΙΙ.',
        );
      },
      error: (error) => this.fail(error),
    });
  }

  editEmployee(item: PayrollEmployee) {
    this.editingEmployeeId = item.id;
    this.employee = {
      code: item.code,
      status: item.status,
      lastName: item.lastName,
      firstName: item.firstName,
      fatherName: item.fatherName,
      motherName: item.motherName,
      birthDate: item.birthDate.slice(0, 10),
      afm: item.afm,
      amka: item.amka,
      insuranceRegistryNumber: item.insuranceRegistryNumber,
      dependentChildren: item.dependentChildren,
      recognizedPriorServiceYears: item.recognizedPriorServiceYears,
      tekaInsured: item.tekaInsured,
    };
    this.tab = 'employees';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEmployeeEdit() {
    this.editingEmployeeId = '';
    this.employee = this.emptyEmployee();
  }

  editContract(item: PayrollEmployee['contracts'][number]) {
    this.editingContractId = item.id;
    this.contract = {
      employeeId: item.employeeId,
      startDate: item.startDate.slice(0, 10),
      erganiEffectiveAt: '',
      erganiDeclarationType: '',
      endDate: item.endDate?.slice(0, 10) ?? '',
      compensationType: item.compensationType,
      monthlySalary: Number(item.monthlySalary ?? 0),
      dailyWage: Number(item.dailyWage ?? 0),
      statutoryMonthlySalary:
        item.statutoryMonthlySalary == null ? null : Number(item.statutoryMonthlySalary),
      statutoryDailyWage:
        item.statutoryDailyWage == null ? null : Number(item.statutoryDailyWage),
      fullTime: item.fullTime,
      weeklySystem: item.weeklySystem,
      weeklyHours: Number(item.weeklyHours),
      workDaysPerWeek: item.workDaysPerWeek,
      workWeekdays: item.workWeekdays,
      dailyStartTime: item.dailyStartTime,
      dailyEndTime: item.dailyEndTime,
      breakMinutes: item.breakMinutes,
      breakWithinWorkingTime: item.breakWithinWorkingTime,
      digitalCardEnabled: item.digitalCardEnabled,
      flexibleArrivalMinutes: item.flexibleArrivalMinutes,
      apdBranchNumber: item.apdBranchNumber,
      apdKad: item.apdKad,
      apdSpecialtyCode: item.apdSpecialtyCode,
      apdSpecialInsuranceCase: item.apdSpecialInsuranceCase,
      apdCoveragePackageCode: item.apdCoveragePackageCode,
      externalSupplementaryFund: item.externalSupplementaryFund,
      externalHealthFund: item.externalHealthFund,
      employeeContributionRate: Number(item.employeeContributionRate),
      employerContributionRate: Number(item.employerContributionRate),
    };
    this.tab = 'employees';
  }

  cancelContractEdit() {
    this.editingContractId = '';
    this.contract = this.emptyContract();
  }

  hasPendingHiring(contractId: string): boolean {
    return this.workspace.erganiDeclarations.some(
      (item) =>
        item.contractId === contractId &&
        item.type === 'HIRING' &&
        item.status === 'DRAFT',
    );
  }

  deleteContract(contractId: string) {
    if (
      !window.confirm(
        'Να ακυρωθεί η νέα σύμβαση και η πρόχειρη αναγγελία πρόσληψης;',
      )
    ) {
      return;
    }
    this.payrollApi.deleteContract(contractId).subscribe({
      next: () => this.done('Η νέα σύμβαση και η πρόχειρη πρόσληψη ακυρώθηκαν.'),
      error: (error) => this.fail(error),
    });
  }

  createErganiDeclaration() {
    this.payrollApi
      .createErganiDeclaration({
        ...this.erganiDeclaration,
        effectiveAt: new Date(
          this.erganiDeclaration.effectiveAt,
        ).toISOString(),
        notes: this.erganiDeclaration.notes || undefined,
      })
      .subscribe({
        next: () => {
          this.erganiDeclaration = this.emptyErganiDeclaration();
          this.done(
            'Η μεταβολή προετοιμάστηκε. Υποβάλετέ την στο ΕΡΓΑΝΗ ΙΙ και περάστε το πραγματικό πρωτόκολλο.',
          );
        },
        error: (error) => this.fail(error),
      });
  }

  completeErganiDeclaration(item: PayrollErganiDeclaration) {
    const erganiProtocol = window
      .prompt('Πραγματικός αριθμός πρωτοκόλλου ΕΡΓΑΝΗ ΙΙ:')
      ?.trim();
    if (!erganiProtocol) return;
    const submittedInput = window
      .prompt(
        'Πραγματική ημερομηνία και ώρα υποβολής (ΕΕΕΕ-ΜΜ-ΗΗ ΩΩ:ΛΛ):',
        this.localDateTime(new Date()),
      )
      ?.trim();
    if (!submittedInput) return;
    const payload: Record<string, unknown> = {
      erganiProtocol,
      erganiSubmittedAt: new Date(submittedInput).toISOString(),
    };
    if (
      item.type !== 'PAY_CHANGE_LEGISLATION' &&
      item.type !== 'INITIAL_WORK_SCHEDULE'
    ) {
      const acceptanceMethod = window
        .prompt(
          'Τρόπος αποδοχής: MYERGANI, SIGNED_SCAN, QUALIFIED_E_SIGNATURE ή GOV_GR_DIGITAL_CONFIRMATION',
          'MYERGANI',
        )
        ?.trim()
        .toUpperCase();
      if (
        !acceptanceMethod ||
        ![
          'MYERGANI',
          'SIGNED_SCAN',
          'QUALIFIED_E_SIGNATURE',
          'GOV_GR_DIGITAL_CONFIRMATION',
        ].includes(acceptanceMethod)
      ) {
        return;
      }
      const acceptanceReference = window
        .prompt(
          'Αποδεικτικό αποδοχής (όνομα αρχείου, κωδικός gov.gr ή αναφορά MyErgani):',
        )
        ?.trim();
      if (!acceptanceReference) return;
      const acceptedInput = window
        .prompt(
          'Ημερομηνία και ώρα αποδοχής εργαζομένου (ΕΕΕΕ-ΜΜ-ΗΗ ΩΩ:ΛΛ):',
          this.localDateTime(new Date(item.effectiveAt)),
        )
        ?.trim();
      if (!acceptedInput) return;
      payload['acceptanceMethod'] = acceptanceMethod;
      payload['acceptanceReference'] = acceptanceReference;
      payload['acceptedAt'] = new Date(acceptedInput).toISOString();
    }
    this.payrollApi.completeErganiDeclaration(item.id, payload).subscribe({
      next: (completed) =>
        this.done(
          completed.lateSubmission
            ? 'Το πρωτόκολλο καταχωρίστηκε, αλλά η πραγματική υποβολή είναι εκπρόθεσμη.'
            : 'Η δήλωση ΕΡΓΑΝΗ ΙΙ ολοκληρώθηκε και η μισθοδοσία μπορεί να συνεχίσει.',
        ),
      error: (error) => this.fail(error),
    });
  }

  deleteErganiDeclaration(item: PayrollErganiDeclaration) {
    if (!window.confirm('Να διαγραφεί η πρόχειρη δήλωση ΕΡΓΑΝΗ ΙΙ;')) return;
    this.payrollApi.deleteErganiDeclaration(item.id).subscribe({
      next: () => this.done('Η πρόχειρη δήλωση ΕΡΓΑΝΗ ΙΙ διαγράφηκε.'),
      error: (error) => this.fail(error),
    });
  }

  erganiTypeName(type: PayrollErganiDeclarationType): string {
    if (type === 'HIRING') return 'Ψηφιακή Αναγγελία Έναρξης Εργασίας';
    if (type === 'INITIAL_WORK_SCHEDULE') {
      return 'Αρχική Ψηφιακή Οργάνωση Χρόνου Εργασίας';
    }
    return this.erganiChangeTypes.find((option) => option.value === type)?.label ?? type;
  }

  erganiAcceptanceName(method: NonNullable<PayrollErganiDeclaration['acceptanceMethod']>): string {
    return {
      SIGNED_SCAN: 'Υπογεγραμμένο σαρωμένο έντυπο',
      QUALIFIED_E_SIGNATURE: 'Εγκεκριμένη ηλεκτρονική υπογραφή',
      GOV_GR_DIGITAL_CONFIRMATION: 'Ψηφιακή βεβαίωση gov.gr',
      MYERGANI: 'Αποδοχή MyErgani',
    }[method];
  }

  isErganiOverdue(item: PayrollErganiDeclaration): boolean {
    return (
      item.status === 'DRAFT' &&
      new Date(item.deadlineAt).getTime() < Date.now()
    );
  }

  override(employeeId: string): EntryOverrideForm {
    return (this.overrideForms[employeeId] ??= {
      overtimeGross: 0,
      nightHours: 0,
      sundayHolidayHours: 0,
      extraWorkHours: 0,
      legalOvertimeHours: 0,
      approvedOvertimeHours: 0,
      illegalOvertimeHours: 0,
      partTimeAdditionalHours: 0,
      overtimeErganiProtocol: '',
      bonusGross: 0,
      otherGross: 0,
      otherDeductions: 0,
    });
  }

  calculate() {
    const overrides = this.employeesWithContracts.map((item) => ({
      employeeId: item.id,
      ...this.override(item.id),
    }));
    this.payrollApi.calculate({
      clientCompanyId: this.companyId,
      periodYear: Number(this.period.year),
      periodMonth: Number(this.period.month),
      declarationType: this.period.declarationType,
      overrides,
    }).subscribe({
      next: () => this.done('Η μισθοδοσία υπολογίστηκε. Ελέγξτε τα ποσά πριν την έγκριση.'),
      error: (error) => this.fail(error),
    });
  }

  leaveBalance(employeeId: string) { return this.workspace.leaveBalances.find((item) => item.employeeId === employeeId); }
  createLeave() {
    const payload: Record<string, unknown> = { ...this.leave };
    ['notes', 'employeeRequestReference', 'externalBenefitReference', 'erganiProtocol', 'erganiSubmittedAt'].forEach((key) => {
      if (!payload[key]) delete payload[key];
    });
    if (payload['erganiSubmittedAt']) {
      payload['erganiSubmittedAt'] = new Date(String(payload['erganiSubmittedAt'])).toISOString();
    }
    this.payrollApi.createLeave(payload).subscribe({
      next: () => { this.leave = this.emptyLeave(); this.done('Η άδεια καταχωρίστηκε και θα ληφθεί υπόψη στην αντίστοιχη μισθοδοσία.'); },
      error: (error) => this.fail(error),
    });
  }
  leaveTypeChanged() {
    const sourceByType: Record<string, string> = {
      ANNUAL: 'EMPLOYER',
      UNPAID: 'UNPAID',
      MATERNITY: 'E_EFKA_DYPA',
      SPECIAL_MATERNITY_PROTECTION: 'DYPA',
      PATERNITY: 'EMPLOYER',
      PARENTAL: 'DYPA',
      CAREGIVER: 'EMPLOYER',
      OTHER: 'EMPLOYER',
    };
    this.leave.paymentSource = sourceByType[this.leave.type] ?? 'EMPLOYER';
    this.leave.employerGrossAmount = 0;
  }
  leaveTypeName(type: string): string {
    return {
      ANNUAL: 'Κανονική',
      UNPAID: 'Άνευ αποδοχών',
      SICK: 'Ασθένεια',
      MATERNITY: 'Κυοφορίας/λοχείας',
      SPECIAL_MATERNITY_PROTECTION: 'Ειδική προστασία μητρότητας',
      PATERNITY: 'Πατρότητας',
      PARENTAL: 'Γονική',
      CAREGIVER: 'Φροντιστή',
      OTHER: 'Άλλη',
    }[type] ?? type;
  }
  leavePaymentName(source: PayrollLeave['paymentSource']): string {
    return {
      EMPLOYER: 'Εργοδότης',
      E_EFKA_DYPA: 'e-ΕΦΚΑ / ΔΥΠΑ',
      DYPA: 'ΔΥΠΑ',
      UNPAID: 'Χωρίς αποδοχές',
      MIXED: 'Μικτή',
    }[source];
  }
  deleteLeave(item: PayrollLeave) {
    this.payrollApi.deleteLeave(item.id).subscribe({ next: () => this.done('Η άδεια διαγράφηκε.'), error: (error) => this.fail(error) });
  }

  prefillTerminationEarnings() {
    const employee = this.workspace.employees.find(
      (item) => item.id === this.termination.employeeId,
    );
    const contract = employee?.contracts[0];
    if (!contract) return;
    this.termination.regularMonthlyEarnings =
      contract.compensationType === 'MONTHLY'
        ? Number(contract.monthlySalary ?? 0)
        : Number(contract.dailyWage ?? 0) * 25;
  }

  createTermination() {
    const payload: Record<string, unknown> = { ...this.termination };
    if (
      payload['severanceAmount'] === null ||
      payload['severanceAmount'] === undefined ||
      payload['severanceAmount'] === ''
    ) {
      delete payload['severanceAmount'];
    }
    if (!payload['notes']) delete payload['notes'];
    this.payrollApi.createTermination(payload).subscribe({
      next: (created) => {
        this.termination = this.emptyTermination();
        this.done(
          `Η λύση σύμβασης προετοιμάστηκε. Νόμιμη αποζημίωση ${Number(created.statutorySeverance).toFixed(2)} €.`,
        );
      },
      error: (error) => this.fail(error),
    });
  }

  completeTermination(item: PayrollTermination) {
    const erganiProtocol = window.prompt(
      'Αριθμός πρωτοκόλλου της Ψηφιακής Αναγγελίας Λύσης Απασχόλησης στην ΕΡΓΑΝΗ ΙΙ:',
      item.erganiProtocol ?? '',
    )?.trim();
    if (!erganiProtocol) return;
    const today = new Date().toISOString().slice(0, 10);
    const paymentRequired = Number(item.severanceAmount) > 0;
    const paymentDate = paymentRequired
      ? window.prompt('Ημερομηνία τραπεζικής πληρωμής αποζημίωσης (ΕΕΕΕ-ΜΜ-ΗΗ):', today)?.trim()
      : undefined;
    if (paymentRequired && !paymentDate) return;
    const paymentReference = paymentRequired
      ? window.prompt('Τραπεζικό αποδεικτικό / κωδικός συναλλαγής αποζημίωσης:')?.trim()
      : undefined;
    if (paymentRequired && !paymentReference) return;
    this.payrollApi.completeTermination(item.id, {
      erganiProtocol,
      erganiSubmittedAt: new Date().toISOString(),
      paymentDate,
      paymentReference,
    }).subscribe({
      next: () => this.done('Η λύση ολοκληρώθηκε, η σύμβαση έκλεισε και ο εργαζόμενος ενημερώθηκε.'),
      error: (error) => this.fail(error),
    });
  }

  deleteTermination(item: PayrollTermination) {
    if (!window.confirm('Να διαγραφεί η πρόχειρη διαδικασία λύσης σύμβασης;')) return;
    this.payrollApi.deleteTermination(item.id).subscribe({
      next: () => this.done('Η πρόχειρη διαδικασία λύσης διαγράφηκε.'),
      error: (error) => this.fail(error),
    });
  }

  terminationTypeName(type: string): string {
    return {
      EMPLOYER_DISMISSAL: 'Καταγγελία από εργοδότη',
      VOLUNTARY_RESIGNATION: 'Οικειοθελής αποχώρηση',
      FIXED_TERM_EXPIRY: 'Λήξη ορισμένου χρόνου',
      RETIREMENT: 'Συνταξιοδότηση',
      DEATH: 'Θάνατος',
      OTHER: 'Άλλη περίπτωση',
    }[type] ?? type;
  }

  createEvent() {
    const payload: Record<string, unknown> = { ...this.event };
    if (payload['grossAmount'] === null || payload['grossAmount'] === '') delete payload['grossAmount'];
    if (!payload['leaveDays']) delete payload['leaveDays'];
    if (!payload['notes']) delete payload['notes'];
    if (!payload['dateFrom']) delete payload['dateFrom'];
    if (!payload['dateTo']) delete payload['dateTo'];
    if (!payload['medicalCertificateReference']) delete payload['medicalCertificateReference'];
    if (this.event.type !== 'SICKNESS') {
      delete payload['sicknessBenefitStatus'];
      delete payload['medicalCertificateReference'];
      delete payload['dateFrom'];
      delete payload['dateTo'];
    }
    if (
      this.event.type === 'SICKNESS' &&
      this.event.sicknessBenefitStatus !== 'APPROVED'
    ) {
      payload['efkaBenefit'] = 0;
    }
    this.payrollApi.createEvent(payload).subscribe({
      next: (created) => {
        this.event = { ...this.emptyEvent(), periodYear: created.periodYear, periodMonth: created.periodMonth };
        this.period.year = created.periodYear;
        this.period.month = created.periodMonth;
        this.done(`Η ειδική αποδοχή καταχωρίστηκε: ${Number(created.grossAmount).toFixed(2)} €.`);
      },
      error: (error) => this.fail(error),
    });
  }

  resolveSickness(item: PayrollEvent) {
    const selected = window.prompt(
      'Γράψτε APPROVED αν εγκρίθηκε ή NOT_ELIGIBLE αν δεν δικαιούται επίδομα:',
      'APPROVED',
    )?.trim().toUpperCase();
    if (selected !== 'APPROVED' && selected !== 'NOT_ELIGIBLE') return;
    const amount =
      selected === 'APPROVED'
        ? Number(window.prompt('Εγκεκριμένο ποσό e-ΕΦΚΑ που αφορά αυτή τη μισθολογική περίοδο:', '0'))
        : 0;
    if (selected === 'APPROVED' && (!Number.isFinite(amount) || amount <= 0)) return;
    this.payrollApi.updateSickness(item.id, {
      sicknessBenefitStatus: selected,
      efkaBenefit: amount,
      insuranceDays: item.insuranceDays,
      medicalCertificateReference: item.medicalCertificateReference,
      notes: item.notes ?? undefined,
    }).subscribe({
      next: (updated) =>
        this.done(
          `Η αναρρωτική απουσία ενημερώθηκε. Εργοδοτικές αποδοχές ${Number(updated.grossAmount).toFixed(2)} €.`,
        ),
      error: (error) => this.fail(error),
    });
  }

  sicknessStatusName(
    status: PayrollEvent['sicknessBenefitStatus'],
  ): string {
    const names: Record<string, string> = {
      PENDING: 'Εκκρεμεί απόφαση e-ΕΦΚΑ',
      APPROVED: 'Επίδομα e-ΕΦΚΑ εγκεκριμένο',
      NOT_ELIGIBLE: 'Χωρίς δικαίωμα επιδόματος',
    };
    return names[status ?? ''] ?? '';
  }

  deleteEvent(item: PayrollEvent) {
    this.payrollApi.deleteEvent(item.id).subscribe({
      next: () => this.done('Η ειδική αποδοχή διαγράφηκε.'),
      error: (error) => this.fail(error),
    });
  }

  eventTypeName(type: PayrollEvent['type']): string {
    return {
      CHRISTMAS_BONUS: 'Δώρο Χριστουγέννων',
      EASTER_BONUS: 'Δώρο Πάσχα',
      LEAVE_ALLOWANCE: 'Επίδομα αδείας',
      SICKNESS: 'Αποδοχές ασθενείας',
      RETROACTIVE: 'Αναδρομικά',
      BONUS: 'Bonus',
      OVERTIME: 'Υπερωρίες',
    }[type];
  }

  earningsTypeName(type: string): string {
    return {
      '001': 'Τακτικές',
      '003': 'Δώρο Χριστουγέννων',
      '004': 'Δώρο Πάσχα',
      '005': 'Επίδομα αδείας',
      '008': 'Ασθένεια',
      '009': 'Αναδρομικά',
      '010': 'Bonus',
      '011': 'Υπερωρίες',
    }[type] ?? `ΑΠΔ ${type}`;
  }

  approve(item: PayrollPeriod) {
    this.payrollApi.approve(item.id).subscribe({
      next: () => this.done('Η μισθοδοσία εγκρίθηκε και κλειδώθηκε.'),
      error: (error) => this.fail(error),
    });
  }

  markPaid(item: PayrollPeriod) {
    const paymentDate = new Date().toISOString().slice(0, 10);
    this.payrollApi.markPaid(item.id, paymentDate).subscribe({
      next: () => this.done('Η πληρωμή μισθών καταχωρίστηκε.'),
      error: (error) => this.fail(error),
    });
  }

  contributionTotal(item: PayrollPeriod): number {
    return (
      Number(item.totalEmployeeContributions) +
      Number(item.totalEmployerContributions)
    );
  }

  efkaContributionTotal(item: PayrollPeriod): number {
    return Math.max(
      0,
      this.contributionTotal(item) - Number(item.tekaContributionAmount),
    );
  }

  editComplianceDeadlines(item: PayrollPeriod) {
    const apdSubmissionDeadline = window.prompt(
      'Καταληκτική ημερομηνία υποβολής ΑΠΔ (YYYY-MM-DD)',
      this.dateInput(item.apdSubmissionDeadline),
    );
    if (apdSubmissionDeadline === null) return;
    const contributionsPaymentDeadline = window.prompt(
      'Καταληκτική ημερομηνία πληρωμής εισφορών (YYYY-MM-DD)',
      this.dateInput(item.contributionsPaymentDeadline),
    );
    if (contributionsPaymentDeadline === null) return;
    const fmySubmissionDeadline = window.prompt(
      'Καταληκτική ημερομηνία δήλωσης και πληρωμής ΦΜΥ (YYYY-MM-DD)',
      this.dateInput(item.fmySubmissionDeadline),
    );
    if (fmySubmissionDeadline === null) return;
    this.payrollApi
      .updateComplianceDeadlines(item.id, {
        apdSubmissionDeadline,
        contributionsPaymentDeadline,
        fmySubmissionDeadline,
      })
      .subscribe({
        next: () => this.done('Οι προθεσμίες ΑΠΔ και ΦΜΥ ενημερώθηκαν.'),
        error: (error) => this.fail(error),
      });
  }

  completeApdSubmission(item: PayrollPeriod) {
    const protocol = window.prompt(
      'Αριθμός πρωτοκόλλου επιτυχούς υποβολής ΑΠΔ',
      item.apdProtocol ?? '',
    );
    if (!protocol?.trim()) return;
    const submittedDate = window.prompt(
      'Ημερομηνία επιτυχούς υποβολής ΑΠΔ (YYYY-MM-DD)',
      this.dateInput(item.apdSubmittedAt) || this.today(),
    );
    if (!submittedDate) return;
    this.payrollApi
      .completeApdSubmission(item.id, {
        protocol: protocol.trim(),
        submittedAt: this.localNoonIso(submittedDate),
      })
      .subscribe({
        next: () => this.done('Η επιτυχής υποβολή ΑΠΔ καταχωρίστηκε.'),
        error: (error) => this.fail(error),
      });
  }

  markContributionsPaid(item: PayrollPeriod) {
    const paymentDate = window.prompt(
      'Ημερομηνία πληρωμής εισφορών (YYYY-MM-DD)',
      this.dateInput(item.contributionsPaymentDate) || this.today(),
    );
    if (!paymentDate) return;
    const paymentReference = window.prompt(
      'Αποδεικτικό / αναφορά τραπεζικής πληρωμής εισφορών',
      item.contributionsPaymentReference ?? '',
    );
    if (!paymentReference?.trim()) return;
    this.payrollApi
      .markContributionsPaid(item.id, {
        paymentDate,
        paymentReference: paymentReference.trim(),
      })
      .subscribe({
        next: () => this.done('Η πληρωμή εισφορών e-ΕΦΚΑ καταχωρίστηκε.'),
        error: (error) => this.fail(error),
      });
  }

  completeTekaSubmission(item: PayrollPeriod) {
    const protocol = window.prompt(
      'Αριθμός πρωτοκόλλου επιτυχούς ΑΠΔ ΤΕΚΑ',
      item.tekaProtocol ?? '',
    );
    if (!protocol?.trim()) return;
    const submittedDate = window.prompt(
      'Ημερομηνία επιτυχούς ΑΠΔ ΤΕΚΑ (YYYY-MM-DD)',
      this.dateInput(item.tekaSubmittedAt) || this.today(),
    );
    if (!submittedDate) return;
    this.payrollApi
      .completeTekaSubmission(item.id, {
        protocol: protocol.trim(),
        submittedAt: this.localNoonIso(submittedDate),
      })
      .subscribe({
        next: () => this.done('Η επιτυχής ΑΠΔ ΤΕΚΑ καταχωρίστηκε.'),
        error: (error) => this.fail(error),
      });
  }

  markTekaPaid(item: PayrollPeriod) {
    const paymentDate = window.prompt(
      'Ημερομηνία πληρωμής ΤΕΚΑ (YYYY-MM-DD)',
      this.dateInput(item.tekaPaymentDate) || this.today(),
    );
    if (!paymentDate) return;
    const paymentReference = window.prompt(
      'Αποδεικτικό / αναφορά ξεχωριστής πληρωμής ΤΕΚΑ',
      item.tekaPaymentReference ?? '',
    );
    if (!paymentReference?.trim()) return;
    this.payrollApi
      .markTekaPaid(item.id, {
        paymentDate,
        paymentReference: paymentReference.trim(),
      })
      .subscribe({
        next: () => this.done('Η ξεχωριστή πληρωμή ΤΕΚΑ καταχωρίστηκε.'),
        error: (error) => this.fail(error),
      });
  }

  completeFmySubmission(item: PayrollPeriod) {
    const protocol = window.prompt(
      'Αριθμός πρωτοκόλλου δήλωσης ΦΜΥ',
      item.fmyProtocol ?? '',
    );
    if (!protocol?.trim()) return;
    const submittedDate = window.prompt(
      'Ημερομηνία υποβολής δήλωσης ΦΜΥ (YYYY-MM-DD)',
      this.dateInput(item.fmySubmittedAt) || this.today(),
    );
    if (!submittedDate) return;
    let debtId: string | undefined;
    if (Number(item.totalWithholdingTax) > 0) {
      const value = window.prompt(
        'Ταυτότητα Οφειλής ΦΜΥ',
        item.fmyDebtId ?? '',
      );
      if (!value?.trim()) return;
      debtId = value.trim();
    }
    this.payrollApi
      .completeFmySubmission(item.id, {
        protocol: protocol.trim(),
        submittedAt: this.localNoonIso(submittedDate),
        debtId,
      })
      .subscribe({
        next: () => this.done('Η δήλωση ΦΜΥ καταχωρίστηκε.'),
        error: (error) => this.fail(error),
      });
  }

  markFmyPaid(item: PayrollPeriod) {
    const paymentDate = window.prompt(
      'Ημερομηνία πληρωμής ΦΜΥ (YYYY-MM-DD)',
      this.dateInput(item.fmyPaymentDate) || this.today(),
    );
    if (!paymentDate) return;
    const paymentReference = window.prompt(
      'Αποδεικτικό / αναφορά τραπεζικής πληρωμής ΦΜΥ',
      item.fmyPaymentReference ?? '',
    );
    if (!paymentReference?.trim()) return;
    this.payrollApi
      .markFmyPaid(item.id, {
        paymentDate,
        paymentReference: paymentReference.trim(),
      })
      .subscribe({
        next: () => this.done('Η πληρωμή ΦΜΥ καταχωρίστηκε.'),
        error: (error) => this.fail(error),
      });
  }

  downloadApd(item: PayrollPeriod) {
    this.payrollApi.exportApd(item.id).subscribe({
      next: (blob) => {
        const company = this.companies.find((value) => value.id === this.companyId);
        const filename = `CSL01-${company?.vatNumber ?? 'APD'}-${item.periodYear}${String(item.periodMonth).padStart(2, '0')}.txt`;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
      },
      error: (error) => this.fail(error),
    });
  }

  downloadPayslip(item: PayrollPeriod, entry: PayrollPeriod['entries'][number]) {
    this.payrollApi.exportPayslip(item.id, entry.id).subscribe({
      next: (blob) =>
        this.saveBlob(
          blob,
          `ekka8aristiko-${entry.employee.lastName}-${item.periodYear}-${String(item.periodMonth).padStart(2, '0')}.html`,
        ),
      error: (error) => this.fail(error),
    });
  }

  isFirstEmployeeEntry(
    period: PayrollPeriod,
    entry: PayrollPeriod['entries'][number],
  ): boolean {
    return period.entries.find((value) => value.employee.id === entry.employee.id)?.id === entry.id;
  }

  downloadBankPayments(item: PayrollPeriod) {
    this.payrollApi.exportBankPayments(item.id).subscribe({
      next: (blob) =>
        this.saveBlob(
          blob,
          `payroll-payments-${item.periodYear}${String(item.periodMonth).padStart(2, '0')}.csv`,
        ),
      error: (error) => this.fail(error),
    });
  }

  downloadFmy(item: PayrollPeriod) {
    this.payrollApi.exportWithholdingWorkpaper(item.id).subscribe({
      next: (blob) =>
        this.saveBlob(
          blob,
          `FMY-workpaper-${item.periodYear}${String(item.periodMonth).padStart(2, '0')}.csv`,
        ),
      error: (error) => this.fail(error),
    });
  }

  statusName(status: PayrollPeriod['status']): string {
    return { DRAFT: 'Πρόχειρη', CALCULATED: 'Υπολογισμένη', APPROVED: 'Εγκεκριμένη', PAID: 'Πληρωμένη' }[status];
  }

  monthName(month: number): string {
    return new Intl.DateTimeFormat('el-GR', { month: 'long' }).format(new Date(2026, month - 1, 1));
  }

  private done(message: string) {
    this.message = message;
    this.errorMessage = '';
    this.loadWorkspace();
    this.message = message;
  }

  private saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private today(): string {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
  }

  private dateInput(value?: string | null): string {
    return value ? value.slice(0, 10) : '';
  }

  private localNoonIso(date: string): string {
    return new Date(`${date}T12:00:00`).toISOString();
  }

  private fail(error: unknown) {
    this.message = '';
    const response = error as HttpErrorResponse;
    const body = response.error as { message?: string | string[] } | undefined;
    this.errorMessage = Array.isArray(body?.message)
      ? body.message.join(' · ')
      : body?.message ?? 'Η ενέργεια απέτυχε.';
  }

  private clearMessages() {
    this.message = '';
    this.errorMessage = '';
  }

  private emptySettings() {
    return { employerRegistryNumber: '', submissionOfficeCode: '', submissionOfficeName: '', street: '', streetNumber: '', postalCode: '', city: '', efkaPaymentRf: '', tekaPaymentRf: '' };
  }

  private emptyEmployee() {
    return { code: '', status: 'ACTIVE', lastName: '', firstName: '', fatherName: '', motherName: '', birthDate: '', afm: '', amka: '', insuranceRegistryNumber: '', dependentChildren: 0, recognizedPriorServiceYears: 0, tekaInsured: false };
  }

  private emptyContract() {
    return {
      employeeId: '',
      startDate: '',
      erganiEffectiveAt: '',
      erganiDeclarationType: '',
      endDate: '',
      compensationType: 'MONTHLY',
      monthlySalary: 920,
      dailyWage: 41.09,
      statutoryMonthlySalary: null as number | null,
      statutoryDailyWage: null as number | null,
      fullTime: true,
      weeklySystem: 'FIVE_DAY',
      weeklyHours: 40,
      workDaysPerWeek: 5,
      workWeekdays: '1,2,3,4,5',
      dailyStartTime: '09:00',
      dailyEndTime: '17:00',
      breakMinutes: 0,
      breakWithinWorkingTime: false,
      digitalCardEnabled: false,
      flexibleArrivalMinutes: 0,
      apdBranchNumber: 0,
      apdKad: '',
      apdSpecialtyCode: '',
      apdSpecialInsuranceCase: '00',
      apdCoveragePackageCode: '101',
      externalSupplementaryFund: '00',
      externalHealthFund: '00',
      employeeContributionRate: 13.37,
      employerContributionRate: 21.79,
    };
  }

  private emptyEvent() {
    return {
      employeeId: '',
      periodYear: 2026,
      periodMonth: new Date().getMonth() + 1,
      type: 'CHRISTMAS_BONUS',
      insuranceDays: 0,
      leaveDays: null as number | null,
      efkaBenefit: 0,
      sicknessBenefitStatus: 'PENDING',
      medicalCertificateReference: '',
      dateFrom: '',
      dateTo: '',
      grossAmount: null as number | null,
      notes: '',
    };
  }

  private emptyLeave() {
    return {
      employeeId: '',
      type: 'ANNUAL',
      dateFrom: '',
      dateTo: '',
      workingDays: 1,
      paymentSource: 'EMPLOYER',
      employerGrossAmount: 0,
      employeeRequestReference: '',
      externalBenefitReference: '',
      erganiProtocol: '',
      erganiSubmittedAt: '',
      notes: '',
    };
  }

  private emptyTermination() {
    return {
      employeeId: '',
      type: 'EMPLOYER_DISMISSAL',
      terminationDate: new Date().toISOString().slice(0, 10),
      withNotice: false,
      regularMonthlyEarnings: 0,
      severanceAmount: null as number | null,
      notes: '',
    };
  }

  private emptyErganiDeclaration() {
    return {
      employeeId: '',
      type: 'WORK_SCHEDULE_CHANGE' as Exclude<
        PayrollErganiDeclarationType,
        'HIRING' | 'INITIAL_WORK_SCHEDULE'
      >,
      effectiveAt: this.localDateTime(new Date()),
      notes: '',
    };
  }

  private localDateTime(value: Date): string {
    const offset = value.getTimezoneOffset() * 60_000;
    return new Date(value.getTime() - offset).toISOString().slice(0, 16);
  }
}
