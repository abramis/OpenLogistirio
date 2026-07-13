import { BadRequestException, Injectable } from '@nestjs/common';
import { DocumentType, MyDataTransmissionMode, Prisma } from '@prisma/client';

type DocumentWithCompany = Prisma.DocumentGetPayload<{
  include: {
    clientCompany: true;
  };
}>;

@Injectable()
export class MyDataMappingService {
  // Based on the official AADE myDATA ERP REST API technical description v2.0.1
  // (March 2026) and its SendInvoices/InvoicesDoc flow. Before production use,
  // re-check the latest official AADE myDATA ERP technical specifications, XSDs,
  // authentication rules, and test environment. Never store TAXISnet passwords.
  mapDocumentToXml(document: DocumentWithCompany): string {
    return this.mapDocumentToAadeInvoicesDocXml(document);
  }

  mapDocumentToAadeInvoicesDocXml(document: DocumentWithCompany): string {
    const invoiceType = mapDocumentTypeToAadeInvoiceType(
      document.documentType,
      document.correlatedInvoiceMark,
    );
    const vatCategory = mapVatCategory(document.vatCategory);
    const netAmount = document.netAmount.toFixed(2);
    const vatAmount = document.vatAmount.toFixed(2);
    const totalAmount = document.totalAmount.toFixed(2);
    const taxesTotals = taxesTotalsLines(document);

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<InvoicesDoc xmlns="http://www.aade.gr/myDATA/invoice/v1.0" xmlns:icls="https://www.aade.gr/myDATA/incomeClassificaton/v1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
      '  <invoice>',
      '    <issuer>',
      `      <vatNumber>${escapeXml(document.clientCompany.vatNumber)}</vatNumber>`,
      '      <country>GR</country>',
      '      <branch>0</branch>',
      `      <name>${escapeXml(document.clientCompany.legalName)}</name>`,
      '    </issuer>',
      '    <counterpart>',
      `      <vatNumber>${escapeXml(document.counterpartyVatNumber ?? '000000000')}</vatNumber>`,
      '      <country>GR</country>',
      '      <branch>0</branch>',
      `      <name>${escapeXml(document.counterpartyName ?? 'Unknown Counterparty')}</name>`,
      '    </counterpart>',
      '    <invoiceHeader>',
      `      <series>${escapeXml(document.series ?? '')}</series>`,
      `      <aa>${escapeXml(document.documentNumber)}</aa>`,
      `      <issueDate>${document.issueDate.toISOString().slice(0, 10)}</issueDate>`,
      `      <invoiceType>${invoiceType}</invoiceType>`,
      '      <currency>EUR</currency>',
      ...(document.correlatedInvoiceMark
        ? [
            `      <correlatedInvoices>${escapeXml(document.correlatedInvoiceMark)}</correlatedInvoices>`,
          ]
        : []),
      '    </invoiceHeader>',
      '    <paymentMethods>',
      '      <paymentMethodDetails>',
      `        <type>${document.paymentMethodType}</type>`,
      `        <amount>${totalAmount}</amount>`,
      '      </paymentMethodDetails>',
      '    </paymentMethods>',
      '    <invoiceDetails>',
      '      <lineNumber>1</lineNumber>',
      `      <netValue>${netAmount}</netValue>`,
      `      <vatCategory>${vatCategory}</vatCategory>`,
      `      <vatAmount>${vatAmount}</vatAmount>`,
      ...(document.vatExemptionCategory
        ? [`      <vatExemptionCategory>${document.vatExemptionCategory}</vatExemptionCategory>`]
        : []),
      '      <incomeClassification>',
      '        <icls:classificationType>E3_561_001</icls:classificationType>',
      '        <icls:classificationCategory>category1_1</icls:classificationCategory>',
      `        <icls:amount>${netAmount}</icls:amount>`,
      '      </incomeClassification>',
      '    </invoiceDetails>',
      ...taxesTotals,
      '    <invoiceSummary>',
      `      <totalNetValue>${netAmount}</totalNetValue>`,
      `      <totalVatAmount>${vatAmount}</totalVatAmount>`,
      `      <totalWithheldAmount>${document.withheldAmount.toFixed(2)}</totalWithheldAmount>`,
      `      <totalFeesAmount>${document.feesAmount.toFixed(2)}</totalFeesAmount>`,
      `      <totalStampDutyAmount>${document.stampDutyAmount.toFixed(2)}</totalStampDutyAmount>`,
      `      <totalOtherTaxesAmount>${document.otherTaxesAmount.toFixed(2)}</totalOtherTaxesAmount>`,
      `      <totalDeductionsAmount>${document.deductionsAmount.toFixed(2)}</totalDeductionsAmount>`,
      `      <totalGrossValue>${totalAmount}</totalGrossValue>`,
      '      <incomeClassification>',
      '        <icls:classificationType>E3_561_001</icls:classificationType>',
      '        <icls:classificationCategory>category1_1</icls:classificationCategory>',
      `        <icls:amount>${netAmount}</icls:amount>`,
      '      </incomeClassification>',
      '    </invoiceSummary>',
      '  </invoice>',
      '</InvoicesDoc>',
    ].join('\n');
  }

  mapPurchaseDocumentToExpenseClassificationXml(document: DocumentWithCompany): string {
    if (document.documentType !== DocumentType.PURCHASE_INVOICE) {
      throw new BadRequestException(
        'Expense classification preparation supports purchase invoices only.',
      );
    }

    const netAmount = document.netAmount.toFixed(2);
    const vatAmount = document.vatAmount.toFixed(2);
    const mark = document.myDataMark?.trim();
    const vatCategory = mapVatCategory(document.vatCategory);
    const vatClassificationType = mapExpenseVatClassificationType(vatCategory);

    if (!mark) {
      throw new BadRequestException(
        'Expense classification requires the AADE invoice MARK. Run RequestDocs reconciliation first or set the document MARK from AADE.',
      );
    }

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<ExpensesClassificationsDoc xmlns="https://www.aade.gr/myDATA/expensesClassificaton/v1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
      '  <expensesInvoiceClassification>',
      `    <invoiceMark>${escapeXml(mark)}</invoiceMark>`,
      ...entityVatNumberLines(document),
      '    <invoicesExpensesClassificationDetails>',
      '      <lineNumber>1</lineNumber>',
      '      <expensesClassificationDetailData>',
      '        <classificationType>E3_102_001</classificationType>',
      '        <classificationCategory>category2_4</classificationCategory>',
      `        <amount>${netAmount}</amount>`,
      '        <id>1</id>',
      '      </expensesClassificationDetailData>',
      ...(vatClassificationType
        ? [
            '      <expensesClassificationDetailData>',
            `        <classificationType>${vatClassificationType}</classificationType>`,
            `        <amount>${netAmount}</amount>`,
            `        <vatAmount>${vatAmount}</vatAmount>`,
            `        <vatCategory>${vatCategory}</vatCategory>`,
            ...(document.vatExemptionCategory
              ? [
                  `        <vatExemptionCategory>${document.vatExemptionCategory}</vatExemptionCategory>`,
                ]
              : []),
            '        <id>2</id>',
            '      </expensesClassificationDetailData>',
          ]
        : []),
      '    </invoicesExpensesClassificationDetails>',
      '    <classificationPostMode>1</classificationPostMode>',
      '  </expensesInvoiceClassification>',
      '</ExpensesClassificationsDoc>',
    ].join('\n');
  }
}

