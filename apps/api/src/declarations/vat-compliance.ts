import { athensEndOfDay } from '../payroll/ergani-declaration';

export interface VatPaymentDraft {
  installmentNumber: number;
  dueDate: Date;
  amount: number;
}

export function defaultVatSubmissionDeadline(year: number, periodEndMonth: number): Date {
  const followingMonthEnd = new Date(Date.UTC(year, periodEndMonth + 1, 0, 12));
  return athensEndOfDay(moveWeekendBackward(followingMonthEnd));
}

export function defaultVatPayments(
  payableAmount: number,
  submissionDeadline: Date,
  installments: 1 | 2,
): VatPaymentDraft[] {
  const totalCents = Math.round(payableAmount * 100);
  if (totalCents <= 0) {
    return [];
  }
  if (installments === 2 && payableAmount <= 100) {
    throw new Error('Two VAT installments require a payable amount above 100 euros.');
  }
  if (installments === 1) {
    return [{ installmentNumber: 1, dueDate: submissionDeadline, amount: totalCents / 100 }];
  }
  const firstCents = Math.floor(totalCents / 2);
  const secondMonthEnd = new Date(
    Date.UTC(
      submissionDeadline.getUTCFullYear(),
      submissionDeadline.getUTCMonth() + 2,
      0,
      12,
    ),
  );
  return [
    { installmentNumber: 1, dueDate: submissionDeadline, amount: firstCents / 100 },
    {
      installmentNumber: 2,
      dueDate: athensEndOfDay(moveWeekendBackward(secondMonthEnd)),
      amount: (totalCents - firstCents) / 100,
    },
  ];
}

export function isVatActionLate(performedAt: Date, deadlineAt: Date): boolean {
  return performedAt.getTime() > deadlineAt.getTime();
}

function moveWeekendBackward(value: Date): Date {
  const result = new Date(value);
  while (result.getUTCDay() === 0 || result.getUTCDay() === 6) {
    result.setUTCDate(result.getUTCDate() - 1);
  }
  return result;
}
