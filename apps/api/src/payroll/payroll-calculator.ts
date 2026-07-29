export interface WithholdingTax2026Input {
  monthlyTaxableEarnings: number;
  age: number;
  dependentChildren: number;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface WorkPremiumInput {
  compensationType: 'MONTHLY' | 'DAILY';
  contractualMonthlySalary?: number;
  contractualDailyWage?: number;
  statutoryMonthlySalary?: number;
  statutoryDailyWage?: number;
  fullTime: boolean;
  nightHours?: number;
  sundayHolidayHours?: number;
  extraWorkHours?: number;
  legalOvertimeHours?: number;
  approvedOvertimeHours?: number;
  illegalOvertimeHours?: number;
  partTimeAdditionalHours?: number;
}

export interface WorkPremiumResult {
  contractualHourlyRate: number;
  statutoryHourlyRate: number;
  nightPremiumGross: number;
  sundayHolidayGross: number;
  extraWorkGross: number;
  legalOvertimeGross: number;
  approvedOvertimeGross: number;
  illegalOvertimeGross: number;
  partTimeExtraGross: number;
  totalGross: number;
  contributionExempt: number;
}

export function calculateWorkPremiums(input: WorkPremiumInput): WorkPremiumResult {
  const contractualHourlyRate =
    input.compensationType === 'MONTHLY'
      ? Number(input.contractualMonthlySalary ?? 0) * 0.006
      : Number(input.contractualDailyWage ?? 0) * 0.15;
  const statutoryHourlyRate =
    input.compensationType === 'MONTHLY'
      ? Number(input.statutoryMonthlySalary ?? input.contractualMonthlySalary ?? 0) * 0.006
      : Number(input.statutoryDailyWage ?? input.contractualDailyWage ?? 0) * 0.15;

  const nightPremiumGross = roundMoney(statutoryHourlyRate * 0.25 * (input.nightHours ?? 0));
  const sundayHolidayGross = roundMoney(
    statutoryHourlyRate * 0.75 * (input.sundayHolidayHours ?? 0),
  );
  const extraWorkGross = roundMoney(
    contractualHourlyRate * 1.2 * (input.extraWorkHours ?? 0),
  );
  const legalOvertimeGross = roundMoney(
    contractualHourlyRate * 1.4 * (input.legalOvertimeHours ?? 0),
  );
  const approvedOvertimeGross = roundMoney(
    contractualHourlyRate * 1.6 * (input.approvedOvertimeHours ?? 0),
  );
  const illegalOvertimeGross = roundMoney(
    contractualHourlyRate * 2.2 * (input.illegalOvertimeHours ?? 0),
  );
  const partTimeExtraGross = roundMoney(
    contractualHourlyRate * 1.12 * (input.partTimeAdditionalHours ?? 0),
  );
  const totalGross = roundMoney(
    nightPremiumGross +
      sundayHolidayGross +
      extraWorkGross +
      legalOvertimeGross +
      approvedOvertimeGross +
      illegalOvertimeGross +
      partTimeExtraGross,
  );
  const contributionExempt = input.fullTime
    ? roundMoney(
        nightPremiumGross +
          sundayHolidayGross +
          contractualHourlyRate * 0.2 * (input.extraWorkHours ?? 0) +
          contractualHourlyRate * 0.4 * (input.legalOvertimeHours ?? 0) +
          contractualHourlyRate * 0.6 * (input.approvedOvertimeHours ?? 0) +
          contractualHourlyRate * 1.2 * (input.illegalOvertimeHours ?? 0),
      )
    : 0;

  return {
    contractualHourlyRate: roundMoney(contractualHourlyRate),
    statutoryHourlyRate: roundMoney(statutoryHourlyRate),
    nightPremiumGross,
    sundayHolidayGross,
    extraWorkGross,
    legalOvertimeGross,
    approvedOvertimeGross,
    illegalOvertimeGross,
    partTimeExtraGross,
    totalGross,
    contributionExempt,
  };
}

export function calculateMonthlyWithholdingTax2026(input: WithholdingTax2026Input): number {
  const annualIncome = Math.max(0, input.monthlyTaxableEarnings) * 14;
  let tax = progressiveTax2026(annualIncome, input.age, input.dependentChildren);
  const reduction = taxReduction2026(annualIncome, input.dependentChildren);
  tax = Math.max(0, tax - Math.min(tax, reduction));
  return roundMoney(tax / 14);
}

function progressiveTax2026(income: number, age: number, children: number): number {
  const rates = rates2026(age, children);
  const bands = [10_000, 10_000, 10_000, 10_000, 20_000, Number.POSITIVE_INFINITY];
  let remaining = income;
  let tax = 0;

  for (let i = 0; i < bands.length && remaining > 0; i += 1) {
    const taxable = Math.min(remaining, bands[i]);
    tax += taxable * rates[i];
    remaining -= taxable;
  }
  return tax;
}

function rates2026(age: number, children: number): number[] {
  let first = children >= 4 ? 0 : 0.09;
  let second =
    children >= 4 ? 0 : children === 3 ? 0.09 : children === 2 ? 0.16 : children === 1 ? 0.18 : 0.2;
  const third =
    children > 4
      ? Math.max(0, 0.18 - (children - 4) * 0.02)
      : children === 4
        ? 0.18
        : children === 3
          ? 0.2
          : children === 2
            ? 0.22
            : children === 1
              ? 0.24
              : 0.26;

  if (age <= 25) {
    first = 0;
    second = 0;
  } else if (age <= 30) {
    second = children >= 4 ? 0 : 0.09;
  }

  return [first, second, third, 0.34, 0.39, 0.44];
}

function taxReduction2026(annualIncome: number, children: number): number {
  const base =
    children === 0
      ? 777
      : children === 1
        ? 900
        : children === 2
          ? 1120
          : children === 3
            ? 1340
            : children === 4
              ? 1580
              : 1780 + Math.max(0, children - 5) * 220;
  const reductionAboveTwelve = Math.max(0, annualIncome - 12_000) * 0.02;
  return Math.max(0, base - reductionAboveTwelve);
}

export function ageAt(dateOfBirth: Date, at: Date): number {
  let age = at.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthday =
    at.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (at.getUTCMonth() === dateOfBirth.getUTCMonth() &&
      at.getUTCDate() < dateOfBirth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}
