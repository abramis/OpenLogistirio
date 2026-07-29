import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PayrollEmployerSettings {
  id: string;
  clientCompanyId: string;
  employerRegistryNumber: string;
  submissionOfficeCode: string;
  submissionOfficeName: string;
  street: string;
  streetNumber: string;
  postalCode: string;
  city: string;
  efkaPaymentRf?: string | null;
  tekaPaymentRf?: string | null;
}

export interface PayrollContract {
  id: string;
  employeeId: string;
  startDate: string;
  endDate?: string | null;
  compensationType: 'MONTHLY' | 'DAILY';
  monthlySalary?: string | number | null;
  dailyWage?: string | number | null;
  statutoryMonthlySalary?: string | number | null;
  statutoryDailyWage?: string | number | null;
  fullTime: boolean;
  weeklySystem: 'FIVE_DAY' | 'SIX_DAY';
  weeklyHours: string | number;
  workDaysPerWeek: number;
  workWeekdays: string;
  dailyStartTime: string;
  dailyEndTime: string;
  breakMinutes: number;
  breakWithinWorkingTime: boolean;
  digitalCardEnabled: boolean;
  flexibleArrivalMinutes: number;
  apdBranchNumber: number;
  apdKad: string;
  apdSpecialtyCode: string;
  apdSpecialInsuranceCase: string;
  apdCoveragePackageCode: string;
  externalSupplementaryFund: string;
  externalHealthFund: string;
  employeeContributionRate: string | number;
  employerContributionRate: string | number;
}

export interface PayrollEmployee {
  id: string;
  clientCompanyId: string;
  code: string;
  status: 'ACTIVE' | 'INACTIVE';
  lastName: string;
  firstName: string;
  fatherName: string;
  motherName: string;
  birthDate: string;
  afm: string;
  amka: string;
  insuranceRegistryNumber: string;
  dependentChildren: number;
  recognizedPriorServiceYears: number;
  tekaInsured: boolean;
  contracts: PayrollContract[];
}

export interface PayrollEntry {
  id: string;
  apdEarningsType: string;
  insuranceDays: number;
  grossEarnings: string | number;
  contributionBase: string | number;
  contributionExempt: string | number;
  nightPremiumGross: string | number;
  sundayHolidayGross: string | number;
  extraWorkGross: string | number;
  legalOvertimeGross: string | number;
  approvedOvertimeGross: string | number;
  illegalOvertimeGross: string | number;
  partTimeExtraGross: string | number;
  leaveEmployerGross: string | number;
  employeeContributions: string | number;
  employerContributions: string | number;
  withholdingTax: string | number;
  netPayable: string | number;
  employee: PayrollEmployee;
}

export interface PayrollPeriod {
  id: string;
  periodYear: number;
  periodMonth: number;
  declarationType: 'NORMAL' | 'SUPPLEMENTARY';
  status: 'DRAFT' | 'CALCULATED' | 'APPROVED' | 'PAID';
  totalGross: string | number;
  totalEmployeeContributions: string | number;
  totalEmployerContributions: string | number;
  totalWithholdingTax: string | number;
  totalNet: string | number;
  paymentDate?: string | null;
  apdSubmissionDeadline?: string | null;
  apdSubmittedAt?: string | null;
  apdProtocol?: string | null;
  apdLateSubmission: boolean;
  contributionsPaymentDeadline?: string | null;
  contributionsPaymentDate?: string | null;
  contributionsPaymentReference?: string | null;
  contributionsLatePayment: boolean;
  tekaContributionAmount: string | number;
  tekaSubmittedAt?: string | null;
  tekaProtocol?: string | null;
  tekaLateSubmission: boolean;
  tekaPaymentDate?: string | null;
  tekaPaymentReference?: string | null;
  tekaLatePayment: boolean;
  fmySubmissionDeadline?: string | null;
  fmySubmittedAt?: string | null;
  fmyProtocol?: string | null;
  fmyDebtId?: string | null;
  fmyLateSubmission: boolean;
  fmyPaymentDate?: string | null;
  fmyPaymentReference?: string | null;
  fmyLatePayment: boolean;
  entries: PayrollEntry[];
}

export interface PayrollEvent {
  id: string;
  employeeId: string;
  periodYear: number;
  periodMonth: number;
  type:
    | 'CHRISTMAS_BONUS'
    | 'EASTER_BONUS'
    | 'LEAVE_ALLOWANCE'
    | 'SICKNESS'
    | 'RETROACTIVE'
    | 'BONUS'
    | 'OVERTIME';
  insuranceDays: number;
  leaveDays?: number | null;
  efkaBenefit: string | number;
  sicknessBenefitStatus?: 'PENDING' | 'APPROVED' | 'NOT_ELIGIBLE' | null;
  medicalCertificateReference?: string | null;
  grossAmount: string | number;
  autoCalculated: boolean;
  notes?: string | null;
  employee: { id: string; firstName: string; lastName: string };
}

