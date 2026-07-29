import { annualLeaveEntitlement } from './payroll.service';

describe('annualLeaveEntitlement', () => {
  it('calculates a proportional first calendar year for a five-day week', () => {
    expect(
      annualLeaveEntitlement({
        employmentStart: new Date('2026-07-01T00:00:00.000Z'),
        fiscalYear: 2026,
        weeklySystem: 'FIVE_DAY',
        recognizedPriorServiceYears: 0,
      }),
    ).toBe(11);
  });

  it('returns the second-year entitlement', () => {
    expect(
      annualLeaveEntitlement({
        employmentStart: new Date('2025-07-01T00:00:00.000Z'),
        fiscalYear: 2026,
        weeklySystem: 'FIVE_DAY',
        recognizedPriorServiceYears: 0,
      }),
    ).toBe(21);
  });

  it('returns the third-year entitlement for five- and six-day weeks', () => {
    const common = {
      employmentStart: new Date('2024-07-01T00:00:00.000Z'),
      fiscalYear: 2026,
      recognizedPriorServiceYears: 0,
    };
    expect(annualLeaveEntitlement({ ...common, weeklySystem: 'FIVE_DAY' })).toBe(22);
    expect(annualLeaveEntitlement({ ...common, weeklySystem: 'SIX_DAY' })).toBe(26);
  });

  it('applies the 12 total recognized years threshold', () => {
    expect(
      annualLeaveEntitlement({
        employmentStart: new Date('2026-01-01T00:00:00.000Z'),
        fiscalYear: 2026,
        weeklySystem: 'FIVE_DAY',
        recognizedPriorServiceYears: 12,
      }),
    ).toBe(25);
  });

  it('applies the 25 total recognized years threshold', () => {
    expect(
      annualLeaveEntitlement({
        employmentStart: new Date('2026-01-01T00:00:00.000Z'),
        fiscalYear: 2026,
        weeklySystem: 'SIX_DAY',
        recognizedPriorServiceYears: 25,
      }),
    ).toBe(31);
  });
});
