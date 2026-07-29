import { BadRequestException } from '@nestjs/common';
import { WithholdingTaxCategory } from '@prisma/client';
import {
  assertPaymentInPeriod,
  calculateWithholdingLine,
  defaultWithholdingRate,
  withholdingDeadline,
} from './withholding-tax-calculator';

describe('withholding tax calculator', () => {
  it.each([
    [WithholdingTaxCategory.BUSINESS_ACTIVITY, '1', 20],
    [WithholdingTaxCategory.DIVIDENDS, '01', 5],
    [WithholdingTaxCategory.INTEREST, '19', 15],
    [WithholdingTaxCategory.ROYALTIES, '32', 20],
  ])('uses the standard production rate for %s / %s', (category, code, expected) => {
    expect(defaultWithholdingRate(category, code)).toBe(expected);
  });

  it('calculates tax and digital transaction fee to exact cents', () => {
    expect(
      calculateWithholdingLine({
        category: WithholdingTaxCategory.DIVIDENDS,
        incomeCode: '01',
        grossAmount: 1234.56,
        digitalFeeRate: 2.4,
      }),
    ).toEqual({
      incomeCode: '01',
      grossAmount: 1234.56,
      deductionsAmount: 0,
      netAmount: 1234.56,
      withholdingRate: 5,
      assessedTaxAmount: 61.73,
      withheldTaxAmount: 61.73,
      digitalFeeRate: 2.4,
      digitalFeeAmount: 29.63,
      digitalFeeOgaAmount: 0,
    });
  });

  it('requires an explicit treaty rate', () => {
    expect(() =>
      calculateWithholdingLine({
        category: WithholdingTaxCategory.ROYALTIES,
        incomeCode: '34',
        grossAmount: 1000,
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects a code from another declaration category', () => {
    expect(() =>
      calculateWithholdingLine({
        category: WithholdingTaxCategory.DIVIDENDS,
        incomeCode: '32',
        grossAmount: 1000,
      }),
    ).toThrow(BadRequestException);
  });

  it('uses the last day of the second following month as deadline', () => {
    const deadline = withholdingDeadline(2026, 1);
    expect(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Athens',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(deadline),
    ).toBe('2026-03-31');
  });

  it('rejects beneficiary payments outside the declaration month', () => {
    expect(() => assertPaymentInPeriod(new Date('2026-02-01T12:00:00+02:00'), 2026, 1)).toThrow(
      BadRequestException,
    );
  });
});
