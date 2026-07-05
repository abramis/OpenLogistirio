CREATE TABLE `Counterparty` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `type` ENUM('CUSTOMER', 'SUPPLIER', 'BOTH') NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `vatNumber` VARCHAR(20) NULL,
  `country` VARCHAR(2) NOT NULL DEFAULT 'GR',
  `taxOffice` VARCHAR(191) NULL,
  `address` VARCHAR(191) NULL,
  `email` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `notes` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  INDEX `Counterparty_accountingOfficeId_clientCompanyId_type_idx` (`accountingOfficeId`, `clientCompanyId`, `type`),
  INDEX `Counterparty_clientCompanyId_vatNumber_idx` (`clientCompanyId`, `vatNumber`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ImportBatch` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `type` ENUM('DOCUMENTS_CSV') NOT NULL,
  `status` ENUM('PREVIEW', 'COMPLETED', 'FAILED') NOT NULL,
  `fileName` VARCHAR(191) NULL,
  `totalRows` INTEGER NOT NULL DEFAULT 0,
  `successfulRows` INTEGER NOT NULL DEFAULT 0,
  `failedRows` INTEGER NOT NULL DEFAULT 0,
  `errorReport` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ImportBatch_accountingOfficeId_createdAt_idx` (`accountingOfficeId`, `createdAt`),
  INDEX `ImportBatch_clientCompanyId_createdAt_idx` (`clientCompanyId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DeclarationWorkpaper` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `type` ENUM('VAT_RETURN', 'MYDATA_RECONCILIATION', 'WITHHOLDING_TAX', 'INCOME_TAX_PREP', 'PAYROLL_REVIEW') NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `periodYear` INTEGER NOT NULL,
  `periodMonth` INTEGER NULL,
  `status` ENUM('DRAFT', 'READY', 'SUBMITTED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `totals` JSON NOT NULL,
  `notes` VARCHAR(191) NULL,
  `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `submittedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `DeclWorkpaper_period_key` (`clientCompanyId`, `type`, `periodYear`, `periodMonth`),
  INDEX `DeclWorkpaper_office_type_status_idx` (`accountingOfficeId`, `type`, `status`),
  INDEX `DeclWorkpaper_client_period_idx` (`clientCompanyId`, `periodYear`, `periodMonth`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Counterparty`
  ADD CONSTRAINT `Counterparty_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Counterparty`
  ADD CONSTRAINT `Counterparty_clientCompanyId_fkey`
  FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ImportBatch`
  ADD CONSTRAINT `ImportBatch_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ImportBatch`
  ADD CONSTRAINT `ImportBatch_clientCompanyId_fkey`
  FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `DeclarationWorkpaper`
  ADD CONSTRAINT `DeclarationWorkpaper_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `DeclarationWorkpaper`
  ADD CONSTRAINT `DeclarationWorkpaper_clientCompanyId_fkey`
  FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
