import { athensEndOfDay } from '../payroll/ergani-declaration';

export interface AnnualTaxAdjustments {
  accountingResult: number;
  nonDeductibleExpenses: number;
  taxExemptIncome: number;
  otherTaxAdditions: number;
  otherTaxDeductions: number;
  priorTaxLosses: number;
}

export interface AnnualTaxInstallmentDraft {
  installmentNumber: number;
  dueDate: Date;
  amount: number;
}

export function calculateTaxableResult(input: AnnualTaxAdjustments): number {
  return roundMoney(
    input.accountingResult +
      input.nonDeductibleExpenses +
      input.otherTaxAdditions -
      input.taxExemptIncome -
      input.otherTaxDeductions -
      input.priorTaxLosses,
  );
}

export function defaultAnnualTaxDeadline(fiscalYear: number): Date {
  // A.1140/2026 extended tax-year 2025 E1 and N returns to 24 July 2026.
  const day = fiscalYear === 2025 ? 24 : 15;
  return athensEndOfDay(new Date(Date.UTC(fiscalYear + 1, 6, day, 12)));
}

export function defaultAnnualTaxInstallments(
  fiscalYear: number,
  totalPayable: number,
  count = 8,
): AnnualTaxInstallmentDraft[] {
  if (!Number.isInteger(count) || count < 1 || count > 24) {
    throw new Error('Installment count must be between 1 and 24.');
  }
  const totalCents = Math.round(totalPayable * 100);
  if (totalCents < 0) {
    throw new Error('Total payable cannot be negative.');
  }
  const baseCents = Math.floor(totalCents / count);
  let allocated = 0;

  return Array.from({ length: count }, (_, index) => {
    const amountCents = index === count - 1 ? totalCents - allocated : baseCents;
    allocated += amountCents;
    const monthEnd = new Date(Date.UTC(fiscalYear + 1, 7 + index, 0, 12));
    return {
      installmentNumber: index + 1,
      dueDate: athensEndOfDay(moveWeekendBackward(monthEnd)),
      amount: amountCents / 100,
    };
  });
}

export function isLate(performedAt: Date, deadlineAt: Date): boolean {
  return performedAt.getTime() > deadlineAt.getTime();
}

function moveWeekendBackward(value: Date): Date {
  const result = new Date(value);
  while (result.getUTCDay() === 0 || result.getUTCDay() === 6) {
    result.setUTCDate(result.getUTCDate() - 1);
  }
  return result;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
