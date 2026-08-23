import { BadRequestException } from '@nestjs/common';
import { AnnualCertificateKind } from '@prisma/client';
import { createHash } from 'node:crypto';
import iconv from 'iconv-lite';

export interface AnnualFileLine {
  beneficiaryVatNumber: string | null;
  beneficiaryLastName: string;
  beneficiaryFirstName: string | null;
  beneficiaryFatherName: string | null;
  beneficiarySocialSecurity: string | null;
  dependentChildren: number;
  foreignWithoutGreekVat: boolean;
  countryCode: string | null;
  incomeCode: string;
  grossAmount: unknown;
  deductionsAmount: unknown;
  netAmount: unknown;
  withheldTaxAmount: unknown;
  digitalFeeAmount: unknown;
  referenceYear: number | null;
  lawProvision: string | null;
}

export interface AnnualFileInput {
  fiscalYear: number;
  kind: AnnualCertificateKind;
  revision: number;
  declarantName: string;
  declarantFirstName: string | null;
  declarantFatherName: string | null;
  declarantIsLegalEntity: boolean;
  declarantVatNumber: string;
  businessActivity: string;
  city: string;
  street: string;
  streetNumber: string;
  postalCode: string;
  grossAmount: unknown;
  deductionsAmount: unknown;
  netAmount: unknown;
  withheldTaxAmount: unknown;
  digitalFeeAmount: unknown;
  lines: AnnualFileLine[];
}

export interface AadeAnnualArchive {
  filename: string;
  content: Buffer;
  checksumSha256: string;
}

const SUPPORTED_SPECIFICATIONS = new Map([[2025, 'AADE_A1195_2025_JL10_CP737_ZIP']]);

export function annualSpecification(fiscalYear: number): string {
  const specification = SUPPORTED_SPECIFICATIONS.get(fiscalYear);
  if (!specification) {
    throw new BadRequestException(
      `Δεν υπάρχει επαληθευμένη γραμμογράφηση ετήσιων βεβαιώσεων ΑΑΔΕ για το φορολογικό έτος ${fiscalYear}. Εγκαταστήστε έκδοση που υποστηρίζει επίσημα αυτό το έτος.`,
    );
  }
  return specification;
}

export function buildAadeAnnualArchive(
  value: AnnualFileInput,
  generatedAt = new Date(),
): AadeAnnualArchive {
  annualSpecification(value.fiscalYear);
  assertExportable(value);
  const text = buildAadeAnnualText(value, generatedAt);
  const payload = iconv.encode(text, 'CP737');
  const category = {
    EMPLOYMENT: 'employment',
    BUSINESS_ACTIVITY: 'business',
    DIVIDENDS_INTEREST_ROYALTIES: 'dividends-interest-royalties',
  }[value.kind];
  const base = `${value.declarantVatNumber}_${value.fiscalYear}_${category}_r${value.revision}`;
  const content = singleFileZip(`${base}.txt`, payload, generatedAt);
  return {
    filename: `${base}.zip`,
    content,
    checksumSha256: createHash('sha256').update(content).digest('hex'),
  };
}

export function buildAadeAnnualText(value: AnnualFileInput, generatedAt = new Date()): string {
  annualSpecification(value.fiscalYear);
  const header = `0JL10    ${date8(generatedAt)}${value.fiscalYear}${spaces(127)}\r\n`;
  const declarant = value.declarantIsLegalEntity
    ? fixedGreek(value.declarantName, 30) + '0'
    : fixedGreek(value.declarantName, 18) +
      fixedGreek(value.declarantFirstName ?? '', 9) +
      fixedGreek(value.declarantFatherName ?? '', 3) +
      '1';
  const identity =
    '1' +
    String(value.fiscalYear) +
    declarant +
    digits(value.declarantVatNumber, 9) +
    fixedGreek(value.businessActivity, 16) +
    fixedGreek(value.city, 10) +
    fixedGreek(value.street, 16) +
    fixedGreek(value.streetNumber, 5) +
    digits(value.postalCode, 5) +
    spaces(51) +
    '\r\n';
  const totals =
    '2' +
    cents(value.grossAmount, 16) +
    cents(value.deductionsAmount, 16) +
    cents(value.netAmount, 16) +
    zeros(15) +
    cents(value.withheldTaxAmount, 15) +
    zeros(15) +
    cents(value.digitalFeeAmount, 14) +
    zeros(13) +
    spaces(27) +
    '\r\n';
  const details = value.lines
    .map((line) =>
      value.kind === AnnualCertificateKind.EMPLOYMENT
        ? employmentDetail(line)
        : otherIncomeDetail(line),
    )
    .join('');
  const result = header + identity + totals + details;
  for (const line of result.split('\r\n').filter(Boolean)) {
    if (line.length !== 148) {
      throw new BadRequestException(
        `Εσωτερικό σφάλμα γραμμογράφησης ΑΑΔΕ: εγγραφή ${line[0]} μήκους ${line.length} αντί 148.`,
      );
    }
  }
  return result;
}

