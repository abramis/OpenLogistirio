CREATE TABLE `ClientSetupItem` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(80) NOT NULL,
  `code` VARCHAR(80) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NULL,
  `metadata` JSON NULL,
  `sourceTemplate` VARCHAR(80) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ClientSetupItem_client_kind_code_key` (`clientCompanyId`, `kind`, `code`),
  INDEX `ClientSetupItem_office_client_kind_idx` (`accountingOfficeId`, `clientCompanyId`, `kind`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ClientSetupItem`
  ADD CONSTRAINT `ClientSetupItem_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ClientSetupItem`
  ADD CONSTRAINT `ClientSetupItem_clientCompanyId_fkey`
  FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
