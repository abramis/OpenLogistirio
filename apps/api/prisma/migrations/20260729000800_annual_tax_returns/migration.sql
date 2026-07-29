CREATE TABLE `AnnualTaxReturn` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `fiscalYear` INTEGER NOT NULL,
  `kind` ENUM('INDIVIDUAL_E1', 'LEGAL_ENTITY_N') NOT NULL,
  `returnType` ENUM('INITIAL', 'AMENDING') NOT NULL DEFAULT 'INITIAL',
  `revision` INTEGER NOT NULL DEFAULT 0,
  `status` ENUM('DRAFT', 'READY', 'APPROVED', 'SUBMITTED') NOT NULL DEFAULT 'DRAFT',
  `includesE2` BOOLEAN NOT NULL DEFAULT false,
  `includesE3` BOOLEAN NOT NULL DEFAULT true,
  `submissionDeadline` DATETIME(3) NOT NULL,
  `bookRevenue` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `bookExpenses` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `accountingResult` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `myDataRevenue` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `myDataExpenses` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `nonDeductibleExpenses` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `taxExemptIncome` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `otherTaxAdditions` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `otherTaxDeductions` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `priorTaxLosses` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `taxableResult` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `unpostedDocumentCount` INTEGER NOT NULL DEFAULT 0,
  `unresolvedMyDataCount` INTEGER NOT NULL DEFAULT 0,
  `openPeriodCount` INTEGER NOT NULL DEFAULT 0,
  `missingPeriodCount` INTEGER NOT NULL DEFAULT 0,
  `unpostedDepreciationCount` INTEGER NOT NULL DEFAULT 0,
  `checklist` JSON NOT NULL,
  `adjustmentNotes` TEXT NULL,
  `approvedById` VARCHAR(191) NULL,
  `approvedAt` DATETIME(3) NULL,
  `submittedAt` DATETIME(3) NULL,
  `submissionReference` VARCHAR(160) NULL,
  `lateSubmission` BOOLEAN NULL,
  `assessmentReference` VARCHAR(160) NULL,
  `debtId` VARCHAR(160) NULL,
  `assessedIncomeTax` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `taxPrepayment` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `otherAssessedAmounts` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `totalPayable` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `submissionNotes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `AnnualTaxReturn_client_year_kind_revision_key`(`clientCompanyId`, `fiscalYear`, `kind`, `revision`),
  INDEX `AnnualTaxReturn_office_status_year_idx`(`accountingOfficeId`, `status`, `fiscalYear`),
  INDEX `AnnualTaxReturn_client_year_idx`(`clientCompanyId`, `fiscalYear`),
  INDEX `AnnualTaxReturn_approved_by_idx`(`approvedById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AnnualTaxInstallment` (
  `id` VARCHAR(191) NOT NULL,
  `annualTaxReturnId` VARCHAR(191) NOT NULL,
  `installmentNumber` INTEGER NOT NULL,
  `dueDate` DATETIME(3) NOT NULL,
  `amount` DECIMAL(14, 2) NOT NULL,
  `paidAt` DATETIME(3) NULL,
  `paymentReference` VARCHAR(160) NULL,
  `latePayment` BOOLEAN NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `AnnualTaxInstallment_return_number_key`(`annualTaxReturnId`, `installmentNumber`),
  INDEX `AnnualTaxInstallment_due_paid_idx`(`dueDate`, `paidAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AnnualTaxReturn`
  ADD CONSTRAINT `AnnualTaxReturn_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `AnnualTaxReturn`
  ADD CONSTRAINT `AnnualTaxReturn_clientCompanyId_fkey`
  FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `AnnualTaxReturn`
  ADD CONSTRAINT `AnnualTaxReturn_approvedById_fkey`
  FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `AnnualTaxInstallment`
  ADD CONSTRAINT `AnnualTaxInstallment_annualTaxReturnId_fkey`
  FOREIGN KEY (`annualTaxReturnId`) REFERENCES `AnnualTaxReturn`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
