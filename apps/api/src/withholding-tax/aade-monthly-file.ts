import { BadRequestException } from '@nestjs/common';
import { WithholdingTaxCategory, WithholdingTaxReturn, WithholdingTaxReturnLine } from '@prisma/client';
import iconv from 'iconv-lite';

type NumericLineFields =
  | 'grossAmount'
  | 'deductionsAmount'
  | 'netAmount'
  | 'withholdingRate'
  | 'assessedTaxAmount'
  | 'withheldTaxAmount'
  | 'digitalFeeRate'
  | 'digitalFeeAmount'
  | 'digitalFeeOgaAmount';
type NumericReturnFields =
  | 'grossAmount'
  | 'deductionsAmount'
  | 'netAmount'
  | 'assessedTaxAmount'
  | 'withheldTaxAmount'
  | 'digitalFeeAmount'
  | 'digitalFeeOgaAmount'
  | 'payableAmount';
type AadeLine = Omit<WithholdingTaxReturnLine, NumericLineFields> &
  Record<NumericLineFields, unknown>;
type ReturnWithLines = Omit<WithholdingTaxReturn, NumericReturnFields> &
  Record<NumericReturnFields, unknown> & { lines: AadeLine[] };

export interface AadeMonthlyArchive {
  filename: string;
  content: Buffer;
}

export function buildAadeMonthlyArchive(value: ReturnWithLines, generatedAt = new Date()): AadeMonthlyArchive {
  assertExportable(value);
  const payload = iconv.encode(buildAadeMonthlyText(value, generatedAt), 'ISO-8859-7');
  const base = `${value.declarantVatNumber}_${value.periodYear}_${String(value.periodMonth).padStart(2, '0')}_${fileCategory(value.category)}`;
  const entryName = `${base}.txt`;
  return {
    filename: `${base}.zip`,
    content: singleFileZip(entryName, payload, generatedAt),
  };
}

export function buildAadeMonthlyText(value: ReturnWithLines, generatedAt = new Date()): string {
  const header = `0JL10    ${date8(generatedAt)}${value.periodYear}${spaces(127)}\r\n`;
  const declarant = value.declarantIsLegalEntity
    ? fixedGreek(value.declarantName, 30) + '0'
    : fixedGreek(value.declarantName, 18) +
      fixedGreek(value.declarantFirstName ?? '', 9) +
      fixedGreek(value.declarantFatherName ?? '', 3) +
      '1';
  const identity =
    '1' +
    String(value.periodYear) +
    declarant +
    digits(value.declarantVatNumber, 9) +
    fixedGreek(value.businessActivity, 16) +
    fixedGreek(value.city, 10) +
    fixedGreek(value.street, 16) +
    fixedGreek(value.streetNumber, 5) +
    digits(value.postalCode, 5) +
    String(value.periodMonth).padStart(2, '0') +
    spaces(49) +
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
    cents(value.digitalFeeOgaAmount, 13) +
    spaces(27) +
    '\r\n';
  return header + identity + totals + value.lines.map(buildDetailLine).join('');
}

function buildDetailLine(line: AadeLine): string {
  const foreign = line.foreignWithoutGreekVat;
  const rate = Number(line.withholdingRate);
  if (!Number.isInteger(rate)) {
    throw new BadRequestException(
      'Το επίσημο αρχείο ΑΑΔΕ 2026 δέχεται ακέραιο διψήφιο συντελεστή παρακράτησης.',
    );
  }
  return (
    '3' +
    (foreign ? fixedAscii(line.beneficiaryVatNumber ?? '', 9) : digits(line.beneficiaryVatNumber ?? '', 9)) +
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
    (foreign ? '1' : '0') +
    fixedAscii(line.countryCode ?? '', 2) +
    String(rate).padStart(2, '0') +
    zeros(5) +
    cents(line.assessedTaxAmount, 10) +
    cents(line.withheldTaxAmount, 10) +
    zeros(9) +
    cents(line.digitalFeeAmount, 8) +
    cents(line.digitalFeeOgaAmount, 4) +
    fixedAscii(line.exemptionLawArticle ?? '', 4, '0') +
    fixedAscii(line.exemptionLawNumber ?? '', 4, '0') +
    '/' +
    fixedAscii(line.exemptionLawYear ?? '', 4, '0') +
    '\r\n'
  );
}

function assertExportable(value: ReturnWithLines): void {
  if (value.lines.length === 0) {
    throw new BadRequestException('Δεν δημιουργείται αρχείο ΑΑΔΕ χωρίς αναλυτικές εγγραφές.');
  }
  if (!/^\d{9}$/.test(value.declarantVatNumber) || !/^\d{5}$/.test(value.postalCode)) {
    throw new BadRequestException('Ο ΑΦΜ δηλούντος και ο ΤΚ πρέπει να είναι έγκυροι αριθμητικοί κωδικοί.');
  }
  if (
    !value.declarantName.trim() ||
    (!value.declarantIsLegalEntity && !value.declarantFirstName?.trim()) ||
    !value.businessActivity.trim() ||
    !value.city.trim() ||
    !value.street.trim() ||
    !value.streetNumber.trim()
  ) {
    throw new BadRequestException('Λείπουν υποχρεωτικά στοιχεία δηλούντος για το αρχείο ΑΑΔΕ.');
  }
  for (const line of value.lines) {
    if (!line.foreignWithoutGreekVat && !/^\d{9}$/.test(line.beneficiaryVatNumber ?? '')) {
      throw new BadRequestException('Κάθε ημεδαπός δικαιούχος χρειάζεται ΑΦΜ 9 ψηφίων.');
    }
    if (line.foreignWithoutGreekVat && !/^[A-Z]{2}$/.test(line.countryCode ?? '')) {
      throw new BadRequestException('Κάθε αλλοδαπός χωρίς ελληνικό ΑΦΜ χρειάζεται κωδικό χώρας δύο γραμμάτων.');
    }
  }
}

function fixedGreek(value: string, length: number): string {
  const normalized = value.trim().toUpperCase().replace(/\r?\n/g, ' ');
  if (!iconv.encodingExists('ISO-8859-7')) {
    throw new BadRequestException('Δεν είναι διαθέσιμη η κωδικοποίηση αρχείου ΑΑΔΕ.');
  }
  const encoded = iconv.encode(normalized, 'ISO-8859-7');
  const decoded = iconv.decode(encoded, 'ISO-8859-7').replace(/\?/g, '');
  return decoded.slice(0, length).padEnd(length, ' ');
}

function fixedAscii(value: string, length: number, emptyFill = ' '): string {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return normalized.slice(0, length).padEnd(length, emptyFill);
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
  const year = value.getFullYear();
  return `${year}${String(value.getMonth() + 1).padStart(2, '0')}${String(value.getDate()).padStart(2, '0')}`;
}

function fileCategory(category: WithholdingTaxCategory): string {
  return {
    BUSINESS_ACTIVITY: 'business',
    DIVIDENDS: 'dividends',
    INTEREST: 'interest',
    ROYALTIES: 'royalties',
  }[category];
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
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt16LE(dos.time, 10);
  local.writeUInt16LE(dos.date, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(content.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(filename.length, 26);
  local.writeUInt16LE(0, 28);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt16LE(dos.time, 12);
  central.writeUInt16LE(dos.date, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(content.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(filename.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  central.writeUInt32LE(0, 38);
  central.writeUInt32LE(0, 42);

  const centralOffset = local.length + filename.length + content.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + filename.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);
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
