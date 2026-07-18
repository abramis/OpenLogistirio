import {
  ClientEntityType,
  CounterpartyType,
  DeclarationWorkpaperStatus,
  DeclarationWorkpaperType,
  FixedAssetCategory,
  JournalEntrySource,
  JournalEntryStatus,
  MyDataTransmissionMode,
  ObligationRecurrence,
  ObligationType,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error(
      'Demo seed is disabled in production. Use the one-time production bootstrap command.',
    );
  }
  const passwordHash = await bcrypt.hash('ChangeMe123!', 10);

  const office = await prisma.accountingOffice.upsert({
    where: { id: 'office-athens-demo' },
    update: {},
    create: {
      id: 'office-athens-demo',
      name: 'Ανοιχτό Λογιστήριο Αθήνας',
      vatNumber: '123456789',
      email: 'office@example.gr',
      phone: '+302101234567',
      address: 'Σταδίου 10, Αθήνα',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@example.gr' },
    update: {},
    create: {
      accountingOfficeId: office.id,
      email: 'admin@example.gr',
      fullName: 'Μαρία Παπαδοπούλου',
      passwordHash,
      role: UserRole.ACCOUNTING_OFFICE_ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: 'accountant@example.gr' },
    update: {},
    create: {
      accountingOfficeId: office.id,
      email: 'accountant@example.gr',
      fullName: 'Νίκος Γεωργίου',
      passwordHash,
      role: UserRole.ACCOUNTANT,
    },
  });

  const firstCompany = await prisma.clientCompany.upsert({
    where: {
      accountingOfficeId_vatNumber: {
        accountingOfficeId: office.id,
        vatNumber: '111222333',
      },
    },
    update: {
      entityType: ClientEntityType.COMPANY,
      professionLabel: null,
      myDataMode: MyDataTransmissionMode.ACCOUNTING_OFFICE_AUTHORIZED,
      myDataAuthorized: true,
      myDataCredentialRef: null,
    },
    create: {
      accountingOfficeId: office.id,
      legalName: 'Ελληνική Εμπορική ΙΚΕ',
      tradeName: 'Hellenic Trade',
      entityType: ClientEntityType.COMPANY,
      vatNumber: '111222333',
      taxOffice: 'Α Αθηνών',
      activityCodes: ['46900000'],
      address: 'Πανεπιστημίου 20, Αθήνα',
      email: 'info@hellenic-trade.example',
      phone: '+302109876543',
      vatRegime: 'NORMAL',
      accountingCategory: 'SIMPLE_BOOKS',
      myDataMode: MyDataTransmissionMode.ACCOUNTING_OFFICE_AUTHORIZED,
      myDataAuthorized: true,
    },
  });

  const secondCompany = await prisma.clientCompany.upsert({
    where: {
      accountingOfficeId_vatNumber: {
        accountingOfficeId: office.id,
        vatNumber: '444555666',
      },
    },
    update: {
      entityType: ClientEntityType.SOLE_PROPRIETOR,
      professionLabel: 'Υπηρεσίες πληροφορικής',
      myDataMode: MyDataTransmissionMode.ACCOUNTING_OFFICE_AUTHORIZED,
      myDataAuthorized: false,
      myDataCredentialRef: null,
    },
    create: {
      accountingOfficeId: office.id,
      legalName: 'Θεσσαλονίκη Υπηρεσίες ΟΕ',
      tradeName: 'Thess Services',
      entityType: ClientEntityType.SOLE_PROPRIETOR,
      professionLabel: 'Υπηρεσίες πληροφορικής',
      vatNumber: '444555666',
      taxOffice: 'Δ Θεσσαλονίκης',
      activityCodes: ['62010000'],
      address: 'Τσιμισκή 5, Θεσσαλονίκη',
      email: 'hello@thess-services.example',
      phone: '+302310123456',
      vatRegime: 'NORMAL',
      accountingCategory: 'SIMPLE_BOOKS',
      myDataMode: MyDataTransmissionMode.ACCOUNTING_OFFICE_AUTHORIZED,
      myDataAuthorized: false,
    },
  });

  const firstDocument = await prisma.document.findFirst({
    where: {
      accountingOfficeId: office.id,
      clientCompanyId: firstCompany.id,
      series: 'Α',
      documentNumber: '1',
    },
  });

  if (!firstDocument) {
    await prisma.document.create({
      data: {
        accountingOfficeId: office.id,
        clientCompanyId: firstCompany.id,
        documentType: 'SALES_INVOICE',
        series: 'Α',
        documentNumber: '1',
        issueDate: new Date('2026-07-01T00:00:00.000Z'),
        counterpartyName: 'Demo Customer SA',
        counterpartyVatNumber: '999888777',
        netAmount: '1000.00',
        vatAmount: '240.00',
        totalAmount: '1240.00',
        vatCategory: 'VAT_24',
      },
    });
  }

  const secondDocument = await prisma.document.findFirst({
    where: {
      accountingOfficeId: office.id,
      clientCompanyId: secondCompany.id,
      series: 'Β',
      documentNumber: '15',
    },
  });

  if (!secondDocument) {
    await prisma.document.create({
      data: {
        accountingOfficeId: office.id,
        clientCompanyId: secondCompany.id,
        documentType: 'PURCHASE_INVOICE',
        series: 'Β',
        documentNumber: '15',
        issueDate: new Date('2026-07-03T00:00:00.000Z'),
        counterpartyName: 'Demo Supplier OE',
        counterpartyVatNumber: '222333444',
        netAmount: '350.00',
        vatAmount: '84.00',
        totalAmount: '434.00',
        vatCategory: 'VAT_24',
      },
    });
  }

  await prisma.fixedAsset.upsert({
    where: {
      clientCompanyId_code: {
        clientCompanyId: firstCompany.id,
        code: 'FA-2026-001',
      },
    },
    update: {},
    create: {
      accountingOfficeId: office.id,
      clientCompanyId: firstCompany.id,
      code: 'FA-2026-001',
      description: 'Laptop λογιστηρίου',
      category: FixedAssetCategory.EQUIPMENT,
      acquisitionDate: new Date('2026-07-02T00:00:00.000Z'),
      depreciationStartDate: new Date('2026-07-02T00:00:00.000Z'),
      acquisitionDocumentNumber: 'ΤΠΥ-105',
      supplierName: 'Demo Supplier OE',
      netValue: '1200.00',
      vatAmount: '288.00',
      totalValue: '1488.00',
      depreciationRate: '20.00',
    },
  });

  await prisma.officeObligation.upsert({
    where: {
      clientCompanyId_type_periodYear_periodMonth: {
        clientCompanyId: firstCompany.id,
        type: ObligationType.MYDATA_REVIEW,
        periodYear: 2026,
        periodMonth: 7,
      },
    },
    update: {},
    create: {
      accountingOfficeId: office.id,
      clientCompanyId: firstCompany.id,
      type: ObligationType.MYDATA_REVIEW,
      title: 'Έλεγχος myDATA 07/2026',
      periodYear: 2026,
      periodMonth: 7,
      dueDate: new Date('2026-08-20T00:00:00.000Z'),
      recurrence: ObligationRecurrence.MONTHLY,
    },
  });

  await prisma.officeObligation.upsert({
    where: {
      clientCompanyId_type_periodYear_periodMonth: {
        clientCompanyId: firstCompany.id,
        type: ObligationType.VAT_RETURN,
        periodYear: 2026,
        periodMonth: 9,
      },
    },
    update: {},
    create: {
      accountingOfficeId: office.id,
      clientCompanyId: firstCompany.id,
      type: ObligationType.VAT_RETURN,
      title: 'Περιοδική ΦΠΑ 09/2026',
      periodYear: 2026,
      periodMonth: 9,
      dueDate: new Date('2026-10-31T00:00:00.000Z'),
      recurrence: ObligationRecurrence.QUARTERLY,
    },
  });

  await prisma.counterparty.upsert({
    where: { id: 'counterparty-demo-customer' },
    update: {},
    create: {
      id: 'counterparty-demo-customer',
      accountingOfficeId: office.id,
      clientCompanyId: firstCompany.id,
      type: CounterpartyType.CUSTOMER,
      name: 'Demo Customer SA',
      vatNumber: '999888777',
      country: 'GR',
      email: 'accounting@customer.example',
      phone: '+302101110000',
    },
  });

  await prisma.counterparty.upsert({
    where: { id: 'counterparty-demo-supplier' },
    update: {},
    create: {
      id: 'counterparty-demo-supplier',
      accountingOfficeId: office.id,
      clientCompanyId: secondCompany.id,
      type: CounterpartyType.SUPPLIER,
      name: 'Demo Supplier OE',
      vatNumber: '222333444',
      country: 'GR',
      email: 'billing@supplier.example',
      phone: '+302310111000',
    },
  });

  await prisma.declarationWorkpaper.upsert({
    where: {
      clientCompanyId_type_periodYear_periodMonth: {
        clientCompanyId: firstCompany.id,
        type: DeclarationWorkpaperType.VAT_RETURN,
        periodYear: 2026,
        periodMonth: 7,
      },
    },
    update: {},
    create: {
      accountingOfficeId: office.id,
      clientCompanyId: firstCompany.id,
      type: DeclarationWorkpaperType.VAT_RETURN,
      title: 'Workpaper ΦΠΑ 07/2026',
      periodYear: 2026,
      periodMonth: 7,
      status: DeclarationWorkpaperStatus.DRAFT,
      totals: {
        salesNet: 1000,
        salesVat: 240,
        purchasesNet: 0,
        purchasesVat: 0,
        payableVat: 240,
        documentCount: 1,
        failedMyData: 0,
      },
    },
  });

  await seedDefaultAccounting(firstCompany.id, office.id);
  await seedDefaultAccounting(secondCompany.id, office.id);

  console.log('Seeded demo accounting office, users, client companies, and documents.');
}

