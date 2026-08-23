import { BadRequestException } from '@nestjs/common';
import { IntrastatFlow, ViesReturnKind } from '@prisma/client';
import { createHash } from 'node:crypto';

export interface ViesFileInput {
  periodYear: number;
  periodMonth: number;
  kind: ViesReturnKind;
  revision: number;
  clientCompany: { legalName: string; vatNumber: string; address?: string | null };
  lines: Array<{
    countryCode: string;
    vatNumber: string;
    counterpartyName?: string | null;
    goodsAmount: unknown;
    triangularAmount: unknown;
    servicesAmount: unknown;
  }>;
}

export function buildViesXml(input: ViesFileInput): {
  filename: string;
  content: Buffer;
  checksumSha256: string;
} {
  if (!input.lines.length) throw new BadRequestException('Ο πίνακας VIES δεν έχει γραμμές.');
  const isF4 = input.kind === ViesReturnKind.F4_SUPPLIES;
  const documentName = isF4 ? 'vatF4Ver2009Document' : 'vatF5Ver2009Document';
  const pages = chunk(input.lines, 25);
  const from = `${input.periodYear}-${pad(input.periodMonth)}-01`;
  const toDate = new Date(Date.UTC(input.periodYear, input.periodMonth, 0));
  const to = `${input.periodYear}-${pad(input.periodMonth)}-${pad(toDate.getUTCDate())}`;
  const grids = pages
    .map((page, pageIndex) => {
      const rows = page
        .map(
          (
            line,
            index,
          ) => `      <Rows toBeDeleted="false" ctryDesc="${xml(line.counterpartyName ?? '')}">
        <Bc1>${index + 1}</Bc1><Bc2>${xml(line.counterpartyName ?? line.countryCode)}</Bc2>
        <Bc3>${xml(line.countryCode)}</Bc3><Bc4>${xml(stripCountry(line.vatNumber, line.countryCode))}</Bc4>
        <Bc5>${amount(line.goodsAmount)}</Bc5><Bc6>${amount(line.triangularAmount)}</Bc6><Bc7>${amount(line.servicesAmount)}</Bc7>
      </Rows>`,
        )
        .join('\n');
      return `    <Grids CurrentPage="${pageIndex + 1}">
${rows}
      <Bc5T>${amount(sum(page, 'goodsAmount'))}</Bc5T><Bc6T>${amount(sum(page, 'triangularAmount'))}</Bc6T><Bc7T>${amount(sum(page, 'servicesAmount'))}</Bc7T>
    </Grids>`;
    })
    .join('\n');
  const value = `<?xml version="1.0" encoding="UTF-8"?>
<${documentName} xmlns="http://www.taxisnet.gr/vat">
  <f006A>${from}</f006A><f006B>${to}</f006B><f007>${input.revision > 0}</f007>
  <f008B>${input.periodYear}</f008B><f010>${input.periodMonth}</f010>
  <f011>${xml(input.clientCompany.legalName)}</f011><f015>${xml(input.clientCompany.address ?? '')}</f015>
  <f020>${xml(input.clientCompany.vatNumber)}</f020><f023B>${pages.length}</f023B>
${grids}
</${documentName}>`;
  const content = Buffer.from(value, 'utf8');
  const kind = isF4 ? 'F4' : 'F5';
  return {
    filename: `${input.clientCompany.vatNumber}_${input.periodYear}_${pad(input.periodMonth)}_${kind}_r${input.revision}.xml`,
    content,
    checksumSha256: createHash('sha256').update(content).digest('hex'),
  };
}

export interface IntrastatFileInput {
  periodYear: number;
  periodMonth: number;
  flow: IntrastatFlow;
  revision: number;
  clientCompany: { vatNumber: string };
  lines: Array<{
    lineNumber: number;
    countryCode: string;
    transactionNature: string;
    transportMode: string;
    commodityCode: string;
    netMassKg: number;
    supplementaryUnits: number;
    invoicedAmount: number;
    statisticalValue: number;
  }>;
}

export function buildIntrastatTxt(input: IntrastatFileInput) {
  if (!input.lines.length) throw new BadRequestException('Η δήλωση Intrastat δεν έχει γραμμές.');
  const flow = input.flow === IntrastatFlow.ARRIVALS ? 'A' : 'D';
  const rows = input.lines.map((line) => {
    if (!/^\d{8}$/.test(line.commodityCode) || !/^[A-Z]{2}$/.test(line.countryCode)) {
      throw new BadRequestException('Μη έγκυρος CN8 ή κωδικός χώρας Intrastat.');
    }
    const row =
      digits(input.clientCompany.vatNumber, 9) +
      flow +
      String(input.periodYear) +
      pad(input.periodMonth) +
      integer(line.lineNumber, 5) +
      line.countryCode +
      ' ' +
      line.transactionNature +
      line.transportMode +
      line.commodityCode +
      integer(line.netMassKg, 13) +
      integer(line.supplementaryUnits, 13, true) +
      integer(line.invoicedAmount, 13) +
      integer(line.statisticalValue, 13);
    if (row.length !== 87)
      throw new BadRequestException('Εσωτερικό σφάλμα γραμμογράφησης Intrastat.');
    return row;
  });
  const content = Buffer.from(`${rows.join('\r\n')}\r\n`, 'ascii');
  return {
    filename: `${input.clientCompany.vatNumber}_${input.periodYear}_${pad(input.periodMonth)}_${flow}_r${input.revision}.txt`,
    content,
    checksumSha256: createHash('sha256').update(content).digest('hex'),
  };
}

function stripCountry(value: string, country: string): string {
  const normalized = value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return normalized.startsWith(country) ? normalized.slice(2) : normalized;
}

function amount(value: unknown): string {
  const number = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(number) || number < 0) throw new BadRequestException('Μη έγκυρο ποσό VIES.');
  return number.toFixed(2);
}

function integer(value: number, width: number, allowZero = false): string {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || String(value).length > width) {
    throw new BadRequestException('Αριθμητικό πεδίο Intrastat εκτός ορίων.');
  }
  return String(value).padStart(width, '0');
}

function digits(value: string, length: number): string {
  const result = value.replace(/\D/g, '');
  if (result.length !== length) throw new BadRequestException(`Αναμενόταν πεδίο ${length} ψηφίων.`);
  return result;
}

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function sum<T>(items: T[], key: keyof T): number {
  return items.reduce((total, item) => total + Number(item[key]), 0);
}

function chunk<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}
