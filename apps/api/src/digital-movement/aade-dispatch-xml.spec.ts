import { Prisma } from '@prisma/client';
import { MyDataXmlValidationService } from '../mydata/mydata-xml-validation.service';
import { buildAadeDispatchXml } from './aade-dispatch-xml';

describe('AADE digital dispatch XML', () => {
  it('validates invoice type 9.3 against the bundled official v2.0.1 XSD', () => {
    const xml = buildAadeDispatchXml({
      series: 'DA',
      number: '42',
      issueDate: new Date('2026-08-23T10:00:00Z'),
      plannedDispatchAt: new Date('2026-08-23T10:30:00Z'),
      movePurpose: 1,
      otherMovePurposeTitle: null,
      vehicleNumber: 'ΙΚΑ1234',
      recipientVatNumber: '123456789',
      recipientName: 'Recipient',
      clientCompany: { vatNumber: '999888777' },
      lines: [
        {
          lineNumber: 1,
          itemCode: 'SKU-1',
          description: 'Εμπόρευμα',
          quantity: new Prisma.Decimal(2),
          measurementUnit: 1,
          movePurposeLine: 1,
          otherMovePurposeLineTitle: null,
        },
      ],
    });
    expect(xml).toContain('<invoiceType>9.3</invoiceType>');
    expect(() => new MyDataXmlValidationService().validateInvoices(xml)).not.toThrow();
  });
});
