CREATE TABLE `DocumentPostingRule` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(80) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `documentType` ENUM('SALES_INVOICE', 'PURCHASE_INVOICE', 'CREDIT_NOTE', 'RETAIL_RECEIPT') NULL,
  `movementCode` VARCHAR(80) NULL,
  `journalCode` VARCHAR(80) NULL,
  `counterpartyAccountCode` VARCHAR(40) NOT NULL,
  `counterpartySide` ENUM('DEBIT', 'CREDIT') NOT NULL,
  `netAccountCode` VARCHAR(40) NOT NULL,
  `netSide` ENUM('DEBIT', 'CREDIT') NOT NULL,
  `vatAccountCode` VARCHAR(40) NULL,
  `vatSide` ENUM('DEBIT', 'CREDIT') NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `DocPostingRule_client_code_key` (`clientCompanyId`, `code`),
  INDEX `DocPostingRule_office_client_active_idx` (`accountingOfficeId`, `clientCompanyId`, `isActive`),
  INDEX `DocPostingRule_client_movement_idx` (`clientCompanyId`, `movementCode`),
  INDEX `DocPostingRule_client_doc_type_idx` (`clientCompanyId`, `documentType`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `FixedAssetDepreciationAccountingLink` (
  `id` VARCHAR(191) NOT NULL,
  `depreciationEntryId` VARCHAR(191) NOT NULL,
  `journalEntryId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `DepAcctLink_depreciation_key` (`depreciationEntryId`),
  UNIQUE INDEX `DepAcctLink_journal_key` (`journalEntryId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DocumentPostingRule`
  ADD CONSTRAINT `DocPostingRule_office_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `DocumentPostingRule`
  ADD CONSTRAINT `DocPostingRule_client_fkey`
  FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `FixedAssetDepreciationAccountingLink`
  ADD CONSTRAINT `DepAcctLink_depreciation_fkey`
  FOREIGN KEY (`depreciationEntryId`) REFERENCES `FixedAssetDepreciationEntry`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `FixedAssetDepreciationAccountingLink`
  ADD CONSTRAINT `DepAcctLink_journal_fkey`
  FOREIGN KEY (`journalEntryId`) REFERENCES `JournalEntry`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
