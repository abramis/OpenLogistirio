import {
  defaultVatPayments,
  defaultVatSubmissionDeadline,
  isVatActionLate,
} from './vat-compliance';

describe('VAT declaration compliance', () => {
  it('uses the last working day of the month after the tax period', () => {
    expect(defaultVatSubmissionDeadline(2026, 1)).toEqual(
      new Date('2026-02-27T21:59:59.999Z'),
    );
    expect(defaultVatSubmissionDeadline(2026, 12)).toEqual(
      new Date('2027-01-29T21:59:59.999Z'),
    );
  });

  it('creates one payment for amounts up to 100 euros', () => {
    const deadline = new Date('2026-08-31T20:59:59.999Z');
    expect(defaultVatPayments(100, deadline, 1)).toEqual([
      { installmentNumber: 1, dueDate: deadline, amount: 100 },
    ]);
    expect(() => defaultVatPayments(100, deadline, 2)).toThrow();
  });

  it('creates two exact installments for an eligible timely declaration', () => {
    const deadline = new Date('2026-08-31T20:59:59.999Z');
    expect(defaultVatPayments(201.01, deadline, 2)).toEqual([
      { installmentNumber: 1, dueDate: deadline, amount: 100.5 },
      {
        installmentNumber: 2,
        dueDate: new Date('2026-09-30T20:59:59.999Z'),
        amount: 100.51,
      },
    ]);
  });

  it('marks only actions after the stored deadline as late', () => {
    const deadline = new Date('2026-08-31T20:59:59.999Z');
    expect(isVatActionLate(deadline, deadline)).toBe(false);
    expect(isVatActionLate(new Date('2026-08-31T21:00:00.000Z'), deadline)).toBe(true);
  });
});