function employmentDetail(line: AnnualFileLine): string {
  return (
    '3' +
    digits(line.beneficiaryVatNumber ?? '', 9) +
    ' ' +
    fixedGreek(line.beneficiaryLastName, 18) +
    fixedGreek(line.beneficiaryFirstName ?? '', 9) +
    fixedGreek(line.beneficiaryFatherName ?? '', 3) +
    fixedAscii(line.beneficiarySocialSecurity ?? '', 11) +
    String(line.dependentChildren).padStart(2, '0') +
    String(line.incomeCode).padStart(2, '0') +
    cents(line.grossAmount, 11) +
    cents(line.deductionsAmount, 10) +
    cents(line.netAmount, 11) +
    zeros(10) +
    cents(line.withheldTaxAmount, 10) +
    zeros(10) +
    cents(line.digitalFeeAmount, 9) +
    zeros(8) +
    (line.referenceYear ? String(line.referenceYear) : '0000') +
    fixedAscii(line.lawProvision ?? '', 9) +
    '\r\n'
  );
}

function otherIncomeDetail(line: AnnualFileLine): string {
  return (
    '3' +
    (line.foreignWithoutGreekVat
      ? fixedAscii(line.beneficiaryVatNumber ?? '', 9)
      : digits(line.beneficiaryVatNumber ?? '', 9)) +
    ' ' +
    fixedGreek(line.beneficiaryLastName, 18) +
    fixedGreek(line.beneficiaryFirstName ?? '', 9) +
    fixedGreek(line.beneficiaryFatherName ?? '', 3) +
    fixedAscii(line.beneficiarySocialSecurity ?? '', 11) +
    '00' +
    String(line.incomeCode).padStart(2, '0') +
    cents(line.grossAmount, 11) +
    cents(line.deductionsAmount, 10) +
    cents(line.netAmount, 11) +
    (line.foreignWithoutGreekVat ? '1' : '0') +
    fixedAscii(line.countryCode ?? '', 2) +
    zeros(7) +
    cents(line.withheldTaxAmount, 10) +
    zeros(9) +
    cents(line.digitalFeeAmount, 8) +
    zeros(4) +
    zeros(4) +
    zeros(4) +
    '/' +
    zeros(4) +
    '\r\n'
  );
}

function assertExportable(value: AnnualFileInput): void {
  if (value.lines.length === 0) {
    throw new BadRequestException('Δεν δημιουργείται αρχείο ΑΑΔΕ χωρίς αναλυτικές εγγραφές.');
  }
  if (!/^\d{9}$/.test(value.declarantVatNumber) || !/^\d{5}$/.test(value.postalCode)) {
    throw new BadRequestException('Ο ΑΦΜ δηλούντος και ο ΤΚ πρέπει να είναι αριθμητικοί κωδικοί.');
  }
  for (const line of value.lines) {
    if (!line.foreignWithoutGreekVat && !/^\d{9}$/.test(line.beneficiaryVatNumber ?? '')) {
      throw new BadRequestException('Κάθε ημεδαπός δικαιούχος χρειάζεται ΑΦΜ 9 ψηφίων.');
    }
    if (line.foreignWithoutGreekVat && !/^[A-Z]{2}$/.test(line.countryCode ?? '')) {
      throw new BadRequestException('Κάθε αλλοδαπός δικαιούχος χρειάζεται κωδικό χώρας ISO-2.');
    }
  }
}

function fixedGreek(value: string, length: number): string {
  const normalized = value.trim().toUpperCase().replace(/\r?\n/g, ' ');
  const encoded = iconv.encode(normalized, 'CP737');
  const decoded = iconv.decode(encoded, 'CP737').replace(/\?/g, '');
  return decoded.slice(0, length).padEnd(length, ' ');
}

function fixedAscii(value: string, length: number): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9/]/g, '')
    .slice(0, length)
    .padEnd(length, ' ');
}

function digits(value: string, length: number): string {
  const normalized = value.replace(/\D/g, '');
  if (normalized.length !== length) {
    throw new BadRequestException(`Αναμενόταν αριθμητικό πεδίο ${length} ψηφίων.`);
  }
  return normalized;
}

function cents(value: unknown, width: number): string {
  const amount = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(amount) || amount < 0 || String(amount).length > width) {
    throw new BadRequestException('Ποσό εκτός ορίων για το επίσημο αρχείο ΑΑΔΕ.');
  }
  return String(amount).padStart(width, '0');
}

function date8(value: Date): string {
  return `${value.getFullYear()}${String(value.getMonth() + 1).padStart(2, '0')}${String(value.getDate()).padStart(2, '0')}`;
}

function spaces(count: number): string {
  return ' '.repeat(count);
}

function zeros(count: number): string {
  return '0'.repeat(count);
}

function singleFileZip(name: string, content: Buffer, date: Date): Buffer {
  const filename = Buffer.from(name, 'ascii');
  const crc = crc32(content);
  const dos = dosDateTime(date);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(dos.time, 10);
  local.writeUInt16LE(dos.date, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(content.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(dos.time, 12);
  central.writeUInt16LE(dos.date, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(content.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(filename.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + filename.length, 12);
  end.writeUInt32LE(local.length + filename.length + content.length, 16);
  return Buffer.concat([local, filename, content, central, filename, end]);
}

function dosDateTime(value: Date): { date: number; time: number } {
  const year = Math.max(1980, value.getFullYear());
  return {
    date: ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate(),
    time: (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2),
  };
}

function crc32(value: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of value) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
