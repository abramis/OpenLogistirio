import { AnnualCertificateKind } from '@prisma/client';
import { buildAadeAnnualText } from './aade-annual-file';

const base = {
  fiscalYear: 2025,
  revision: 0,
  declarantName: 'ΔΟΚΙΜΗ ΑΕ',
  declarantFirstName: null,
  declarantFatherName: null,
  declarantIsLegalEntity: true,
  declarantVatNumber: '123456789',
  businessActivity: 'ΥΠΗΡΕΣΙΕΣ',
  city: 'ΑΘΗΝΑ',
  street: 'ΣΤΑΔΙΟΥ',
  streetNumber: '1',
  postalCode: '10564',
  grossAmount: 1000,
  deductionsAmount: 150,
  netAmount: 850,
  withheldTaxAmount: 100,
  digitalFeeAmount: 0,
};

describe('AADE annual certificate fixed-width file', () => {
  it('builds 148-character employment records for the verified 2025 schema', () => {
    const text = buildAadeAnnualText(
      {
        ...base,
        kind: AnnualCertificateKind.EMPLOYMENT,
        lines: [
          {
            beneficiaryVatNumber: '987654321',
            beneficiaryLastName: 'ΠΑΠΑΔΟΠΟΥΛΟΣ',
            beneficiaryFirstName: 'ΝΙΚΟΣ',
            beneficiaryFatherName: 'ΙΩΑΝΝΗΣ',
            beneficiarySocialSecurity: '01019012345',
            dependentChildren: 1,
            foreignWithoutGreekVat: false,
            countryCode: null,
            incomeCode: '01',
            grossAmount: 1000,
            deductionsAmount: 150,
            netAmount: 850,
            withheldTaxAmount: 100,
            digitalFeeAmount: 0,
            referenceYear: null,
            lawProvision: null,
          },
        ],
      },
      new Date(2026, 0, 15),
    );
    expect(text.split('\r\n').filter(Boolean)).toHaveLength(4);
    expect(
      text
        .split('\r\n')
        .filter(Boolean)
        .every((line) => line.length === 148),
    ).toBe(true);
  });

  it('rejects an unverified future fiscal-year schema', () => {
    expect(() =>
      buildAadeAnnualText({
        ...base,
        fiscalYear: 2026,
        kind: AnnualCertificateKind.EMPLOYMENT,
        lines: [],
      }),
    ).toThrow(/2026/);
  });
});
