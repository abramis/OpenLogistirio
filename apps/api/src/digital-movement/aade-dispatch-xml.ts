import { Prisma } from '@prisma/client';

export interface AadeDispatchXmlNote {
  series: string;
  number: string;
  issueDate: Date;
  plannedDispatchAt: Date;
  movePurpose: number;
  otherMovePurposeTitle: string | null;
  vehicleNumber: string | null;
  recipientVatNumber: string | null;
  recipientName: string | null;
  clientCompany: { vatNumber: string };
  lines: Array<{
    lineNumber: number;
    itemCode: string;
    description: string;
    quantity: Prisma.Decimal;
    measurementUnit: number;
    movePurposeLine: number | null;
    otherMovePurposeLineTitle: string | null;
  }>;
}

export function buildAadeDispatchXml(note: AadeDispatchXmlNote): string {
  const dispatchDate = note.plannedDispatchAt.toISOString().slice(0, 10);
  const dispatchTime = note.plannedDispatchAt.toISOString().slice(11, 19);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<InvoicesDoc xmlns="http://www.aade.gr/myDATA/invoice/v1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    '  <invoice>',
    '    <issuer>',
    `      <vatNumber>${escapeXml(note.clientCompany.vatNumber)}</vatNumber>`,
    '      <country>GR</country>',
    '      <branch>0</branch>',
    '    </issuer>',
    ...(note.recipientVatNumber
      ? [
          '    <counterpart>',
          `      <vatNumber>${escapeXml(note.recipientVatNumber)}</vatNumber>`,
          '      <country>GR</country>',
          '      <branch>0</branch>',
          '    </counterpart>',
        ]
      : []),
    '    <invoiceHeader>',
    `      <series>${escapeXml(note.series)}</series>`,
    `      <aa>${escapeXml(note.number)}</aa>`,
    `      <issueDate>${note.issueDate.toISOString().slice(0, 10)}</issueDate>`,
    '      <invoiceType>9.3</invoiceType>',
    '      <currency>EUR</currency>',
    `      <dispatchDate>${dispatchDate}</dispatchDate>`,
    `      <dispatchTime>${dispatchTime}</dispatchTime>`,
    ...(note.vehicleNumber
      ? [`      <vehicleNumber>${escapeXml(note.vehicleNumber)}</vehicleNumber>`]
      : []),
    `      <movePurpose>${note.movePurpose}</movePurpose>`,
    '      <isDeliveryNote>true</isDeliveryNote>',
    ...(note.otherMovePurposeTitle
      ? [
          `      <otherMovePurposeTitle>${escapeXml(note.otherMovePurposeTitle)}</otherMovePurposeTitle>`,
        ]
      : []),
    '    </invoiceHeader>',
    ...note.lines.flatMap((line) => [
      '    <invoiceDetails>',
      `      <lineNumber>${line.lineNumber}</lineNumber>`,
      `      <itemCode>${escapeXml(line.itemCode)}</itemCode>`,
      `      <itemDescr>${escapeXml(line.description)}</itemDescr>`,
      `      <quantity>${Number(line.quantity).toFixed(3)}</quantity>`,
      `      <measurementUnit>${line.measurementUnit}</measurementUnit>`,
      '      <netValue>0.00</netValue>',
      '      <vatCategory>8</vatCategory>',
      '      <vatAmount>0.00</vatAmount>',
      `      <movePurposeLine>${line.movePurposeLine ?? note.movePurpose}</movePurposeLine>`,
      ...(line.otherMovePurposeLineTitle
        ? [
            `      <otherMovePurposeLineTitle>${escapeXml(line.otherMovePurposeLineTitle)}</otherMovePurposeLineTitle>`,
          ]
        : []),
      '    </invoiceDetails>',
    ]),
    '    <invoiceSummary>',
    '      <totalNetValue>0.00</totalNetValue>',
    '      <totalVatAmount>0.00</totalVatAmount>',
    '      <totalWithheldAmount>0.00</totalWithheldAmount>',
    '      <totalFeesAmount>0.00</totalFeesAmount>',
    '      <totalStampDutyAmount>0.00</totalStampDutyAmount>',
    '      <totalOtherTaxesAmount>0.00</totalOtherTaxesAmount>',
    '      <totalDeductionsAmount>0.00</totalDeductionsAmount>',
    '      <totalGrossValue>0.00</totalGrossValue>',
    '    </invoiceSummary>',
    '  </invoice>',
    '</InvoicesDoc>',
  ].join('\n');
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