function mapExpenseVatClassificationType(vatCategory: string): string | undefined {
  const classificationTypes: Record<string, string> = {
    '1': 'VAT_361',
    '2': 'VAT_362',
    '3': 'VAT_363',
    '4': 'VAT_364',
    '5': 'VAT_365',
    '6': 'VAT_366',
  };

  if (vatCategory === '7' || vatCategory === '8') {
    return undefined;
  }

  const classificationType = classificationTypes[vatCategory];
  if (!classificationType) {
    throw new BadRequestException(
      `Expense classification does not yet support AADE VAT category ${vatCategory} in post-per-invoice mode.`,
    );
  }

  return classificationType;
}

function mapDocumentTypeToAadeInvoiceType(
  documentType: DocumentType,
  correlatedInvoiceMark?: string | null,
): string {
  if (documentType === DocumentType.SALES_INVOICE) {
    return '1.1';
  }

  if (documentType === DocumentType.CREDIT_NOTE) {
    return correlatedInvoiceMark ? '5.1' : '5.2';
  }

  if (documentType === DocumentType.RETAIL_RECEIPT) {
    return '11.1';
  }

  throw new BadRequestException(
    'AADE SendInvoices is only for issued sales documents. Purchase invoices require the expenses/receiver myDATA flow, which is not implemented yet.',
  );
}

function taxesTotalsLines(document: DocumentWithCompany): string[] {
  const taxes: Array<{ type: number; category?: number | null; amount: Prisma.Decimal }> = [
    { type: 1, category: document.withheldCategory, amount: document.withheldAmount },
    { type: 2, category: document.feesCategory, amount: document.feesAmount },
    { type: 3, category: document.otherTaxesCategory, amount: document.otherTaxesAmount },
    { type: 4, category: document.stampDutyCategory, amount: document.stampDutyAmount },
    { type: 5, amount: document.deductionsAmount },
  ];
  const populated = taxes.filter((tax) => tax.amount.greaterThan(0));

  if (populated.length === 0) {
    return [];
  }

  return [
    '    <taxesTotals>',
    ...populated.flatMap((tax, index) => [
      '      <taxes>',
      `        <taxType>${tax.type}</taxType>`,
      ...(tax.category ? [`        <taxCategory>${tax.category}</taxCategory>`] : []),
      `        <underlyingValue>${document.netAmount.toFixed(2)}</underlyingValue>`,
      `        <taxAmount>${tax.amount.toFixed(2)}</taxAmount>`,
      `        <id>${index + 1}</id>`,
      '      </taxes>',
    ]),
    '    </taxesTotals>',
  ];
}

function mapVatCategory(vatCategory: string): string {
  const categories: Record<string, string> = {
    VAT_24: '1',
    VAT_13: '2',
    VAT_6: '3',
    VAT_17: '4',
    VAT_9: '5',
    VAT_4: '6',
    VAT_0: '7',
    NO_VAT: '8',
    VAT_3: '9',
  };

  return categories[vatCategory] ?? vatCategory;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function entityVatNumberLines(document: DocumentWithCompany): string[] {
  if (document.clientCompany.myDataMode !== MyDataTransmissionMode.ACCOUNTING_OFFICE_AUTHORIZED) {
    return [];
  }

  return [`    <entityVatNumber>${escapeXml(document.clientCompany.vatNumber)}</entityVatNumber>`];
}
