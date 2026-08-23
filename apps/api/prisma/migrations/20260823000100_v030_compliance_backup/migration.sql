-- Open Logistirio v0.3.0: annual certificates, EU compliance, collective agreements
-- and external AADE dispatch lifecycle metadata.

ALTER TABLE `ClientCompany`
  ADD COLUMN `viesEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `intrastatArrivalsEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `intrastatDispatchesEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `collectiveAgreementEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `digitalMovementAadeEnabled` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `DispatchNote`
  ADD COLUMN `aadeStatus` ENUM('NOT_REQUIRED', 'PENDING', 'TRANSMITTED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN `aadeInvoiceMark` VARCHAR(40) NULL,
  ADD COLUMN `aadeInvoiceUid` VARCHAR(80) NULL,
  ADD COLUMN `aadeQrUrl` VARCHAR(1000) NULL,
  ADD COLUMN `aadeTransferMark` VARCHAR(40) NULL,
  ADD COLUMN `aadeDeliveryOutcomeMark` VARCHAR(40) NULL,
  ADD COLUMN `aadeRejectMark` VARCHAR(40) NULL,
  ADD COLUMN `aadeCancellationMark` VARCHAR(40) NULL,
  ADD COLUMN `aadeLastError` VARCHAR(1000) NULL,
  ADD COLUMN `aadeLastAttemptAt` DATETIME(3) NULL,
  ADD COLUMN `aadeTransmittedAt` DATETIME(3) NULL,
  ADD INDEX `DispatchNote_office_aade_status_idx` (`accountingOfficeId`, `aadeStatus`, `aadeLastAttemptAt`);

CREATE TABLE `AnnualCertificate` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `fiscalYear` INTEGER NOT NULL,
  `kind` ENUM('EMPLOYMENT', 'BUSINESS_ACTIVITY', 'DIVIDENDS_INTEREST_ROYALTIES') NOT NULL,
  `returnType` ENUM('INITIAL', 'AMENDING') NOT NULL DEFAULT 'INITIAL',
  `revision` INTEGER NOT NULL DEFAULT 0,
  `status` ENUM('DRAFT', 'READY', 'FILE_GENERATED', 'SUBMITTED', 'LOCKED') NOT NULL DEFAULT 'DRAFT',
  `specificationVersion` VARCHAR(80) NOT NULL,
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
  `grossAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `deductionsAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `netAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `withheldTaxAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `digitalFeeAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `sourceSnapshot` JSON NOT NULL,
  `reconciliation` JSON NOT NULL,
  `blockerCount` INTEGER NOT NULL DEFAULT 0,
  `fileName` VARCHAR(200) NULL,
  `fileChecksumSha256` VARCHAR(64) NULL,
  `fileGeneratedAt` DATETIME(3) NULL,
  `submittedAt` DATETIME(3) NULL,
  `submissionProtocol` VARCHAR(160) NULL,
  `lockedAt` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `AnnualCertificate_client_year_kind_revision_key` (`clientCompanyId`, `fiscalYear`, `kind`, `revision`),
  INDEX `AnnualCertificate_office_year_status_idx` (`accountingOfficeId`, `fiscalYear`, `status`),
  CONSTRAINT `AnnualCertificate_accountingOfficeId_fkey` FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `AnnualCertificate_clientCompanyId_fkey` FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AnnualCertificateLine` (
  `id` VARCHAR(191) NOT NULL,
  `annualCertificateId` VARCHAR(191) NOT NULL,
  `beneficiaryVatNumber` VARCHAR(20) NULL,
  `beneficiaryLastName` VARCHAR(50) NOT NULL,
  `beneficiaryFirstName` VARCHAR(30) NULL,
  `beneficiaryFatherName` VARCHAR(30) NULL,
  `beneficiarySocialSecurity` VARCHAR(11) NULL,
  `dependentChildren` INTEGER NOT NULL DEFAULT 0,
  `foreignWithoutGreekVat` BOOLEAN NOT NULL DEFAULT false,
  `countryCode` VARCHAR(2) NULL,
  `incomeCode` VARCHAR(2) NOT NULL,
  `grossAmount` DECIMAL(14, 2) NOT NULL,
  `deductionsAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `netAmount` DECIMAL(14, 2) NOT NULL,
  `withheldTaxAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `digitalFeeAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `referenceYear` INTEGER NULL,
  `lawProvision` VARCHAR(9) NULL,
  `sourceRefs` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `AnnualCertificateLine_certificate_beneficiary_idx` (`annualCertificateId`, `beneficiaryVatNumber`, `incomeCode`),
  CONSTRAINT `AnnualCertificateLine_annualCertificateId_fkey` FOREIGN KEY (`annualCertificateId`) REFERENCES `AnnualCertificate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ViesReturn` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `periodYear` INTEGER NOT NULL,
  `periodMonth` INTEGER NOT NULL,
  `kind` ENUM('F4_SUPPLIES', 'F5_ACQUISITIONS') NOT NULL,
  `returnType` ENUM('INITIAL', 'AMENDING') NOT NULL DEFAULT 'INITIAL',
  `revision` INTEGER NOT NULL DEFAULT 0,
  `status` ENUM('DRAFT', 'READY', 'FILE_GENERATED', 'SUBMITTED', 'LOCKED') NOT NULL DEFAULT 'DRAFT',
  `sourceBookAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `sourceMyDataAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `declaredAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `reconciliation` JSON NOT NULL,
  `blockerCount` INTEGER NOT NULL DEFAULT 0,
  `fileChecksumSha256` VARCHAR(64) NULL,
  `fileGeneratedAt` DATETIME(3) NULL,
  `submittedAt` DATETIME(3) NULL,
  `submissionProtocol` VARCHAR(160) NULL,
  `lockedAt` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ViesReturn_period_kind_revision_key` (`clientCompanyId`, `periodYear`, `periodMonth`, `kind`, `revision`),
  INDEX `ViesReturn_office_status_period_idx` (`accountingOfficeId`, `status`, `periodYear`, `periodMonth`),
  CONSTRAINT `ViesReturn_accountingOfficeId_fkey` FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ViesReturn_clientCompanyId_fkey` FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ViesReturnLine` (
  `id` VARCHAR(191) NOT NULL,
  `viesReturnId` VARCHAR(191) NOT NULL,
  `countryCode` VARCHAR(2) NOT NULL,
  `vatNumber` VARCHAR(20) NOT NULL,
  `counterpartyName` VARCHAR(200) NULL,
  `goodsAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `triangularAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `servicesAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `vatValid` BOOLEAN NULL,
  `vatCheckedAt` DATETIME(3) NULL,
  `vatRequestIdentifier` VARCHAR(100) NULL,
  `sourceDocumentIds` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ViesReturnLine_return_vat_key` (`viesReturnId`, `countryCode`, `vatNumber`),
  INDEX `ViesReturnLine_return_valid_idx` (`viesReturnId`, `vatValid`),
  CONSTRAINT `ViesReturnLine_viesReturnId_fkey` FOREIGN KEY (`viesReturnId`) REFERENCES `ViesReturn`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `IntrastatThreshold` (
  `year` INTEGER NOT NULL,
  `arrivalsAmount` DECIMAL(14, 2) NOT NULL,
  `dispatchesAmount` DECIMAL(14, 2) NOT NULL,
  `officialSource` VARCHAR(500) NOT NULL,
  `verifiedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `IntrastatThreshold` (`year`, `arrivalsAmount`, `dispatchesAmount`, `officialSource`, `verifiedAt`) VALUES
  (2025, 200000.00, 90000.00, 'https://eurostat.statistics.gr/announcement?id=92', '2025-01-24 00:00:00.000'),
  (2026, 250000.00, 90000.00, 'https://eurostat.statistics.gr/announcement?id=93', '2026-01-30 00:00:00.000');

CREATE TABLE `IntrastatReturn` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `periodYear` INTEGER NOT NULL,
  `periodMonth` INTEGER NOT NULL,
  `flow` ENUM('ARRIVALS', 'DISPATCHES') NOT NULL,
  `returnType` ENUM('INITIAL', 'AMENDING') NOT NULL DEFAULT 'INITIAL',
  `revision` INTEGER NOT NULL DEFAULT 0,
  `status` ENUM('DRAFT', 'READY', 'FILE_GENERATED', 'SUBMITTED', 'LOCKED') NOT NULL DEFAULT 'DRAFT',
  `thresholdAmount` DECIMAL(14, 2) NOT NULL,
  `yearToDateAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `thresholdExceeded` BOOLEAN NOT NULL DEFAULT false,
  `declaredAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `statisticalAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `reconciliation` JSON NOT NULL,
  `blockerCount` INTEGER NOT NULL DEFAULT 0,
  `fileChecksumSha256` VARCHAR(64) NULL,
  `fileGeneratedAt` DATETIME(3) NULL,
  `submittedAt` DATETIME(3) NULL,
  `submissionProtocol` VARCHAR(160) NULL,
  `lockedAt` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `IntrastatReturn_period_flow_revision_key` (`clientCompanyId`, `periodYear`, `periodMonth`, `flow`, `revision`),
  INDEX `IntrastatReturn_office_status_period_idx` (`accountingOfficeId`, `status`, `periodYear`, `periodMonth`),
  CONSTRAINT `IntrastatReturn_accountingOfficeId_fkey` FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `IntrastatReturn_clientCompanyId_fkey` FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `IntrastatLine` (
  `id` VARCHAR(191) NOT NULL,
  `intrastatReturnId` VARCHAR(191) NOT NULL,
  `lineNumber` INTEGER NOT NULL,
  `countryCode` VARCHAR(2) NOT NULL,
  `transactionNature` VARCHAR(2) NOT NULL,
  `transportMode` VARCHAR(1) NOT NULL,
  `commodityCode` VARCHAR(8) NOT NULL,
  `netMassKg` INTEGER NOT NULL,
  `supplementaryUnits` INTEGER NOT NULL DEFAULT 0,
  `invoicedAmount` INTEGER NOT NULL,
  `statisticalValue` INTEGER NOT NULL,
  `partnerVatNumber` VARCHAR(20) NULL,
  `countryOfOrigin` VARCHAR(2) NULL,
  `deliveryTerms` VARCHAR(3) NULL,
  `sourceDocumentId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `IntrastatLine_return_line_key` (`intrastatReturnId`, `lineNumber`),
  INDEX `IntrastatLine_return_commodity_idx` (`intrastatReturnId`, `commodityCode`),
  CONSTRAINT `IntrastatLine_intrastatReturnId_fkey` FOREIGN KEY (`intrastatReturnId`) REFERENCES `IntrastatReturn`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CollectiveAgreement` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NULL,
  `code` VARCHAR(80) NOT NULL,
  `title` VARCHAR(300) NOT NULL,
  `sourceUrl` VARCHAR(1000) NULL,
  `activityCodes` JSON NOT NULL,
  `specialtyCodes` JSON NOT NULL,
  `mandatory` BOOLEAN NOT NULL DEFAULT false,
  `priority` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `CollectiveAgreement_office_code_key` (`accountingOfficeId`, `code`),
  INDEX `CollectiveAgreement_office_client_idx` (`accountingOfficeId`, `clientCompanyId`, `mandatory`),
  CONSTRAINT `CollectiveAgreement_accountingOfficeId_fkey` FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `CollectiveAgreement_clientCompanyId_fkey` FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CollectiveAgreementVersion` (
  `id` VARCHAR(191) NOT NULL,
  `collectiveAgreementId` VARCHAR(191) NOT NULL,
  `versionLabel` VARCHAR(100) NOT NULL,
  `validFrom` DATETIME(3) NOT NULL,
  `validTo` DATETIME(3) NULL,
  `weeklyHours` DECIMAL(5, 2) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `CollectiveAgreementVersion_agreement_from_key` (`collectiveAgreementId`, `validFrom`),
  INDEX `CollectiveAgreementVersion_validity_idx` (`validFrom`, `validTo`),
  CONSTRAINT `CollectiveAgreementVersion_collectiveAgreementId_fkey` FOREIGN KEY (`collectiveAgreementId`) REFERENCES `CollectiveAgreement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CollectiveAgreementWageRule` (
  `id` VARCHAR(191) NOT NULL,
  `collectiveAgreementVersionId` VARCHAR(191) NOT NULL,
  `specialtyCode` VARCHAR(40) NOT NULL,
  `specialtyTitle` VARCHAR(200) NOT NULL,
  `minimumMonthlySalary` DECIMAL(12, 2) NULL,
  `minimumDailyWage` DECIMAL(12, 2) NULL,
  `allowanceRules` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `CollectiveAgreementWageRule_version_specialty_key` (`collectiveAgreementVersionId`, `specialtyCode`),
  INDEX `CollectiveAgreementWageRule_specialty_idx` (`specialtyCode`),
  CONSTRAINT `CollectiveAgreementWageRule_collectiveAgreementVersionId_fkey` FOREIGN KEY (`collectiveAgreementVersionId`) REFERENCES `CollectiveAgreementVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PayrollContract`
  ADD COLUMN `specialtyCode` VARCHAR(40) NULL,
  ADD COLUMN `collectiveAgreementVersionId` VARCHAR(191) NULL,
  ADD COLUMN `legalBaseSnapshot` JSON NULL,
  ADD INDEX `PayrollContract_collective_version_idx` (`collectiveAgreementVersionId`),
  ADD CONSTRAINT `PayrollContract_collectiveAgreementVersionId_fkey` FOREIGN KEY (`collectiveAgreementVersionId`) REFERENCES `CollectiveAgreementVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
