import { IntrastatFlow, ViesReturnKind } from '@prisma/client';
import { buildIntrastatTxt, buildViesXml } from './compliance-files';

describe('official EU compliance files', () => {
  it('builds the ELSTAT 87-character Intrastat TXT layout', () => {
    const file = buildIntrastatTxt({
      periodYear: 2026,
      periodMonth: 7,
      flow: IntrastatFlow.ARRIVALS,
      revision: 0,
      clientCompany: { vatNumber: '123456789' },
      lines: [
        {
          lineNumber: 1,
          countryCode: 'DE',
          transactionNature: '11',
          transportMode: '3',
          commodityCode: '84713000',
          netMassKg: 10,
          supplementaryUnits: 1,
          invoicedAmount: 1200,
          statisticalValue: 1250,
        },
      ],
    });
    expect(file.content.toString('ascii').trimEnd()).toHaveLength(87);
    expect(file.content.toString('ascii').slice(9, 16)).toBe('A202607');
  });

  it('builds AADE F4 XML with official root and grouped totals', () => {
    const file = buildViesXml({
      periodYear: 2026,
      periodMonth: 7,
      kind: ViesReturnKind.F4_SUPPLIES,
      revision: 0,
      clientCompany: { legalName: 'ΔΟΚΙΜΗ ΑΕ', vatNumber: '123456789' },
      lines: [
        {
          countryCode: 'DE',
          vatNumber: 'DE123456789',
          counterpartyName: 'TEST GMBH',
          goodsAmount: 1000,
          triangularAmount: 0,
          servicesAmount: 200,
        },
      ],
    });
    const xml = file.content.toString('utf8');
    expect(xml).toContain('<vatF4Ver2009Document');
    expect(xml).toContain('<Bc5T>1000.00</Bc5T>');
  });
});
