import {
  ageAt,
  calculateMonthlyWithholdingTax2026,
  calculateWorkPremiums,
} from './payroll-calculator';

describe('Greek payroll 2026 calculator', () => {
  it('applies the 2026 tax scale and tax reduction for an employee without children', () => {
    expect(
      calculateMonthlyWithholdingTax2026({
        monthlyTaxableEarnings: 800,
        age: 40,
        dependentChildren: 0,
      }),
    ).toBe(25.93);
  });

  it('applies the zero first two brackets for employees up to 25 years old', () => {
    expect(
      calculateMonthlyWithholdingTax2026({
        monthlyTaxableEarnings: 1200,
        age: 24,
        dependentChildren: 0,
      }),
    ).toBe(0);
  });

  it('applies child-adjusted brackets', () => {
    const noChildren = calculateMonthlyWithholdingTax2026({
      monthlyTaxableEarnings: 1800,
      age: 40,
      dependentChildren: 0,
    });
    const threeChildren = calculateMonthlyWithholdingTax2026({
      monthlyTaxableEarnings: 1800,
      age: 40,
      dependentChildren: 3,
    });
    expect(threeChildren).toBeLessThan(noChildren);
  });

  it('calculates age at the period end', () => {
    expect(ageAt(new Date('2000-08-10T00:00:00.000Z'), new Date('2026-07-31T00:00:00.000Z'))).toBe(
      25,
    );
  });

  it('adds overlapping night and Sunday premiums on the statutory hourly rate', () => {
    const result = calculateWorkPremiums({
      compensationType: 'MONTHLY',
      contractualMonthlySalary: 1200,
      statutoryMonthlySalary: 920,
      fullTime: true,
      nightHours: 8,
      sundayHolidayHours: 8,
    });

    expect(result.contractualHourlyRate).toBe(7.2);
    expect(result.statutoryHourlyRate).toBe(5.52);
    expect(result.nightPremiumGross).toBe(11.04);
    expect(result.sundayHolidayGross).toBe(33.12);
    expect(result.totalGross).toBe(44.16);
    expect(result.contributionExempt).toBe(44.16);
  });

  it('pays the base hour plus 20/40/60/120 percent and exempts only premiums', () => {
    const result = calculateWorkPremiums({
      compensationType: 'MONTHLY',
      contractualMonthlySalary: 1000,
      statutoryMonthlySalary: 920,
      fullTime: true,
      extraWorkHours: 1,
      legalOvertimeHours: 1,
      approvedOvertimeHours: 1,
      illegalOvertimeHours: 1,
    });

    expect(result.extraWorkGross).toBe(7.2);
    expect(result.legalOvertimeGross).toBe(8.4);
    expect(result.approvedOvertimeGross).toBe(9.6);
    expect(result.illegalOvertimeGross).toBe(13.2);
    expect(result.totalGross).toBe(38.4);
    expect(result.contributionExempt).toBe(14.4);
  });

  it('keeps the 12 percent part-time additional-work premium contributable', () => {
    const result = calculateWorkPremiums({
      compensationType: 'MONTHLY',
      contractualMonthlySalary: 600,
      statutoryMonthlySalary: 460,
      fullTime: false,
      partTimeAdditionalHours: 2,
    });

    expect(result.partTimeExtraGross).toBe(8.06);
    expect(result.contributionExempt).toBe(0);
  });
});
