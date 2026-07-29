import { BadRequestException } from '@nestjs/common';
import { WithholdingTaxCategory } from '@prisma/client';
import { athensEndOfDay } from '../payroll/ergani-declaration';

const CATEGORY_CODES: Record<WithholdingTaxCategory, Set<string>> = {
  BUSINESS_ACTIVITY: new Set(['01', '06', '07', '08', '09', '10', '11', '12', '13', '94', '97']),
  DIVIDENDS: new Set([
    '01',
    '02',
    '03',
    '04',
    '05',
    '06',
    '07',
    '08',
    '09',
    '10',
    '11',
    '12',
    '16',
    '26',
    '98',
  ]),
  INTEREST: new Set(['19', '20', '21', '22', '23', '24', '25', '27', '28', '29', '99']),
  ROYALTIES: new Set(['32', '33', '34']),
};

const MANUAL_RATE_CODES = new Set(['16', '29', '34', '94', '97', '98', '99']);

export interface WithholdingLineAmounts {
  incomeCode: string;
  grossAmount: number;
  deductionsAmount: number;
  netAmount: number;
  withholdingRate: number;
  assessedTaxAmount: number;
  withheldTaxAmount: number;
  digitalFeeRate: number;
  digitalFeeAmount: number;
  digitalFeeOgaAmount: number;
}

export function normalizeIncomeCode(value: string): string {
  return value.trim().padStart(2, '0');
}

export function defaultWithholdingRate(
  category: WithholdingTaxCategory,
  incomeCode: string,
): number | undefined {
  const code = normalizeIncomeCode(incomeCode);
  if (MANUAL_RATE_CODES.has(code)) {
    return undefined;
  }
  if (category === WithholdingTaxCategory.BUSINESS_ACTIVITY) {
    return code === '01' ? 20 : undefined;
  }
  if (category === WithholdingTaxCategory.DIVIDENDS) {
    return 5;
  }
  if (category === WithholdingTaxCategory.INTEREST) {
    return 15;
  }
  return 20;
}

export function calculateWithholdingLine(input: {
  category: WithholdingTaxCategory;
  incomeCode: string;
  grossAmount: number;
  deductionsAmount?: number;
  withholdingRate?: number;
  withheldTaxAmount?: number;
  digitalFeeRate?: number;
  digitalFeeOgaAmount?: number;
}): WithholdingLineAmounts {
  const incomeCode = normalizeIncomeCode(input.incomeCode);
  if (!CATEGORY_CODES[input.category].has(incomeCode)) {
    throw new BadRequestException(
      `Ο κωδικός αμοιβής ${incomeCode} δεν ανήκει στην επιλεγμένη κατηγορία δήλωσης.`,
    );
  }

  const grossAmount = money(input.grossAmount);
  const deductionsAmount = money(input.deductionsAmount ?? 0);
  if (deductionsAmount > grossAmount) {
    throw new BadRequestException('Οι κρατήσεις εκτός φόρου δεν μπορούν να υπερβαίνουν το μικτό ποσό.');
  }
  const netAmount = money(grossAmount - deductionsAmount);
  const standardRate = defaultWithholdingRate(input.category, incomeCode);
  const withholdingRate = input.withholdingRate ?? standardRate;
  if (withholdingRate === undefined) {
    throw new BadRequestException(
      'Ο συγκεκριμένος κωδικός απαιτεί ρητό συντελεστή από τη σύμβαση/απαλλαγή.',
    );
  }
  if (withholdingRate < 0 || withholdingRate > 100) {
    throw new BadRequestException('Ο συντελεστής παρακράτησης πρέπει να είναι από 0 έως 100.');
  }
  const assessedTaxAmount = money((grossAmount * withholdingRate) / 100);
  const withheldTaxAmount = money(input.withheldTaxAmount ?? assessedTaxAmount);
  if (withheldTaxAmount > grossAmount) {
    throw new BadRequestException('Ο παρακρατηθείς φόρος δεν μπορεί να υπερβαίνει το μικτό ποσό.');
  }
  const digitalFeeRate = input.digitalFeeRate ?? 0;
  if (![0, 1.2, 2.4, 3.6].includes(digitalFeeRate)) {
    throw new BadRequestException('Το Ψηφιακό Τέλος Συναλλαγής πρέπει να είναι 0%, 1,2%, 2,4% ή 3,6%.');
  }
  const digitalFeeAmount = money((grossAmount * digitalFeeRate) / 100);
  const digitalFeeOgaAmount = money(input.digitalFeeOgaAmount ?? 0);

  return {
    incomeCode,
    grossAmount,
    deductionsAmount,
    netAmount,
    withholdingRate,
    assessedTaxAmount,
    withheldTaxAmount,
    digitalFeeRate,
    digitalFeeAmount,
    digitalFeeOgaAmount,
  };
}

export function withholdingDeadline(year: number, month: number): Date {
  return athensEndOfDay(new Date(Date.UTC(year, month + 2, 0, 12)));
}

export function assertPaymentInPeriod(paymentDate: Date, year: number, month: number): void {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Athens',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(paymentDate);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);
  if (value('year') !== year || value('month') !== month) {
    throw new BadRequestException(
      'Η ημερομηνία πληρωμής του δικαιούχου πρέπει να ανήκει στον μήνα της δήλωσης.',
    );
  }
}

export function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export const withholdingCategoryCodes = CATEGORY_CODES;
