CREATE TABLE `ChartAccount` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(40) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `type` ENUM('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE') NOT NULL,
  `normalBalance` ENUM('DEBIT', 'CREDIT') NOT NULL,
  `parentId` VARCHAR(191) NULL,
  `isControl` BOOLEAN NOT NULL DEFAULT false,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `taxCategory` VARCHAR(80) NULL,
  `myDataCategory` VARCHAR(80) NULL,
  `notes` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ChartAccount_clientCompanyId_code_key` (`clientCompanyId`, `code`),
  INDEX `ChartAccount_accountingOfficeId_clientCompanyId_type_idx` (`accountingOfficeId`, `clientCompanyId`, `type`),
  INDEX `ChartAccount_parentId_idx` (`parentId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AccountingPeriod` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `fiscalYear` INTEGER NOT NULL,
  `periodMonth` INTEGER NOT NULL,
  `startsAt` DATETIME(3) NOT NULL,
  `endsAt` DATETIME(3) NOT NULL,
  `status` ENUM('OPEN', 'CLOSED', 'LOCKED') NOT NULL DEFAULT 'OPEN',
  `closedAt` DATETIME(3) NULL,
  `lockedAt` DATETIME(3) NULL,
  `notes` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `AccountingPeriod_clientCompanyId_fiscalYear_periodMonth_key` (`clientCompanyId`, `fiscalYear`, `periodMonth`),
  INDEX `AccountingPeriod_accountingOfficeId_clientCompanyId_status_idx` (`accountingOfficeId`, `clientCompanyId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `JournalEntry` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `entryNumber` VARCHAR(80) NOT NULL,
  `entryDate` DATETIME(3) NOT NULL,
  `fiscalYear` INTEGER NOT NULL,
  `periodMonth` INTEGER NOT NULL,
  `source` ENUM('MANUAL', 'DOCUMENT', 'FIXED_ASSET', 'OPENING', 'CLOSING', 'ADJUSTMENT') NOT NULL,
  `status` ENUM('DRAFT', 'POSTED', 'VOID') NOT NULL DEFAULT 'POSTED',
  `description` VARCHAR(191) NOT NULL,
  `reference` VARCHAR(191) NULL,
  `postedAt` DATETIME(3) NULL,
  `voidedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `JournalEntry_clientCompanyId_entryNumber_key` (`clientCompanyId`, `entryNumber`),
  INDEX `JournalEntry_accountingOfficeId_clientCompanyId_entryDate_idx` (`accountingOfficeId`, `clientCompanyId`, `entryDate`),
  INDEX `JournalEntry_clientCompanyId_fiscalYear_periodMonth_status_idx` (`clientCompanyId`, `fiscalYear`, `periodMonth`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `JournalEntryLine` (
  `id` VARCHAR(191) NOT NULL,
  `journalEntryId` VARCHAR(191) NOT NULL,
  `accountId` VARCHAR(191) NOT NULL,
  `lineNumber` INTEGER NOT NULL,
  `description` VARCHAR(191) NULL,
  `debit` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `credit` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `taxCode` VARCHAR(40) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `JournalEntryLine_journalEntryId_lineNumber_key` (`journalEntryId`, `lineNumber`),
  INDEX `JournalEntryLine_accountId_idx` (`accountId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DocumentAccountingLink` (
  `id` VARCHAR(191) NOT NULL,
  `documentId` VARCHAR(191) NOT NULL,
  `journalEntryId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `DocumentAccountingLink_documentId_key` (`documentId`),
  UNIQUE INDEX `DocumentAccountingLink_journalEntryId_key` (`journalEntryId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ChartAccount`
  ADD CONSTRAINT `ChartAccount_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ChartAccount`
  ADD CONSTRAINT `ChartAccount_clientCompanyId_fkey`
  FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ChartAccount`
  ADD CONSTRAINT `ChartAccount_parentId_fkey`
  FOREIGN KEY (`parentId`) REFERENCES `ChartAccount`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `AccountingPeriod`
  ADD CONSTRAINT `AccountingPeriod_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `AccountingPeriod`
  ADD CONSTRAINT `AccountingPeriod_clientCompanyId_fkey`
  FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `JournalEntry`
  ADD CONSTRAINT `JournalEntry_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `JournalEntry`
  ADD CONSTRAINT `JournalEntry_clientCompanyId_fkey`
  FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `JournalEntryLine`
  ADD CONSTRAINT `JournalEntryLine_journalEntryId_fkey`
  FOREIGN KEY (`journalEntryId`) REFERENCES `JournalEntry`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `JournalEntryLine`
  ADD CONSTRAINT `JournalEntryLine_accountId_fkey`
  FOREIGN KEY (`accountId`) REFERENCES `ChartAccount`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `DocumentAccountingLink`
  ADD CONSTRAINT `DocumentAccountingLink_documentId_fkey`
  FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `DocumentAccountingLink`
  ADD CONSTRAINT `DocumentAccountingLink_journalEntryId_fkey`
  FOREIGN KEY (`journalEntryId`) REFERENCES `JournalEntry`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