export interface PayrollWorkspace {
  settings?: PayrollEmployerSettings | null;
  employees: PayrollEmployee[];
  periods: PayrollPeriod[];
  events: PayrollEvent[];
  leaves: PayrollLeave[];
  leaveBalances: Array<{ employeeId: string; fiscalYear: number; entitlement: number; taken: number; remaining: number }>;
  terminations: PayrollTermination[];
  erganiDeclarations: PayrollErganiDeclaration[];
}

export interface PayrollLeave {
  id: string; employeeId: string; fiscalYear: number; type: string; dateFrom: string; dateTo: string;
  workingDays: string | number; paid: boolean;
  paymentSource: 'EMPLOYER' | 'E_EFKA_DYPA' | 'DYPA' | 'UNPAID' | 'MIXED';
  employerGrossAmount: string | number;
  employeeRequestReference?: string | null;
  externalBenefitReference?: string | null;
  erganiProtocol?: string | null;
  erganiSubmittedAt?: string | null;
  notes?: string | null; payrollEventId?: string | null;
  employee: { id: string; firstName: string; lastName: string };
}

export interface PayrollTermination {
  id: string;
  employeeId: string;
  contractId: string;
  type: string;
  status: 'DRAFT' | 'COMPLETED';
  terminationDate: string;
  withNotice: boolean;
  noticeMonths: number;
  completedServiceYears: number;
  regularMonthlyEarnings: string | number;
  severanceMonths: string | number;
  statutorySeverance: string | number;
  severanceAmount: string | number;
  paymentDate?: string | null;
  paymentReference?: string | null;
  erganiProtocol?: string | null;
  erganiSubmittedAt?: string | null;
  employee: { id: string; firstName: string; lastName: string };
  contract: { id: string; startDate: string; endDate?: string | null };
}

export type PayrollErganiDeclarationType =
  | 'HIRING'
  | 'INITIAL_WORK_SCHEDULE'
  | 'WORK_SCHEDULE_CHANGE'
  | 'DIGITAL_CARD_ENROLLMENT'
  | 'EXECUTIVE_STATUS_ACQUIRED'
  | 'EXECUTIVE_STATUS_LOST'
  | 'PAY_CHANGE_AGREEMENT'
  | 'PAY_CHANGE_LEGISLATION'
  | 'SPECIALTY_CHANGE'
  | 'WORKPLACE_CHANGE'
  | 'PART_TIME_TO_FULL_TIME'
  | 'FULL_TIME_TO_PART_TIME'
  | 'FULL_TIME_TO_ROTATING'
  | 'FULL_TIME_TO_ROTATING_UNILATERAL'
  | 'FIXED_TO_OPEN_ENDED'
  | 'FIXED_TERM_EXTENSION'
  | 'WORK_TIME_ARRANGEMENT'
  | 'OTHER';

export interface PayrollErganiDeclaration {
  id: string;
  employeeId: string;
  contractId: string;
  type: PayrollErganiDeclarationType;
  status: 'DRAFT' | 'COMPLETED';
  effectiveAt: string;
  deadlineAt: string;
  erganiProtocol?: string | null;
  erganiSubmittedAt?: string | null;
  acceptanceMethod?:
    | 'SIGNED_SCAN'
    | 'QUALIFIED_E_SIGNATURE'
    | 'GOV_GR_DIGITAL_CONFIRMATION'
    | 'MYERGANI'
    | null;
  acceptanceReference?: string | null;
  acceptedAt?: string | null;
  lateSubmission: boolean;
  notes?: string | null;
  employee: { id: string; firstName: string; lastName: string };
  contract: { id: string; startDate: string; endDate?: string | null };
}

