import {
  PayrollErganiDeclarationStatus,
  PayrollErganiDeclarationType,
} from '@prisma/client';
import {
  erganiDeclarationBlocksPayroll,
  erganiDeclarationDeadline,
  erganiDeclarationNeedsAcceptance,
  isErganiSubmissionLate,
} from './ergani-declaration';

describe('ΕΡΓΑΝΗ ΙΙ declarations', () => {
  const effectiveAt = new Date('2026-07-29T06:00:00.000Z');

  it('requires prior submission for a hiring declaration', () => {
    expect(
      erganiDeclarationDeadline(
        PayrollErganiDeclarationType.HIRING,
        effectiveAt,
      ),
    ).toEqual(effectiveAt);
    expect(
      erganiDeclarationNeedsAcceptance(
        PayrollErganiDeclarationType.HIRING,
      ),
    ).toBe(true);
  });

  it('allows 30 days and no employee acceptance for statutory pay changes', () => {
    expect(
      erganiDeclarationDeadline(
        PayrollErganiDeclarationType.PAY_CHANGE_LEGISLATION,
        effectiveAt,
      ),
    ).toEqual(new Date('2026-08-28T06:00:00.000Z'));
    expect(
      erganiDeclarationNeedsAcceptance(
        PayrollErganiDeclarationType.PAY_CHANGE_LEGISLATION,
      ),
    ).toBe(false);
  });

  it('sets the initial work-schedule deadline to the end of the Athens calendar day', () => {
    expect(
      erganiDeclarationDeadline(
        PayrollErganiDeclarationType.INITIAL_WORK_SCHEDULE,
        effectiveAt,
      ),
    ).toEqual(new Date('2026-07-29T20:59:59.999Z'));
    expect(
      erganiDeclarationNeedsAcceptance(
        PayrollErganiDeclarationType.INITIAL_WORK_SCHEDULE,
      ),
    ).toBe(false);
  });

  it('blocks payroll only while an effective declaration remains draft', () => {
    const periodEnd = new Date('2026-07-31T00:00:00.000Z');
    expect(
      erganiDeclarationBlocksPayroll({
        type: PayrollErganiDeclarationType.HIRING,
        status: PayrollErganiDeclarationStatus.DRAFT,
        effectiveAt,
        deadlineAt: effectiveAt,
        periodEnd,
        now: new Date('2026-07-31T00:00:00.000Z'),
      }),
    ).toBe(true);
    expect(
      erganiDeclarationBlocksPayroll({
        type: PayrollErganiDeclarationType.HIRING,
        status: PayrollErganiDeclarationStatus.COMPLETED,
        effectiveAt,
        deadlineAt: effectiveAt,
        periodEnd,
        now: new Date('2026-07-31T00:00:00.000Z'),
      }),
    ).toBe(false);
  });

  it('does not block a statutory pay change before its 30-day deadline', () => {
    expect(
      erganiDeclarationBlocksPayroll({
        type: PayrollErganiDeclarationType.PAY_CHANGE_LEGISLATION,
        status: PayrollErganiDeclarationStatus.DRAFT,
        effectiveAt,
        deadlineAt: new Date('2026-08-28T06:00:00.000Z'),
        periodEnd: new Date('2026-07-31T00:00:00.000Z'),
        now: new Date('2026-08-10T00:00:00.000Z'),
      }),
    ).toBe(false);
  });

  it('marks submissions after the legal deadline as late', () => {
    expect(
      isErganiSubmissionLate(
        new Date('2026-07-29T06:01:00.000Z'),
        effectiveAt,
      ),
    ).toBe(true);
  });
});
