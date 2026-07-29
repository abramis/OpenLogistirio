-- Production workflow for monthly withholding taxes outside payroll.
CREATE TABLE `WithholdingTaxReturn` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `periodYear` INTEGER NOT NULL,
  `periodMonth` INTEGER NOT NULL,
  `category` ENUM('BUSINESS_ACTIVITY', 'DIVIDENDS', 'INTEREST', 'ROYALTIES') NOT NULL,
  `returnType` ENUM('INITIAL', 'AMENDING') NOT NULL DEFAULT 'INITIAL',
  `revision` INTEGER NOT NULL DEFAULT 0,
  `status` ENUM('DRAFT', 'READY', 'APPROVED', 'SUBMITTED') NOT NULL DEFAULT 'DRAFT',
  `submissionDeadline` DATETIME(3) NOT NULL,
  `declarantName` VARCHAR(30) NOT NULL,
  `declarantFirstName` VARCHAR(9) NULL,
  `declarantFatherName` VARCHAR(3) NULL,
  `declarantIsLegalEntity` BOOLEAN NOT NULL DEFAULT true,
  `declarantVatNumber` VARCHAR(9) NOT NULL,
  `businessActivity` VARCHAR(16) NOT NULL,
  `city` VARCHAR(10) NOT NULL,
  `street` VARCHAR(16) NOT NULL,
  `streetNumber` VARCHAR(5) NOT NULL,
  `postalCode` VARCHAR(5) NOT NULL,
  `grossAmount` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `deductionsAmount` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `netAmount` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `assessedTaxAmount` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `withheldTaxAmount` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `digitalFeeAmount` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `digitalFeeOgaAmount` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `payableAmount` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `approvedSnapshot` JSON NULL,
  `approvedById` VARCHAR(191) NULL,
  `approvedAt` DATETIME(3) NULL,
  `fileGeneratedAt` DATETIME(3) NULL,
  `fileProtocol` VARCHAR(160) NULL,
  `submittedAt` DATETIME(3) NULL,
  `submissionReference` VARCHAR(160) NULL,
  `debtId` VARCHAR(160) NULL,
  `lateSubmission` BOOLEAN NULL,
  `paidAt` DATETIME(3) NULL,
  `paymentReference` VARCHAR(160) NULL,
  `latePayment` BOOLEAN NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `WithholdingTaxReturn_period_category_revision_key` (`clientCompanyId`, `periodYear`, `periodMonth`, `category`, `revision`),
  INDEX `WithholdingTaxReturn_office_status_deadline_idx` (`accountingOfficeId`, `status`, `submissionDeadline`),
  INDEX `WithholdingTaxReturn_client_period_idx` (`clientCompanyId`, `periodYear`, `periodMonth`),
  INDEX `WithholdingTaxReturn_approved_by_idx` (`approvedById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WithholdingTaxReturnLine` (
  `id` VARCHAR(191) NOT NULL,
  `withholdingTaxReturnId` VARCHAR(191) NOT NULL,
  `beneficiaryVatNumber` VARCHAR(9) NULL,
  `beneficiaryLastName` VARCHAR(18) NOT NULL,
  `beneficiaryFirstName` VARCHAR(9) NULL,
  `beneficiaryFatherName` VARCHAR(3) NULL,
  `beneficiarySocialSecurity` VARCHAR(11) NULL,
  `foreignWithoutGreekVat` BOOLEAN NOT NULL DEFAULT false,
  `countryCode` VARCHAR(2) NULL,
  `incomeCode` VARCHAR(2) NOT NULL,
  `paymentDate` DATETIME(3) NOT NULL,
  `grossAmount` DECIMAL(14,2) NOT NULL,
  `deductionsAmount` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `netAmount` DECIMAL(14,2) NOT NULL,
  `withholdingRate` DECIMAL(6,3) NOT NULL,
  `assessedTaxAmount` DECIMAL(14,2) NOT NULL,
  `withheldTaxAmount` DECIMAL(14,2) NOT NULL,
  `digitalFeeRate` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `digitalFeeAmount` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `digitalFeeOgaAmount` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `exemptionLawArticle` VARCHAR(4) NULL,
  `exemptionLawNumber` VARCHAR(4) NULL,
  `exemptionLawYear` VARCHAR(4) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `WithholdingTaxLine_return_beneficiary_idx` (`withholdingTaxReturnId`, `beneficiaryVatNumber`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `WithholdingTaxReturn`
  ADD CONSTRAINT `WithholdingTaxReturn_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `WithholdingTaxReturn_clientCompanyId_fkey`
  FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `WithholdingTaxReturn_approvedById_fkey`
  FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `WithholdingTaxReturnLine`
  ADD CONSTRAINT `WithholdingTaxReturnLine_withholdingTaxReturnId_fkey`
  FOREIGN KEY (`withholdingTaxReturnId`) REFERENCES `WithholdingTaxReturn`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
