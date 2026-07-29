import {
  fmyDeadlineForPaymentDate,
  isComplianceLate,
  payrollComplianceDeadlines,
} from './payroll-compliance';

describe('payroll compliance deadlines', () => {
  it('sets APD, contribution and FMY deadlines for an ordinary month-end', () => {
    expect(payrollComplianceDeadlines(2026, 1)).toEqual({
      apdSubmissionDeadline: new Date('2026-03-02T21:59:59.999Z'),
      contributionsPaymentDeadline: new Date('2026-02-27T21:59:59.999Z'),
      fmySubmissionDeadline: new Date('2026-03-31T20:59:59.999Z'),
    });
  });

  it('handles a year boundary', () => {
    expect(payrollComplianceDeadlines(2026, 12)).toEqual({
      apdSubmissionDeadline: new Date('2027-02-01T21:59:59.999Z'),
      contributionsPaymentDeadline: new Date('2027-01-29T21:59:59.999Z'),
      fmySubmissionDeadline: new Date('2027-03-01T21:59:59.999Z'),
    });
  });

  it('marks only activity after the stored deadline as late', () => {
    const deadline = new Date('2026-03-31T20:59:59.999Z');
    expect(isComplianceLate(deadline, deadline)).toBe(false);
    expect(
      isComplianceLate(new Date('2026-03-31T21:00:00.000Z'), deadline),
    ).toBe(true);
  });

  it('derives the FMY deadline from the actual salary payment month', () => {
    expect(fmyDeadlineForPaymentDate(new Date('2026-02-02T00:00:00.000Z'))).toEqual(
      new Date('2026-04-30T20:59:59.999Z'),
    );
  });
});
