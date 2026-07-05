CREATE TABLE `FixedAsset` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NOT NULL,
  `category` ENUM('EQUIPMENT', 'SOFTWARE', 'VEHICLE', 'FURNITURE', 'BUILDING', 'OTHER') NOT NULL DEFAULT 'OTHER',
  `acquisitionDate` DATETIME(3) NOT NULL,
  `depreciationStartDate` DATETIME(3) NOT NULL,
  `acquisitionDocumentNumber` VARCHAR(191) NULL,
  `supplierName` VARCHAR(191) NULL,
  `netValue` DECIMAL(12, 2) NOT NULL,
  `vatAmount` DECIMAL(12, 2) NOT NULL,
  `totalValue` DECIMAL(12, 2) NOT NULL,
  `depreciationRate` DECIMAL(5, 2) NOT NULL,
  `accumulatedDepreciation` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `status` ENUM('ACTIVE', 'SOLD', 'SCRAPPED') NOT NULL DEFAULT 'ACTIVE',
  `disposalDate` DATETIME(3) NULL,
  `notes` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `FixedAsset_clientCompanyId_code_key` (`clientCompanyId`, `code`),
  INDEX `FixedAsset_accountingOfficeId_clientCompanyId_status_idx` (`accountingOfficeId`, `clientCompanyId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `FixedAssetDepreciationEntry` (
  `id` VARCHAR(191) NOT NULL,
  `fixedAssetId` VARCHAR(191) NOT NULL,
  `fiscalYear` INTEGER NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `accumulatedAmount` DECIMAL(12, 2) NOT NULL,
  `bookValueAfter` DECIMAL(12, 2) NOT NULL,
  `posted` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `FixedAssetDepreciationEntry_fixedAssetId_fiscalYear_key` (`fixedAssetId`, `fiscalYear`),
  INDEX `FixedAssetDepreciationEntry_fixedAssetId_fiscalYear_idx` (`fixedAssetId`, `fiscalYear`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OfficeObligation` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `assignedUserId` VARCHAR(191) NULL,
  `type` ENUM('VAT_RETURN', 'MYDATA_REVIEW', 'WITHHOLDING_TAX', 'INCOME_TAX_PREP', 'PAYROLL_REVIEW', 'CUSTOM') NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `periodYear` INTEGER NOT NULL,
  `periodMonth` INTEGER NULL,
  `dueDate` DATETIME(3) NOT NULL,
  `status` ENUM('OPEN', 'IN_PROGRESS', 'WAITING_CLIENT', 'READY_TO_SUBMIT', 'SUBMITTED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
  `recurrence` ENUM('NONE', 'MONTHLY', 'QUARTERLY', 'ANNUAL') NOT NULL DEFAULT 'NONE',
  `notes` VARCHAR(191) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `OfficeObligation_clientCompanyId_type_periodYear_periodMonth_key` (`clientCompanyId`, `type`, `periodYear`, `periodMonth`),
  INDEX `OfficeObligation_accountingOfficeId_status_dueDate_idx` (`accountingOfficeId`, `status`, `dueDate`),
  INDEX `OfficeObligation_clientCompanyId_dueDate_idx` (`clientCompanyId`, `dueDate`),
  INDEX `OfficeObligation_assignedUserId_idx` (`assignedUserId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `FixedAsset`
  ADD CONSTRAINT `FixedAsset_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `FixedAsset`
  ADD CONSTRAINT `FixedAsset_clientCompanyId_fkey`
  FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `FixedAssetDepreciationEntry`
  ADD CONSTRAINT `FixedAssetDepreciationEntry_fixedAssetId_fkey`
  FOREIGN KEY (`fixedAssetId`) REFERENCES `FixedAsset`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `OfficeObligation`
  ADD CONSTRAINT `OfficeObligation_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `OfficeObligation`
  ADD CONSTRAINT `OfficeObligation_clientCompanyId_fkey`
  FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `OfficeObligation`
  ADD CONSTRAINT `OfficeObligation_assignedUserId_fkey`
  FOREIGN KEY (`assignedUserId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
