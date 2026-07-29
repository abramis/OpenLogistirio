import { athensEndOfDay } from './ergani-declaration';

export interface PayrollComplianceDeadlines {
  apdSubmissionDeadline: Date;
  contributionsPaymentDeadline: Date;
  fmySubmissionDeadline: Date;
}

export function payrollComplianceDeadlines(
  periodYear: number,
  periodMonth: number,
): PayrollComplianceDeadlines {
  const nextMonthEnd = monthEndCalendarDate(periodYear, periodMonth + 1);
  const secondMonthEnd = monthEndCalendarDate(periodYear, periodMonth + 2);

  return {
    // APD submission calendars move a weekend month-end to the next weekday.
    apdSubmissionDeadline: athensEndOfDay(moveWeekend(nextMonthEnd, 1)),
    // Current employer contributions are due on the last working day.
    contributionsPaymentDeadline: athensEndOfDay(moveWeekend(nextMonthEnd, -1)),
    // FMY is submitted and paid by the end of the second following month.
    fmySubmissionDeadline: athensEndOfDay(moveWeekend(secondMonthEnd, 1)),
  };
}

export function fmyDeadlineForPaymentDate(paymentDate: Date): Date {
  return payrollComplianceDeadlines(
    paymentDate.getUTCFullYear(),
    paymentDate.getUTCMonth() + 1,
  ).fmySubmissionDeadline;
}

export function isComplianceLate(performedAt: Date, deadlineAt: Date): boolean {
  return performedAt.getTime() > deadlineAt.getTime();
}

function monthEndCalendarDate(year: number, oneBasedMonth: number): Date {
  return new Date(Date.UTC(year, oneBasedMonth, 0, 12));
}

function moveWeekend(value: Date, direction: 1 | -1): Date {
  const result = new Date(value);
  while (result.getUTCDay() === 0 || result.getUTCDay() === 6) {
    result.setUTCDate(result.getUTCDate() + direction);
  }
  return result;
}
