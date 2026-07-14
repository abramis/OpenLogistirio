import { BadRequestException, Injectable } from '@nestjs/common';
import { DocumentType, MyDataTransmissionMode, Prisma } from '@prisma/client';

type DocumentWithCompany = Prisma.DocumentGetPayload<{
  include: {
    clientCompany: true;
    lines: true;
    payments: true;
  };
}>;
type MappableDocument = Omit<
  DocumentWithCompany,
  'lines' | 'payments' | 'importBatchId' | 'replacesDocumentId' | 'correctsDocumentId'
> & {
  lines?: InvoiceLine[];
  payments?: PaymentLine[];
};

@Injectable()
export class MyDataMappingService {
  // Based on the official AADE myDATA ERP REST API technical description v2.0.1
  // (March 2026) and its SendInvoices/InvoicesDoc flow. Before production use,
  // re-check the latest official AADE myDATA ERP technical specifications, XSDs,
  // authentication rules, and test environment. Never store TAXISnet passwords.
  mapDocumentToXml(document: MappableDocument): string {
    return this.mapDocumentToAadeInvoicesDocXml(document);
  }

  mapDocumentToAadeInvoicesDocXml(document: MappableDocument): string {
    const invoiceType = mapDocumentTypeToAadeInvoiceType(
      document.documentType,
      document.correlatedInvoiceMark,
    );
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
      // AADE rejects issuer names for Greek VAT numbers (validation code 219).
      '    </issuer>',
      '    <counterpart>',
      `      <vatNumber>${escapeXml(document.counterpartyVatNumber ?? '000000000')}</vatNumber>`,
      '      <country>GR</country>',
      '      <branch>0</branch>',
      // AADE rejects counterpart names for Greek VAT numbers (validation code 220).
      ...(isGreekVatNumber(document.counterpartyVatNumber)
        ? []
        : document.counterpartyName
          ? [`      <name>${escapeXml(document.counterpartyName)}</name>`]
          : []),
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
      ...paymentMethodsLines(document),
      ...invoiceDetailsLines(document, invoiceType),
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
      ...summaryIncomeClassificationLines(document),
      '    </invoiceSummary>',
      '  </invoice>',
      '</InvoicesDoc>',
    ].join('\n');
  }

  mapPurchaseDocumentToExpenseClassificationXml(document: MappableDocument): string {
    if (document.documentType !== DocumentType.PURCHASE_INVOICE) {
      throw new BadRequestException(
        'Expense classification preparation supports purchase invoices only.',
      );
    }

    const mark = document.myDataMark?.trim();

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
      ...expenseClassificationLines(document),
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

function invoiceDetailsLines(document: MappableDocument, invoiceType: string): string[] {
  return documentLines(document).flatMap((line) => {
    const classificationType = line.incomeClassificationType ?? 'E3_561_001';
    const classificationCategory = line.incomeClassificationCategory ?? 'category1_1';
    return [
      '    <invoiceDetails>',
      `      <lineNumber>${line.lineNumber}</lineNumber>`,
      ...(line.itemCode ? [`      <itemCode>${escapeXml(line.itemCode)}</itemCode>`] : []),
      // AADE rejects itemDescr for correlated credit notes (invoice type 5.1).
      ...(invoiceType !== '5.1' && line.description
        ? [`      <itemDescr>${escapeXml(line.description)}</itemDescr>`]
        : []),
      ...(line.quantity !== null && line.quantity !== undefined
        ? [`      <quantity>${line.quantity.toString()}</quantity>`]
        : []),
      ...(line.measurementUnit
        ? [`      <measurementUnit>${line.measurementUnit}</measurementUnit>`]
        : []),
      `      <netValue>${money(line.netAmount)}</netValue>`,
      `      <vatCategory>${mapVatCategory(line.vatCategory)}</vatCategory>`,
      `      <vatAmount>${money(line.vatAmount)}</vatAmount>`,
      ...(line.vatExemptionCategory
        ? [`      <vatExemptionCategory>${line.vatExemptionCategory}</vatExemptionCategory>`]
        : []),
      ...(line.discountOption !== null && line.discountOption !== undefined
        ? [`      <discountOption>${line.discountOption}</discountOption>`]
        : []),
      ...lineTaxDetails(line),
      '      <incomeClassification>',
      `        <icls:classificationType>${escapeXml(classificationType)}</icls:classificationType>`,
      `        <icls:classificationCategory>${escapeXml(classificationCategory)}</icls:classificationCategory>`,
      `        <icls:amount>${money(line.netAmount)}</icls:amount>`,
      '      </incomeClassification>',
      '    </invoiceDetails>',
    ];
  });
}

function paymentMethodsLines(document: MappableDocument): string[] {
  return [
    '    <paymentMethods>',
    ...documentPayments(document).flatMap((payment) => [
      '      <paymentMethodDetails>',
      `        <type>${payment.type}</type>`,
      `        <amount>${money(payment.amount)}</amount>`,
      ...(payment.paymentMethodInfo
        ? [`        <paymentMethodInfo>${escapeXml(payment.paymentMethodInfo)}</paymentMethodInfo>`]
        : []),
      ...(payment.transactionId
        ? [`        <transactionId>${escapeXml(payment.transactionId)}</transactionId>`]
        : []),
      ...(payment.tid ? [`        <tid>${escapeXml(payment.tid)}</tid>`] : []),
      ...(payment.providerSigningAuthor && payment.providerSignature
        ? [
            '        <ProvidersSignature>',
            `          <SigningAuthor>${escapeXml(payment.providerSigningAuthor)}</SigningAuthor>`,
            `          <Signature>${escapeXml(payment.providerSignature)}</Signature>`,
            '        </ProvidersSignature>',
          ]
        : []),
      ...(payment.ecrSigningAuthor && payment.ecrSessionNumber
        ? [
            '        <ECRToken>',
            `          <SigningAuthor>${escapeXml(payment.ecrSigningAuthor)}</SigningAuthor>`,
            `          <SessionNumber>${escapeXml(payment.ecrSessionNumber)}</SessionNumber>`,
            '        </ECRToken>',
          ]
        : []),
      '      </paymentMethodDetails>',
    ]),
    '    </paymentMethods>',
  ];
}

function lineTaxDetails(line: InvoiceLine): string[] {
  return [
    ...(positive(line.withheldAmount)
      ? [
          `      <withheldAmount>${money(line.withheldAmount)}</withheldAmount>`,
          `      <withheldPercentCategory>${line.withheldCategory}</withheldPercentCategory>`,
        ]
      : []),
    ...(positive(line.stampDutyAmount)
      ? [
          `      <stampDutyAmount>${money(line.stampDutyAmount)}</stampDutyAmount>`,
          `      <stampDutyPercentCategory>${line.stampDutyCategory}</stampDutyPercentCategory>`,
        ]
      : []),
    ...(positive(line.feesAmount)
      ? [
          `      <feesAmount>${money(line.feesAmount)}</feesAmount>`,
          `      <feesPercentCategory>${line.feesCategory}</feesPercentCategory>`,
        ]
      : []),
    ...(positive(line.otherTaxesAmount)
      ? [
          `      <otherTaxesPercentCategory>${line.otherTaxesCategory}</otherTaxesPercentCategory>`,
          `      <otherTaxesAmount>${money(line.otherTaxesAmount)}</otherTaxesAmount>`,
        ]
      : []),
    ...(positive(line.deductionsAmount)
      ? [`      <deductionsAmount>${money(line.deductionsAmount)}</deductionsAmount>`]
      : []),
  ];
}

function summaryIncomeClassificationLines(document: MappableDocument): string[] {
  const classifications = new Map<string, { type: string; category: string; amount: number }>();
  for (const line of documentLines(document)) {
    const type = line.incomeClassificationType ?? 'E3_561_001';
    const category = line.incomeClassificationCategory ?? 'category1_1';
    const key = `${type}|${category}`;
    const current = classifications.get(key) ?? { type, category, amount: 0 };
    current.amount += Number(line.netAmount);
    classifications.set(key, current);
  }
  return [...classifications.values()].flatMap((classification) => [
    '      <incomeClassification>',
    `        <icls:classificationType>${escapeXml(classification.type)}</icls:classificationType>`,
    `        <icls:classificationCategory>${escapeXml(classification.category)}</icls:classificationCategory>`,
    `        <icls:amount>${classification.amount.toFixed(2)}</icls:amount>`,
    '      </incomeClassification>',
  ]);
}

function expenseClassificationLines(document: MappableDocument): string[] {
  return documentLines(document).flatMap((line) => {
    const vatCategory = mapVatCategory(line.vatCategory);
    const vatClassificationType =
      line.vatClassificationType ?? mapExpenseVatClassificationType(vatCategory);
    return [
      '    <invoicesExpensesClassificationDetails>',
      `      <lineNumber>${line.lineNumber}</lineNumber>`,
      '      <expensesClassificationDetailData>',
      `        <classificationType>${escapeXml(line.expenseClassificationType ?? 'E3_102_001')}</classificationType>`,
      `        <classificationCategory>${escapeXml(line.expenseClassificationCategory ?? 'category2_4')}</classificationCategory>`,
      `        <amount>${money(line.netAmount)}</amount>`,
      '        <id>1</id>',
      '      </expensesClassificationDetailData>',
      ...(vatClassificationType
        ? [
            '      <expensesClassificationDetailData>',
            `        <classificationType>${escapeXml(vatClassificationType)}</classificationType>`,
            `        <amount>${money(line.netAmount)}</amount>`,
            `        <vatAmount>${money(line.vatAmount)}</vatAmount>`,
            `        <vatCategory>${vatCategory}</vatCategory>`,
            ...(line.vatExemptionCategory
              ? [
                  `        <vatExemptionCategory>${line.vatExemptionCategory}</vatExemptionCategory>`,
                ]
              : []),
            '        <id>2</id>',
            '      </expensesClassificationDetailData>',
          ]
        : []),
      '    </invoicesExpensesClassificationDetails>',
    ];
  });
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

type InvoiceLine = {
  lineNumber: number;
  itemCode?: string | null;
  description?: string | null;
  quantity?: Prisma.Decimal | null;
  measurementUnit?: number | null;
  discountOption?: boolean | null;
  netAmount: Prisma.Decimal;
  vatAmount: Prisma.Decimal;
  vatCategory: string;
  vatExemptionCategory?: number | null;
  withheldAmount: Prisma.Decimal;
  withheldCategory?: number | null;
  feesAmount: Prisma.Decimal;
  feesCategory?: number | null;
  stampDutyAmount: Prisma.Decimal;
  stampDutyCategory?: number | null;
  otherTaxesAmount: Prisma.Decimal;
  otherTaxesCategory?: number | null;
  deductionsAmount: Prisma.Decimal;
  incomeClassificationType?: string | null;
  incomeClassificationCategory?: string | null;
  expenseClassificationType?: string | null;
  expenseClassificationCategory?: string | null;
  vatClassificationType?: string | null;
};

type PaymentLine = {
  paymentNumber: number;
  type: number;
  amount: Prisma.Decimal;
  paymentMethodInfo?: string | null;
  transactionId?: string | null;
  tid?: string | null;
  providerSigningAuthor?: string | null;
  providerSignature?: string | null;
  ecrSigningAuthor?: string | null;
  ecrSessionNumber?: string | null;
};

function documentPayments(document: MappableDocument): PaymentLine[] {
  if (document.payments?.length) {
    return document.payments;
  }
  return [
    {
      paymentNumber: 1,
      type: document.paymentMethodType,
      amount: document.totalAmount,
    },
  ];
}

function documentLines(document: MappableDocument): InvoiceLine[] {
  if (document.lines?.length) {
    return document.lines;
  }
  return [
    {
      lineNumber: 1,
      netAmount: document.netAmount,
      vatAmount: document.vatAmount,
      vatCategory: document.vatCategory,
      vatExemptionCategory: document.vatExemptionCategory,
      withheldAmount: document.withheldAmount,
      withheldCategory: document.withheldCategory,
      feesAmount: document.feesAmount,
      feesCategory: document.feesCategory,
      stampDutyAmount: document.stampDutyAmount,
      stampDutyCategory: document.stampDutyCategory,
      otherTaxesAmount: document.otherTaxesAmount,
      otherTaxesCategory: document.otherTaxesCategory,
      deductionsAmount: document.deductionsAmount,
    },
  ];
}

function taxesTotalsLines(document: MappableDocument): string[] {
  const populated = documentLines(document)
    .flatMap((line) => [
      {
        type: 1,
        category: line.withheldCategory,
        amount: line.withheldAmount,
        netAmount: line.netAmount,
      },
      { type: 2, category: line.feesCategory, amount: line.feesAmount, netAmount: line.netAmount },
      {
        type: 3,
        category: line.otherTaxesCategory,
        amount: line.otherTaxesAmount,
        netAmount: line.netAmount,
      },
      {
        type: 4,
        category: line.stampDutyCategory,
        amount: line.stampDutyAmount,
        netAmount: line.netAmount,
      },
      { type: 5, amount: line.deductionsAmount, netAmount: line.netAmount },
    ])
    .filter((tax) => tax.amount.greaterThan(0));

  if (populated.length === 0) {
    return [];
  }

  return [
    '    <taxesTotals>',
    ...populated.flatMap((tax, index) => [
      '      <taxes>',
      `        <taxType>${tax.type}</taxType>`,
      ...(tax.category ? [`        <taxCategory>${tax.category}</taxCategory>`] : []),
      `        <underlyingValue>${tax.netAmount.toFixed(2)}</underlyingValue>`,
      `        <taxAmount>${tax.amount.toFixed(2)}</taxAmount>`,
      `        <id>${index + 1}</id>`,
      '      </taxes>',
    ]),
    '    </taxesTotals>',
  ];
}

function money(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

function positive(value: Prisma.Decimal): boolean {
  return value.greaterThan(0);
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

function isGreekVatNumber(value: string | null | undefined): boolean {
  return /^\d{9}$/.test(value?.trim() ?? '');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function entityVatNumberLines(document: MappableDocument): string[] {
  if (document.clientCompany.myDataMode !== MyDataTransmissionMode.ACCOUNTING_OFFICE_AUTHORIZED) {
    return [];
  }

  return [`    <entityVatNumber>${escapeXml(document.clientCompany.vatNumber)}</entityVatNumber>`];
}
