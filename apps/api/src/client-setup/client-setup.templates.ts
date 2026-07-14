export interface ClientSetupTemplateItem {
  kind: string;
  code: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface ClientSetupTemplate {
  id: string;
  name: string;
  description: string;
  recommendedFor: string[];
  items: ClientSetupTemplateItem[];
}

export const CLIENT_SETUP_KIND_LABELS: Record<string, string> = {
  BOOK_SYSTEM: 'Σύστημα βιβλίων',
  ACCOUNTING_PLAN: 'Λογιστικό σχέδιο',
  ACCOUNT_TYPE: 'Είδη λογαριασμών',
  MOVEMENT_CODE: 'Κωδικοί κίνησης',
  JOURNAL: 'Ημερολόγια',
  POSTING_RULE: 'Κανόνες λογιστικής άρθρωσης',
  VAT_SETUP: 'ΦΠΑ',
  FIXED_ASSET_CATEGORY: 'Κατηγορίες παγίων',
  DEPRECIATION_RULE: 'Κανόνες απόσβεσης',
  TAX_ADJUSTMENT: 'Δαπάνες αναμόρφωσης',
  INTRASTAT: 'Intrastat',
  MYDATA_CLASSIFICATION_PROFILE: 'Προφίλ χαρακτηρισμών myDATA',
};

const commonItems: ClientSetupTemplateItem[] = [
  {
    kind: 'ACCOUNT_TYPE',
    code: 'CUSTOMERS',
    name: 'Πελάτες',
    description: 'Βασική κατηγορία συναλλασσομένων πελατών.',
  },
  {
    kind: 'ACCOUNT_TYPE',
    code: 'SUPPLIERS',
    name: 'Προμηθευτές',
    description: 'Βασική κατηγορία συναλλασσομένων προμηθευτών.',
  },
  {
    kind: 'MOVEMENT_CODE',
    code: 'SALE_INVOICE',
    name: 'Τιμολόγιο πώλησης',
    metadata: { documentType: 'SALES_INVOICE', affectsVatBook: true },
  },
  {
    kind: 'MOVEMENT_CODE',
    code: 'PURCHASE_INVOICE',
    name: 'Τιμολόγιο αγοράς/δαπάνης',
    metadata: { documentType: 'PURCHASE_INVOICE', affectsVatBook: true },
  },
  {
    kind: 'MOVEMENT_CODE',
    code: 'CREDIT_NOTE',
    name: 'Πιστωτικό τιμολόγιο',
    metadata: { documentType: 'CREDIT_NOTE', affectsVatBook: true },
  },
  {
    kind: 'JOURNAL',
    code: 'SALES',
    name: 'Ημερολόγιο πωλήσεων',
  },
  {
    kind: 'JOURNAL',
    code: 'PURCHASES',
    name: 'Ημερολόγιο αγορών/δαπανών',
  },
  {
    kind: 'JOURNAL',
    code: 'CASH_BANK',
    name: 'Ημερολόγιο ταμείου και τραπεζών',
  },
  {
    kind: 'POSTING_RULE',
    code: 'SALE_INVOICE',
    name: 'Άρθρωση τιμολογίου πώλησης',
    metadata: {
      movementCode: 'SALE_INVOICE',
      counterpartyAccountCode: '30.00',
      netAccountCode: '70.00',
      vatAccountCode: '54.00',
    },
  },
  {
    kind: 'POSTING_RULE',
    code: 'PURCHASE_INVOICE',
    name: 'Άρθρωση τιμολογίου αγοράς/δαπάνης',
    metadata: {
      movementCode: 'PURCHASE_INVOICE',
      counterpartyAccountCode: '50.00',
      netAccountCode: '20.00',
      vatAccountCode: '54.01',
    },
  },
  {
    kind: 'POSTING_RULE',
    code: 'CREDIT_NOTE',
    name: 'Άρθρωση πιστωτικού πώλησης',
    metadata: {
      movementCode: 'CREDIT_NOTE',
      counterpartyAccountCode: '30.00',
      netAccountCode: '70.00',
      vatAccountCode: '54.00',
    },
  },
  {
    kind: 'VAT_SETUP',
    code: 'VAT_NORMAL_24',
    name: 'Κανονικός συντελεστής ΦΠΑ 24%',
    metadata: { rate: 24 },
  },
  {
    kind: 'MYDATA_CLASSIFICATION_PROFILE',
    code: 'INCOME_SALES_DEFAULT',
    name: 'Προεπιλεγμένα έσοδα πωλήσεων',
    description: 'Χρησιμοποιείται όταν η γραμμή δεν έχει ρητό χαρακτηρισμό εσόδου.',
    metadata: {
      documentType: 'SALES_INVOICE',
      incomeClassificationType: 'E3_561_001',
      incomeClassificationCategory: 'category1_1',
      priority: 0,
      isActive: true,
    },
  },
  {
    kind: 'MYDATA_CLASSIFICATION_PROFILE',
    code: 'EXPENSE_PURCHASE_DEFAULT',
    name: 'Προεπιλεγμένα έξοδα αγορών',
    description: 'Χρησιμοποιείται όταν η γραμμή δεν έχει ρητό χαρακτηρισμό εξόδου.',
    metadata: {
      documentType: 'PURCHASE_INVOICE',
      expenseClassificationType: 'E3_102_001',
      expenseClassificationCategory: 'category2_4',
      priority: 0,
      isActive: true,
    },
  },
  ...[
    ['VAT_24', 'VAT_361'],
    ['VAT_13', 'VAT_362'],
    ['VAT_6', 'VAT_363'],
    ['VAT_17', 'VAT_364'],
    ['VAT_9', 'VAT_365'],
    ['VAT_4', 'VAT_366'],
  ].map(([vatCategory, vatClassificationType]) => ({
    kind: 'MYDATA_CLASSIFICATION_PROFILE',
    code: `EXPENSE_${vatCategory}`,
    name: `Χαρακτηρισμός ΦΠΑ εξόδων ${vatCategory.replace('VAT_', '')}%`,
    metadata: {
      documentType: 'PURCHASE_INVOICE',
      vatCategory,
      vatClassificationType,
      priority: 10,
      isActive: true,
    },
  })),
  {
    kind: 'VAT_SETUP',
    code: 'VAT_REDUCED_13',
    name: 'Μειωμένος συντελεστής ΦΠΑ 13%',
    metadata: { rate: 13 },
  },
  {
    kind: 'VAT_SETUP',
    code: 'VAT_SUPER_REDUCED_6',
    name: 'Υπερμειωμένος συντελεστής ΦΠΑ 6%',
    metadata: { rate: 6 },
  },
  {
    kind: 'FIXED_ASSET_CATEGORY',
    code: 'EQUIPMENT',
    name: 'Εξοπλισμός',
    metadata: { fixedAssetCategory: 'EQUIPMENT', defaultDepreciationRate: 10 },
  },
  {
    kind: 'FIXED_ASSET_CATEGORY',
    code: 'SOFTWARE',
    name: 'Λογισμικό',
    metadata: { fixedAssetCategory: 'SOFTWARE', defaultDepreciationRate: 20 },
  },
  {
    kind: 'FIXED_ASSET_CATEGORY',
    code: 'VEHICLE',
    name: 'Οχήματα',
    metadata: { fixedAssetCategory: 'VEHICLE', defaultDepreciationRate: 16 },
  },
  {
    kind: 'DEPRECIATION_RULE',
    code: 'EQUIPMENT_10',
    name: 'Απόσβεση εξοπλισμού 10%',
    description: 'Προτεινόμενος κανόνας, χρειάζεται έλεγχο πριν από παραγωγική χρήση.',
    metadata: { fixedAssetCategory: 'EQUIPMENT', rate: 10 },
  },
  {
    kind: 'DEPRECIATION_RULE',
    code: 'SOFTWARE_20',
    name: 'Απόσβεση λογισμικού 20%',
    description: 'Προτεινόμενος κανόνας, χρειάζεται έλεγχο πριν από παραγωγική χρήση.',
    metadata: { fixedAssetCategory: 'SOFTWARE', rate: 20 },
  },
  {
    kind: 'TAX_ADJUSTMENT',
    code: 'NON_DEDUCTIBLE_EXPENSES',
    name: 'Μη εκπιπτόμενες δαπάνες',
  },
  {
    kind: 'INTRASTAT',
    code: 'INTRASTAT_NOMENCLATURE_PLACEHOLDER',
    name: 'Ονοματολογία Intrastat',
    description: 'Θέση για μελλοντική φόρτωση πλήρους ονοματολογίας.',
  },
];

export const CLIENT_SETUP_TEMPLATES: ClientSetupTemplate[] = [
  {
    id: 'SIMPLE_BOOKS_ELP',
    name: 'Απλογραφικά - ΕΛΠ',
    description: 'Βασική παραμετροποίηση για ατομικές επιχειρήσεις και μικρές εταιρείες.',
    recommendedFor: ['FREELANCER', 'SOLE_PROPRIETOR', 'COMPANY'],
    items: [
      {
        kind: 'BOOK_SYSTEM',
        code: 'SIMPLE_BOOKS',
        name: 'Απλογραφικά βιβλία',
      },
      {
        kind: 'ACCOUNTING_PLAN',
        code: 'ELP_SIMPLE',
        name: 'Πρότυπο λογιστικό σχέδιο απλογραφικών',
        description: 'Προετοιμασία για μελλοντική γενική λογιστική.',
      },
      ...commonItems,
    ],
  },
  {
    id: 'DOUBLE_ENTRY_ELP',
    name: 'Διπλογραφικά - ΕΛΠ',
    description: 'Βασική παραμετροποίηση για εταιρείες με διπλογραφικά βιβλία.',
    recommendedFor: ['COMPANY', 'NON_PROFIT'],
    items: [
      {
        kind: 'BOOK_SYSTEM',
        code: 'DOUBLE_ENTRY',
        name: 'Διπλογραφικά βιβλία',
      },
      {
        kind: 'ACCOUNTING_PLAN',
        code: 'ELP_DOUBLE_ENTRY',
        name: 'Πρότυπο λογιστικό σχέδιο διπλογραφικών',
        description: 'Προετοιμασία για μελλοντική γενική λογιστική.',
      },
      {
        kind: 'JOURNAL',
        code: 'GENERAL',
        name: 'Γενικό ημερολόγιο',
      },
      ...commonItems,
    ],
  },
];