@Injectable({ providedIn: 'root' })
export class PayrollApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/payroll`;

  workspace(clientCompanyId: string): Observable<PayrollWorkspace> {
    return this.http.get<PayrollWorkspace>(this.baseUrl, {
      params: new HttpParams().set('clientCompanyId', clientCompanyId),
    });
  }

  saveSettings(payload: Record<string, unknown>): Observable<PayrollEmployerSettings> {
    return this.http.post<PayrollEmployerSettings>(`${this.baseUrl}/employer-settings`, payload);
  }

  createEmployee(payload: Record<string, unknown>): Observable<PayrollEmployee> {
    return this.http.post<PayrollEmployee>(`${this.baseUrl}/employees`, payload);
  }

  updateEmployee(id: string, payload: Record<string, unknown>): Observable<PayrollEmployee> {
    return this.http.patch<PayrollEmployee>(`${this.baseUrl}/employees/${id}`, payload);
  }

  createContract(payload: Record<string, unknown>): Observable<PayrollContract> {
    return this.http.post<PayrollContract>(`${this.baseUrl}/contracts`, payload);
  }

  createEvent(payload: Record<string, unknown>): Observable<PayrollEvent> {
    return this.http.post<PayrollEvent>(`${this.baseUrl}/events`, payload);
  }

  deleteEvent(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/events/${id}`);
  }

  updateSickness(id: string, payload: Record<string, unknown>): Observable<PayrollEvent> {
    return this.http.patch<PayrollEvent>(`${this.baseUrl}/events/${id}/sickness`, payload);
  }

  createLeave(payload: Record<string, unknown>): Observable<PayrollLeave> {
    return this.http.post<PayrollLeave>(`${this.baseUrl}/leaves`, payload);
  }

  deleteLeave(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/leaves/${id}`);
  }

  createTermination(payload: Record<string, unknown>): Observable<PayrollTermination> {
    return this.http.post<PayrollTermination>(`${this.baseUrl}/terminations`, payload);
  }

  completeTermination(id: string, payload: Record<string, unknown>): Observable<PayrollTermination> {
    return this.http.post<PayrollTermination>(`${this.baseUrl}/terminations/${id}/complete`, payload);
  }

  deleteTermination(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/terminations/${id}`);
  }

  updateContract(id: string, payload: Record<string, unknown>): Observable<PayrollContract> {
    return this.http.patch<PayrollContract>(`${this.baseUrl}/contracts/${id}`, payload);
  }

  deleteContract(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.baseUrl}/contracts/${id}`,
    );
  }

  createErganiDeclaration(
    payload: Record<string, unknown>,
  ): Observable<PayrollErganiDeclaration> {
    return this.http.post<PayrollErganiDeclaration>(
      `${this.baseUrl}/ergani-declarations`,
      payload,
    );
  }

  completeErganiDeclaration(
    id: string,
    payload: Record<string, unknown>,
  ): Observable<PayrollErganiDeclaration> {
    return this.http.post<PayrollErganiDeclaration>(
      `${this.baseUrl}/ergani-declarations/${id}/complete`,
      payload,
    );
  }

  deleteErganiDeclaration(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.baseUrl}/ergani-declarations/${id}`,
    );
  }

  calculate(payload: Record<string, unknown>): Observable<PayrollPeriod> {
    return this.http.post<PayrollPeriod>(`${this.baseUrl}/periods/calculate`, payload);
  }

  approve(periodId: string): Observable<PayrollPeriod> {
    return this.http.post<PayrollPeriod>(`${this.baseUrl}/periods/${periodId}/approve`, {});
  }

  markPaid(periodId: string, paymentDate: string): Observable<PayrollPeriod> {
    return this.http.post<PayrollPeriod>(`${this.baseUrl}/periods/${periodId}/paid`, {
      paymentDate,
    });
  }

  updateComplianceDeadlines(
    periodId: string,
    payload: Record<string, unknown>,
  ): Observable<PayrollPeriod> {
    return this.http.patch<PayrollPeriod>(
      `${this.baseUrl}/periods/${periodId}/compliance-deadlines`,
      payload,
    );
  }

  completeApdSubmission(
    periodId: string,
    payload: Record<string, unknown>,
  ): Observable<PayrollPeriod> {
    return this.http.post<PayrollPeriod>(
      `${this.baseUrl}/periods/${periodId}/apd-submission`,
      payload,
    );
  }

  markContributionsPaid(
    periodId: string,
    payload: Record<string, unknown>,
  ): Observable<PayrollPeriod> {
    return this.http.post<PayrollPeriod>(
      `${this.baseUrl}/periods/${periodId}/contributions-paid`,
      payload,
    );
  }

  completeTekaSubmission(
    periodId: string,
    payload: Record<string, unknown>,
  ): Observable<PayrollPeriod> {
    return this.http.post<PayrollPeriod>(
      `${this.baseUrl}/periods/${periodId}/teka-submission`,
      payload,
    );
  }

  markTekaPaid(
    periodId: string,
    payload: Record<string, unknown>,
  ): Observable<PayrollPeriod> {
    return this.http.post<PayrollPeriod>(
      `${this.baseUrl}/periods/${periodId}/teka-paid`,
      payload,
    );
  }

  completeFmySubmission(
    periodId: string,
    payload: Record<string, unknown>,
  ): Observable<PayrollPeriod> {
    return this.http.post<PayrollPeriod>(
      `${this.baseUrl}/periods/${periodId}/fmy-submission`,
      payload,
    );
  }

  markFmyPaid(
    periodId: string,
    payload: Record<string, unknown>,
  ): Observable<PayrollPeriod> {
    return this.http.post<PayrollPeriod>(
      `${this.baseUrl}/periods/${periodId}/fmy-paid`,
      payload,
    );
  }

  exportApd(periodId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/periods/${periodId}/apd`, {
      responseType: 'blob',
    });
  }

  exportPayslip(periodId: string, entryId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/periods/${periodId}/payslips/${entryId}`, {
      responseType: 'blob',
    });
  }

  exportBankPayments(periodId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/periods/${periodId}/bank-payments`, {
      responseType: 'blob',
    });
  }

  exportWithholdingWorkpaper(periodId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/periods/${periodId}/withholding-workpaper`, {
      responseType: 'blob',
    });
  }
}
