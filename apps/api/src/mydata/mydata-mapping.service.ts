import { BadRequestException, Injectable } from '@nestjs/common';
import { DocumentType, Prisma } from '@prisma/client';

type DocumentWithCompany = Prisma.DocumentGetPayload<{
  include: {
    clientCompany: true;
  };
}>;

@Injectable()
export class MyDataMappingService {
  // Based on the official AADE myDATA ERP REST API technical description v2.0.2
  // (June 2026) and its SendInvoices/InvoiccesDoc flow. Before production use,
  // re-check the latest official AADE myDATA ERP technical specifications, XSDs,
  // authentication rules, and test environment. Never store TAXISnet passwords.
  mapDocumentToXml(document: DocumentWithCompany): string {
    return this.mapDocumentToAadeInvoicesDocXml(document);
  }

  mapDocumentToAadeInvoicesDocXml(document: DocumentWithCompany): string {
    const invoiceType = mapDocumentTypeToAadeInvoiceType(document.documentType);
    const vatCategory = mapVatCategory(document.vatCategory);
    const netAmount = document.netAmount.toFixed(2);
    const vatAmount = document.vatAmount.toFixed(2);
    const totalAmount = document.totalAmount.toFixed(2);

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<InvoicesDoc xmlns="http://www.aade.gr/myDATA/invoice/v1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
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
      '    </invoiceHeader>',
      '    <paymentMethods>',
      '      <paymentMethodDetails>',
      '        <type>3</type>',
      `        <amount>${totalAmount}</amount>`,
      '      </paymentMethodDetails>',
      '    </paymentMethods>',
      '    <invoiceDetails>',
      '      <lineNumber>1</lineNumber>',
      `      <netValue>${netAmount}</netValue>`,
      `      <vatCategory>${vatCategory}</vatCategory>`,
      `      <vatAmount>${vatAmount}</vatAmount>`,
      '      <incomeClassification>',
      '        <classificationType>E3_561_001</classificationType>',
      '        <classificationCategory>category1_1</classificationCategory>',
      `        <amount>${netAmount}</amount>`,
      '      </incomeClassification>',
      '    </invoiceDetails>',
      '    <invoiceSummary>',
      `      <totalNetValue>${netAmount}</totalNetValue>`,
      `      <totalVatAmount>${vatAmount}</totalVatAmount>`,
      '      <totalWithheldAmount>0.00</totalWithheldAmount>',
      '      <totalFeesAmount>0.00</totalFeesAmount>',
      '      <totalStampDutyAmount>0.00</totalStampDutyAmount>',
      '      <totalOtherTaxesAmount>0.00</totalOtherTaxesAmount>',
      '      <totalDeductionsAmount>0.00</totalDeductionsAmount>',
      `      <totalGrossValue>${totalAmount}</totalGrossValue>`,
      '      <incomeClassification>',
      '        <classificationType>E3_561_001</classificationType>',
      '        <classificationCategory>category1_1</classificationCategory>',
      `        <amount>${netAmount}</amount>`,
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
    const totalAmount = document.totalAmount.toFixed(2);

    // TODO: Before production use, map this to the latest official AADE myDATA
    // receiver/expense classification API and XSD. This MVP stores a clean XML
    // preview so accountants can validate the intended expense classification.
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<ExpenseClassificationPreview xmlns="https://openlogistirio.local/mydata/expense-preview/v1">',
      '  <receiver>',
      `    <vatNumber>${escapeXml(document.clientCompany.vatNumber)}</vatNumber>`,
      '    <country>GR</country>',
      `    <name>${escapeXml(document.clientCompany.legalName)}</name>`,
      '  </receiver>',
      '  <issuer>',
      `    <vatNumber>${escapeXml(document.counterpartyVatNumber ?? '000000000')}</vatNumber>`,
      '    <country>GR</country>',
      `    <name>${escapeXml(document.counterpartyName ?? 'Unknown Supplier')}</name>`,
      '  </issuer>',
      '  <document>',
      `    <series>${escapeXml(document.series ?? '')}</series>`,
      `    <number>${escapeXml(document.documentNumber)}</number>`,
      `    <issueDate>${document.issueDate.toISOString().slice(0, 10)}</issueDate>`,
      `    <netValue>${netAmount}</netValue>`,
      `    <vatAmount>${vatAmount}</vatAmount>`,
      `    <grossValue>${totalAmount}</grossValue>`,
      '  </document>',
      '  <expenseClassification>',
      '    <classificationType>E3_102_001</classificationType>',
      '    <classificationCategory>category2_4</classificationCategory>',
      `    <amount>${netAmount}</amount>`,
      '  </expenseClassification>',
      '</ExpenseClassificationPreview>',
    ].join('\n');
  }
}

function mapDocumentTypeToAadeInvoiceType(documentType: DocumentType): string {
  if (documentType === DocumentType.SALES_INVOICE) {
    return '1.1';
  }

  if (documentType === DocumentType.CREDIT_NOTE) {
    return '5.1';
  }

  if (documentType === DocumentType.RETAIL_RECEIPT) {
    return '11.1';
  }

  throw new BadRequestException(
    'AADE SendInvoices is only for issued sales documents. Purchase invoices require the expenses/receiver myDATA flow, which is not implemented yet.',
  );
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
