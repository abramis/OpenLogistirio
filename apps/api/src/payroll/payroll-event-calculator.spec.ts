import {
  PayrollCompensationType,
  PayrollContract,
  PayrollEventType,
  PayrollSicknessBenefitStatus,
  PayrollWeeklySystem,
} from '@prisma/client';
import { calculateEventGross } from './payroll.service';

describe('statutory Greek payroll events 2026', () => {
  const contract = {
    startDate: new Date('2025-01-01T00:00:00.000Z'),
    endDate: null,
    compensationType: PayrollCompensationType.MONTHLY,
    monthlySalary: 1000,
    dailyWage: null,
    weeklySystem: PayrollWeeklySystem.FIVE_DAY,
  } as unknown as PayrollContract;

  it('calculates full Christmas bonus plus leave allowance ratio', () => {
    const result = calculateEventGross(
      {
        employeeId: 'employee',
        periodYear: 2026,
        periodMonth: 12,
        type: PayrollEventType.CHRISTMAS_BONUS,
      },
      contract,
    );
    expect(result.grossAmount).toBe(1041.67);
    expect(result.autoCalculated).toBe(true);
  });

  it('calculates full Easter bonus plus leave allowance ratio', () => {
    const result = calculateEventGross(
      {
        employeeId: 'employee',
        periodYear: 2026,
        periodMonth: 4,
        type: PayrollEventType.EASTER_BONUS,
      },
      contract,
    );
    expect(result.grossAmount).toBe(520.83);
  });

  it('caps monthly leave allowance at half salary', () => {
    const result = calculateEventGross(
      {
        employeeId: 'employee',
        periodYear: 2026,
        periodMonth: 7,
        type: PayrollEventType.LEAVE_ALLOWANCE,
        leaveDays: 20,
      },
      contract,
    );
    expect(result.grossAmount).toBe(500);
  });

  it('calculates the first long sickness spell and subtracts the approved e-EFKA benefit', () => {
    const result = calculateEventGross(
      {
        employeeId: 'employee',
        periodYear: 2026,
        periodMonth: 7,
        type: PayrollEventType.SICKNESS,
        dateFrom: '2026-07-01',
        dateTo: '2026-07-05',
        leaveDays: 5,
        insuranceDays: 5,
        sicknessBenefitStatus: PayrollSicknessBenefitStatus.APPROVED,
        medicalCertificateReference: 'CERT-1',
        efkaBenefit: 20,
      },
      contract,
      {
        priorEmployerLiabilityDays: 0,
        priorEpisodeDays: 0,
        employerLiabilityLimitDays: 25,
        hasPriorLongSicknessInCalendarYear: false,
      },
    );
    expect(result.grossAmount).toBe(120);
    expect(result.details['halfPayDays']).toBe(3);
    expect(result.details['fullPayDays']).toBe(2);
  });

  it('pays every day normally in a later long sickness spell of the calendar year', () => {
    const result = calculateEventGross(
      {
        employeeId: 'employee',
        periodYear: 2026,
        periodMonth: 8,
        type: PayrollEventType.SICKNESS,
        dateFrom: '2026-08-01',
        dateTo: '2026-08-05',
        leaveDays: 5,
        insuranceDays: 5,
        sicknessBenefitStatus: PayrollSicknessBenefitStatus.APPROVED,
        medicalCertificateReference: 'CERT-2',
        efkaBenefit: 20,
      },
      contract,
      {
        priorEmployerLiabilityDays: 5,
        priorEpisodeDays: 0,
        employerLiabilityLimitDays: 25,
        hasPriorLongSicknessInCalendarYear: true,
      },
    );
    expect(result.grossAmount).toBe(180);
    expect(result.details['halfPayDays']).toBe(0);
  });

  it('applies the remaining work-year employer-liability cap', () => {
    const result = calculateEventGross(
      {
        employeeId: 'employee',
        periodYear: 2026,
        periodMonth: 9,
        type: PayrollEventType.SICKNESS,
        dateFrom: '2026-09-01',
        dateTo: '2026-09-03',
        leaveDays: 3,
        insuranceDays: 3,
        sicknessBenefitStatus: PayrollSicknessBenefitStatus.NOT_ELIGIBLE,
        medicalCertificateReference: 'CERT-3',
        efkaBenefit: 0,
      },
      contract,
      {
        priorEmployerLiabilityDays: 24,
        priorEpisodeDays: 0,
        employerLiabilityLimitDays: 25,
        hasPriorLongSicknessInCalendarYear: true,
      },
    );
    expect(result.grossAmount).toBe(20);
    expect(result.details['employerLiabilityDays']).toBe(1);
  });

  it('continues the same medical episode across payroll months without restarting the first three days', () => {
    const result = calculateEventGross(
      {
        employeeId: 'employee',
        periodYear: 2026,
        periodMonth: 8,
        type: PayrollEventType.SICKNESS,
        dateFrom: '2026-08-01',
        dateTo: '2026-08-02',
        leaveDays: 2,
        insuranceDays: 2,
        sicknessBenefitStatus: PayrollSicknessBenefitStatus.NOT_ELIGIBLE,
        medicalCertificateReference: 'CERT-CROSS-MONTH',
        efkaBenefit: 0,
      },
      contract,
      {
        priorEmployerLiabilityDays: 2,
        priorEpisodeDays: 2,
        employerLiabilityLimitDays: 25,
        hasPriorLongSicknessInCalendarYear: false,
      },
    );
    expect(result.grossAmount).toBe(60);
    expect(result.details['halfPayDays']).toBe(1);
    expect(result.details['fullPayDays']).toBe(1);
  });

  it('caps a monthly-paid employee in the first employment year at half a monthly salary', () => {
    const firstYearContract = {
      ...contract,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
    } as PayrollContract;
    const result = calculateEventGross(
      {
        employeeId: 'employee',
        periodYear: 2026,
        periodMonth: 7,
        type: PayrollEventType.SICKNESS,
        dateFrom: '2026-07-01',
        dateTo: '2026-07-03',
        leaveDays: 3,
        insuranceDays: 3,
        sicknessBenefitStatus: PayrollSicknessBenefitStatus.NOT_ELIGIBLE,
        medicalCertificateReference: 'CERT-FIRST-YEAR',
        efkaBenefit: 0,
      },
      firstYearContract,
      {
        priorEmployerLiabilityDays: 12,
        priorEpisodeDays: 0,
        employerLiabilityLimitDays: 12.5,
        hasPriorLongSicknessInCalendarYear: false,
      },
    );
    expect(result.grossAmount).toBe(10);
    expect(result.details['employerLiabilityDays']).toBe(0.5);
  });
});
