import { PayrollTerminationType } from '@prisma/client';
import { calculateTerminationSeverance } from './payroll.service';

describe('calculateTerminationSeverance', () => {
  it('uses six monthly salaries after ten completed years', () => {
    const result = calculateTerminationSeverance({
      employmentStart: new Date('2016-06-30T00:00:00.000Z'),
      terminationDate: new Date('2026-07-01T00:00:00.000Z'),
      type: PayrollTerminationType.EMPLOYER_DISMISSAL,
      withNotice: false,
      regularMonthlyEarnings: 1200,
    });
    expect(result.completedServiceYears).toBe(10);
    expect(result.severanceMonths).toBe(6);
    expect(result.statutorySeverance).toBe(8400);
  });

  it('halves severance and returns the statutory notice period', () => {
    const result = calculateTerminationSeverance({
      employmentStart: new Date('2016-06-30T00:00:00.000Z'),
      terminationDate: new Date('2026-07-01T00:00:00.000Z'),
      type: PayrollTerminationType.EMPLOYER_DISMISSAL,
      withNotice: true,
      regularMonthlyEarnings: 1200,
    });
    expect(result.noticeMonths).toBe(4);
    expect(result.severanceMonths).toBe(3);
    expect(result.statutorySeverance).toBe(4200);
  });

  it('does not invent severance for a voluntary resignation', () => {
    const result = calculateTerminationSeverance({
      employmentStart: new Date('2010-01-01T00:00:00.000Z'),
      terminationDate: new Date('2026-07-01T00:00:00.000Z'),
      type: PayrollTerminationType.VOLUNTARY_RESIGNATION,
      withNotice: false,
      regularMonthlyEarnings: 1200,
    });
    expect(result.statutorySeverance).toBe(0);
  });

  it('preserves the capped legacy entitlement frozen on 12 November 2012', () => {
    const result = calculateTerminationSeverance({
      employmentStart: new Date('1990-01-01T00:00:00.000Z'),
      terminationDate: new Date('2026-07-01T00:00:00.000Z'),
      type: PayrollTerminationType.EMPLOYER_DISMISSAL,
      withNotice: false,
      regularMonthlyEarnings: 3000,
    });
    expect(result.details.serviceYearsAt2012Reform).toBe(22);
    expect(result.details.legacyAdditionalMonths).toBe(6);
    expect(result.statutorySeverance).toBe(54000);
  });
});
