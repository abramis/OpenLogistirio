import { BadRequestException, Injectable } from '@nestjs/common';
import iconv from 'iconv-lite';

export interface ApdExportInput {
  declarationType: 'NORMAL' | 'SUPPLEMENTARY';
  periodYear: number;
  periodMonth: number;
  submittedAt: Date;
  employer: {
    registryNumber: string;
    submissionOfficeCode: string;
    submissionOfficeName: string;
    legalName: string;
    vatNumber: string;
    street: string;
    streetNumber: string;
    postalCode: string;
    city: string;
  };
  entries: Array<{
    employee: {
      insuranceRegistryNumber: string;
      amka: string;
      lastName: string;
      firstName: string;
      fatherName: string;
      motherName: string;
      birthDate: Date;
      afm: string;
    };
    contract: {
      branchNumber: number;
      kad: string;
      fullTime: boolean;
      weeklySystem: 'FIVE_DAY' | 'SIX_DAY';
      specialtyCode: string;
      specialInsuranceCase: string;
      coveragePackageCode: string;
      externalSupplementaryFund: string;
      externalHealthFund: string;
      compensationType: 'MONTHLY' | 'DAILY';
    };
    employmentFrom: Date;
    employmentTo: Date;
    earningsType: string;
    insuranceDays: number;
    dailyWage: number;
    grossEarnings: number;
    employeeContributions: number;
    employerContributions: number;
  }>;
}

@Injectable()
export class ApdExportService {
  build(input: ApdExportInput): Buffer {
    if (input.entries.length === 0) {
      throw new BadRequestException('Η ΑΠΔ δεν έχει εγγραφές εργαζομένων.');
    }

    const totalDays = input.entries.reduce((sum, entry) => sum + entry.insuranceDays, 0);
    const totalGross = money(input.entries.reduce((sum, entry) => sum + entry.grossEarnings, 0));
    const totalPayable = money(
      input.entries.reduce(
        (sum, entry) => sum + entry.employeeContributions + entry.employerContributions,
        0,
      ),
    );

    const grouped = new Map<string, typeof input.entries>();
    input.entries.forEach((entry) => {
      const key = `${entry.employee.amka}:${entry.employee.afm}`;
      const values = grouped.get(key) ?? [];
      values.push(entry);
      grouped.set(key, values);
    });
    const detailLines = [...grouped.values()].flatMap((entries) => [
      this.employee(entries[0]),
      ...entries.map((entry) => this.insurance(input, entry)),
    ]);
    const lines = [this.header(input, totalDays, totalGross, totalPayable), ...detailLines, 'EOF'];

    const lengths = [
      363,
      ...[...grouped.values()].flatMap((entries) => [178, ...entries.map(() => 162)]),
      3,
    ];
    lines.forEach((line, index) => {
      if (line.length !== lengths[index]) {
        throw new Error(`Invalid APD record length at line ${index + 1}: ${line.length}.`);
      }
    });

    return iconv.encode(lines.join('\r\n'), 'windows-1253');
  }

  private header(input: ApdExportInput, days: number, gross: number, payable: number): string {
    const legalName = splitLegalName(input.employer.legalName);
    return [
      '1',
      num(input.declarationType === 'NORMAL' ? '01' : '04', 2),
      num(input.employer.submissionOfficeCode, 10),
      alpha(input.employer.submissionOfficeName, 50),
      alpha(legalName.lastName, 80),
      alpha(legalName.firstName, 30),
      alpha('', 30),
      num(input.employer.registryNumber, 10),
      num(input.employer.vatNumber, 9),
      alpha(input.employer.street, 50),
      alpha(input.employer.streetNumber, 10),
      num(input.employer.postalCode, 5),
      alpha(input.employer.city, 30),
      num(input.periodMonth, 2),
      num(input.periodYear, 4),
      num(days, 8),
      cents(gross, 12),
      cents(payable, 12),
      apdDate(input.submittedAt),
    ].join('');
  }

  private employee(entry: ApdExportInput['entries'][number]): string {
    return [
      '2',
      num(entry.employee.insuranceRegistryNumber, 9),
      num(entry.employee.amka, 11),
      alpha(entry.employee.lastName, 50),
      alpha(entry.employee.firstName, 30),
      alpha(entry.employee.fatherName, 30),
      alpha(entry.employee.motherName, 30),
      apdDate(entry.employee.birthDate),
      num(entry.employee.afm, 9),
    ].join('');
  }

  private insurance(
    input: ApdExportInput,
    entry: ApdExportInput['entries'][number],
  ): string {
    const total = money(entry.employeeContributions + entry.employerContributions);
    return [
      '3',
      num(entry.contract.branchNumber, 4),
      num(entry.contract.kad, 4),
      entry.contract.fullTime ? '1' : '0',
      '1',
      '0',
      num(entry.contract.specialtyCode, 6),
      num(entry.contract.specialInsuranceCase, 2),
      num(entry.contract.coveragePackageCode, 4),
      num(input.periodMonth, 2),
      num(input.periodYear, 4),
      apdDate(entry.employmentFrom),
      apdDate(entry.employmentTo),
      num(entry.earningsType, 3),
      num(entry.insuranceDays, 3),
      cents(entry.dailyWage, 10),
      cents(entry.grossEarnings, 10),
      cents(entry.employeeContributions, 10),
      cents(entry.employerContributions, 10),
      cents(total, 11),
      cents(0, 10),
      cents(0, 10),
      cents(total, 11),
      cents(0, 10),
      cents(0, 10),
      num(entry.contract.externalSupplementaryFund, 2),
      num(entry.contract.externalHealthFund, 2),
      entry.contract.compensationType === 'DAILY' ? '1' : '0',
      entry.contract.weeklySystem === 'FIVE_DAY' ? '1' : '2',
      '00',
    ].join('');
  }
}

function alpha(value: string, width: number): string {
  const normalized = String(value ?? '').normalize('NFC').toUpperCase();
  if (normalized.length > width) {
    throw new BadRequestException(`Τιμή ΑΠΔ μεγαλύτερη από ${width} χαρακτήρες: ${value}`);
  }
  return normalized.padEnd(width, ' ');
}

function num(value: string | number, width: number): string {
  const normalized = String(value ?? '').replace(/\D/g, '');
  if (normalized.length > width) {
    throw new BadRequestException(`Αριθμητική τιμή ΑΠΔ μεγαλύτερη από ${width} ψηφία: ${value}`);
  }
  return normalized.padStart(width, '0');
}

function cents(value: number, width: number): string {
  return num(Math.round(money(value) * 100), width);
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function apdDate(value: Date): string {
  return [
    String(value.getUTCDate()).padStart(2, '0'),
    String(value.getUTCMonth() + 1).padStart(2, '0'),
    value.getUTCFullYear(),
  ].join('');
}

function splitLegalName(legalName: string): { lastName: string; firstName: string } {
  return { lastName: legalName, firstName: '' };
}
