import {
  PayrollErganiDeclarationStatus,
  PayrollErganiDeclarationType,
} from '@prisma/client';

const DAY_MS = 86_400_000;

export function erganiDeclarationDeadline(
  type: PayrollErganiDeclarationType,
  effectiveAt: Date,
): Date {
  if (type === PayrollErganiDeclarationType.INITIAL_WORK_SCHEDULE) {
    return athensEndOfDay(effectiveAt);
  }
  if (type === PayrollErganiDeclarationType.PAY_CHANGE_LEGISLATION) {
    return new Date(effectiveAt.getTime() + 30 * DAY_MS);
  }
  return new Date(effectiveAt);
}

export function erganiDeclarationNeedsAcceptance(
  type: PayrollErganiDeclarationType,
): boolean {
  return (
    type !== PayrollErganiDeclarationType.PAY_CHANGE_LEGISLATION &&
    type !== PayrollErganiDeclarationType.INITIAL_WORK_SCHEDULE
  );
}

export function erganiDeclarationBlocksPayroll(input: {
  type: PayrollErganiDeclarationType;
  status: PayrollErganiDeclarationStatus;
  effectiveAt: Date;
  deadlineAt: Date;
  periodEnd: Date;
  now: Date;
}): boolean {
  if (
    input.status !== PayrollErganiDeclarationStatus.DRAFT ||
    input.effectiveAt.getTime() > input.periodEnd.getTime()
  ) {
    return false;
  }
  return (
    input.type !== PayrollErganiDeclarationType.PAY_CHANGE_LEGISLATION ||
    input.deadlineAt.getTime() < input.now.getTime()
  );
}

export function isErganiSubmissionLate(
  submittedAt: Date,
  deadlineAt: Date,
): boolean {
  return submittedAt.getTime() > deadlineAt.getTime();
}

export function athensEndOfDay(reference: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Athens',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(reference);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  const wallClockUtc = Date.UTC(
    Number(part('year')),
    Number(part('month')) - 1,
    Number(part('day')),
    23,
    59,
    59,
    999,
  );
  const approximate = new Date(wallClockUtc);
  const localParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Athens',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(approximate);
  const localPart = (type: Intl.DateTimeFormatPartTypes) =>
    localParts.find((item) => item.type === type)?.value ?? '';
  const localAsUtc = Date.UTC(
    Number(localPart('year')),
    Number(localPart('month')) - 1,
    Number(localPart('day')),
    Number(localPart('hour')),
    Number(localPart('minute')),
    Number(localPart('second')),
    approximate.getUTCMilliseconds(),
  );
  return new Date(wallClockUtc - (localAsUtc - approximate.getTime()));
}