async function seedDefaultAccounting(clientCompanyId: string, accountingOfficeId: string) {
  const accounts = [
    ['10.00', 'Ταμείο', 'ASSET', 'DEBIT'],
    ['12.00', 'Πάγια στοιχεία', 'ASSET', 'DEBIT'],
    ['12.99', 'Συσσωρευμένες αποσβέσεις παγίων', 'ASSET', 'CREDIT'],
    ['20.00', 'Αγορές και έξοδα', 'EXPENSE', 'DEBIT'],
    ['30.00', 'Πελάτες', 'ASSET', 'DEBIT'],
    ['40.00', 'Κεφάλαιο / καθαρή θέση', 'EQUITY', 'CREDIT'],
    ['50.00', 'Προμηθευτές', 'LIABILITY', 'CREDIT'],
    ['54.00', 'ΦΠΑ εκροών', 'LIABILITY', 'CREDIT'],
    ['54.01', 'ΦΠΑ εισροών', 'ASSET', 'DEBIT'],
    ['66.00', 'Αποσβέσεις χρήσης', 'EXPENSE', 'DEBIT'],
    ['70.00', 'Έσοδα πωλήσεων', 'REVENUE', 'CREDIT'],
  ] as const;

  for (const [code, name, type, normalBalance] of accounts) {
    await prisma.chartAccount.upsert({
      where: { clientCompanyId_code: { clientCompanyId, code } },
      update: { name, type, normalBalance, isActive: true },
      create: {
        accountingOfficeId,
        clientCompanyId,
        code,
        name,
        type,
        normalBalance,
      },
    });
  }

  const postingRules = [
    [
      'SALE_INVOICE',
      'Τιμολόγιο πώλησης',
      'SALES_INVOICE',
      'SALE_INVOICE',
      'SALES',
      '30.00',
      'DEBIT',
      '70.00',
      'CREDIT',
      '54.00',
      'CREDIT',
    ],
    [
      'RETAIL_RECEIPT',
      'Απόδειξη λιανικής',
      'RETAIL_RECEIPT',
      'SALE_INVOICE',
      'SALES',
      '10.00',
      'DEBIT',
      '70.00',
      'CREDIT',
      '54.00',
      'CREDIT',
    ],
    [
      'PURCHASE_INVOICE',
      'Τιμολόγιο αγοράς/δαπάνης',
      'PURCHASE_INVOICE',
      'PURCHASE_INVOICE',
      'PURCHASES',
      '50.00',
      'CREDIT',
      '20.00',
      'DEBIT',
      '54.01',
      'DEBIT',
    ],
    [
      'CREDIT_NOTE',
      'Πιστωτικό πώλησης',
      'CREDIT_NOTE',
      'CREDIT_NOTE',
      'SALES',
      '30.00',
      'CREDIT',
      '70.00',
      'DEBIT',
      '54.00',
      'DEBIT',
    ],
  ] as const;

  for (const [
    code,
    name,
    documentType,
    movementCode,
    journalCode,
    counterpartyAccountCode,
    counterpartySide,
    netAccountCode,
    netSide,
    vatAccountCode,
    vatSide,
  ] of postingRules) {
    await prisma.documentPostingRule.upsert({
      where: { clientCompanyId_code: { clientCompanyId, code } },
      update: {
        name,
        documentType,
        movementCode,
        journalCode,
        counterpartyAccountCode,
        counterpartySide,
        netAccountCode,
        netSide,
        vatAccountCode,
        vatSide,
        isActive: true,
      },
      create: {
        accountingOfficeId,
        clientCompanyId,
        code,
        name,
        documentType,
        movementCode,
        journalCode,
        counterpartyAccountCode,
        counterpartySide,
        netAccountCode,
        netSide,
        vatAccountCode,
        vatSide,
      },
    });
  }

  for (let month = 1; month <= 12; month += 1) {
    await prisma.accountingPeriod.upsert({
      where: {
        clientCompanyId_fiscalYear_periodMonth: {
          clientCompanyId,
          fiscalYear: 2026,
          periodMonth: month,
        },
      },
      update: {},
      create: {
        accountingOfficeId,
        clientCompanyId,
        fiscalYear: 2026,
        periodMonth: month,
        startsAt: new Date(Date.UTC(2026, month - 1, 1)),
        endsAt: new Date(Date.UTC(2026, month, 0, 23, 59, 59, 999)),
      },
    });
  }

  const existingOpening = await prisma.journalEntry.findFirst({
    where: {
      clientCompanyId,
      entryNumber: 'OPEN-2026-00001',
    },
  });

  if (!existingOpening) {
    const cash = await prisma.chartAccount.findUniqueOrThrow({
      where: { clientCompanyId_code: { clientCompanyId, code: '10.00' } },
    });
    const equity = await prisma.chartAccount.findUniqueOrThrow({
      where: { clientCompanyId_code: { clientCompanyId, code: '40.00' } },
    });

    await prisma.journalEntry.create({
      data: {
        accountingOfficeId,
        clientCompanyId,
        entryNumber: 'OPEN-2026-00001',
        entryDate: new Date('2026-01-01T00:00:00.000Z'),
        fiscalYear: 2026,
        periodMonth: 1,
        source: JournalEntrySource.OPENING,
        status: JournalEntryStatus.POSTED,
        description: 'Δοκιμαστική εγγραφή ανοίγματος',
        postedAt: new Date(),
        lines: {
          create: [
            {
              accountId: cash.id,
              lineNumber: 1,
              description: 'Ταμειακό υπόλοιπο έναρξης',
              debit: '1000.00',
            },
            {
              accountId: equity.id,
              lineNumber: 2,
              description: 'Κεφάλαιο έναρξης',
              credit: '1000.00',
            },
          ],
        },
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
