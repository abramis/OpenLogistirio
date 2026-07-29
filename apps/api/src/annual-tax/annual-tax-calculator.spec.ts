import {
  calculateTaxableResult,
  defaultAnnualTaxDeadline,
  defaultAnnualTaxInstallments,
  isLate,
} from './annual-tax-calculator';

describe('annual tax calculations', () => {
  it('calculates the tax result from accounting profit and adjustments', () => {
    expect(
      calculateTaxableResult({
        accountingResult: 40_000,
        nonDeductibleExpenses: 2_500,
        taxExemptIncome: 1_000,
        otherTaxAdditions: 300,
        otherTaxDeductions: 800,
        priorTaxLosses: 4_000,
      }),
    ).toBe(37_000);
  });

  it('keeps a tax loss negative instead of silently flooring it to zero', () => {
    expect(
      calculateTaxableResult({
        accountingResult: -10_000,
        nonDeductibleExpenses: 500,
        taxExemptIncome: 0,
        otherTaxAdditions: 0,
        otherTaxDeductions: 0,
        priorTaxLosses: 0,
      }),
    ).toBe(-9_500);
  });

  it('uses the official 2025 return extension deadline', () => {
    expect(defaultAnnualTaxDeadline(2025)).toEqual(
      new Date('2026-07-24T20:59:59.999Z'),
    );
  });

  it('splits assessed tax exactly and uses working-day month ends', () => {
    const installments = defaultAnnualTaxInstallments(2025, 100, 8);
    expect(installments.map((item) => item.amount)).toEqual([
      12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5,
    ]);
    expect(installments[0].dueDate).toEqual(new Date('2026-07-31T20:59:59.999Z'));
    expect(installments[1].dueDate).toEqual(new Date('2026-08-31T20:59:59.999Z'));
    expect(installments[2].dueDate).toEqual(new Date('2026-09-30T20:59:59.999Z'));
  });

  it('puts rounding remainder on the last installment', () => {
    expect(defaultAnnualTaxInstallments(2025, 100.01, 3).map((item) => item.amount)).toEqual([
      33.33, 33.33, 33.35,
    ]);
  });

  it('marks activity after the stored deadline as late', () => {
    const deadline = new Date('2026-07-24T20:59:59.999Z');
    expect(isLate(deadline, deadline)).toBe(false);
    expect(isLate(new Date('2026-07-24T21:00:00.000Z'), deadline)).toBe(true);
  });
});
