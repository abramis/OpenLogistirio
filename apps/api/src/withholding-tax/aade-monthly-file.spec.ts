import {
  WithholdingTaxCategory,
  WithholdingTaxReturnType,
  WithholdingTaxStatus,
} from '@prisma/client';
import iconv from 'iconv-lite';
import { buildAadeMonthlyArchive, buildAadeMonthlyText } from './aade-monthly-file';

describe('AADE JL10 monthly file', () => {
  const declaration = {
    id: 'return-1',
    accountingOfficeId: 'office-1',
    clientCompanyId: 'company-1',
    periodYear: 2026,
    periodMonth: 1,
    category: WithholdingTaxCategory.DIVIDENDS,
    returnType: WithholdingTaxReturnType.INITIAL,
    revision: 0,
    status: WithholdingTaxStatus.APPROVED,
    submissionDeadline: new Date('2026-03-31T20:59:59.999Z'),
    declarantName: 'ΔΟΚΙΜΗ ΙΚΕ',
    declarantFirstName: null,
    declarantFatherName: null,
    declarantIsLegalEntity: true,
    declarantVatNumber: '123456789',
    businessActivity: 'ΛΟΓΙΣΤΙΚΕΣ ΥΠΗΡ',
    city: 'ΑΘΗΝΑ',
    street: 'ΣΤΑΔΙΟΥ',
    streetNumber: '10',
    postalCode: '10564',
    grossAmount: 1000,
    deductionsAmount: 0,
    netAmount: 1000,
    assessedTaxAmount: 50,
    withheldTaxAmount: 50,
    digitalFeeAmount: 0,
    digitalFeeOgaAmount: 0,
    payableAmount: 50,
    approvedSnapshot: {},
    approvedById: 'user-1',
    approvedAt: new Date(),
    fileGeneratedAt: null,
    fileProtocol: null,
    submittedAt: null,
    submissionReference: null,
    debtId: null,
    lateSubmission: null,
    paidAt: null,
    paymentReference: null,
    latePayment: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: [
      {
        id: 'line-1',
        withholdingTaxReturnId: 'return-1',
        beneficiaryVatNumber: '987654321',
        beneficiaryLastName: 'ΠΑΠΑΔΟΠΟΥΛΟΣ',
        beneficiaryFirstName: 'ΝΙΚΟΣ',
        beneficiaryFatherName: 'ΓΕΩ',
        beneficiarySocialSecurity: null,
        foreignWithoutGreekVat: false,
        countryCode: null,
        incomeCode: '01',
        paymentDate: new Date('2026-01-15T10:00:00+02:00'),
        grossAmount: 1000,
        deductionsAmount: 0,
        netAmount: 1000,
        withholdingRate: 5,
        assessedTaxAmount: 50,
        withheldTaxAmount: 50,
        digitalFeeRate: 0,
        digitalFeeAmount: 0,
        digitalFeeOgaAmount: 0,
        exemptionLawArticle: null,
        exemptionLawNumber: null,
        exemptionLawYear: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  it('creates four fixed-width CRLF records in the official Greek encoding', () => {
    const text = buildAadeMonthlyText(declaration, new Date('2026-01-20T10:00:00Z'));
    const records = text.split('\r\n').filter(Boolean);
    expect(records).toHaveLength(4);
    expect(records.slice(0, 3).every((record) => iconv.encode(record, 'ISO-8859-7').length === 148)).toBe(true);
    expect(iconv.encode(records[3], 'ISO-8859-7').length).toBe(152);
    expect(records[0]).toMatch(/^0JL10 {4}202601202026/);
    expect(records[1].slice(-51, -49)).toBe('01');
    expect(records[3][0]).toBe('3');
    expect(records[3].slice(1, 10)).toBe('987654321');
  });

  it('wraps the fixed-width file in a valid single-entry zip container', () => {
    const archive = buildAadeMonthlyArchive(declaration, new Date('2026-01-20T10:00:00Z'));
    expect(archive.filename).toBe('123456789_2026_01_dividends.zip');
    expect(archive.content.readUInt32LE(0)).toBe(0x04034b50);
    expect(archive.content.includes(Buffer.from('123456789_2026_01_dividends.txt'))).toBe(true);
    expect(archive.content.readUInt32LE(archive.content.length - 22)).toBe(0x06054b50);
  });
});
