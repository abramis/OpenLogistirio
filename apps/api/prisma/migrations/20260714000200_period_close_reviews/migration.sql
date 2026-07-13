ALTER TABLE `DeclarationWorkpaper`
  MODIFY COLUMN `status` ENUM('DRAFT', 'READY', 'APPROVED', 'SUBMITTED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN `approvedById` VARCHAR(191) NULL,
  ADD COLUMN `approvedAt` DATETIME(3) NULL,
  ADD INDEX `DeclWorkpaper_approved_by_idx` (`approvedById`),
  ADD CONSTRAINT `DeclarationWorkpaper_approvedById_fkey`
    FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `PeriodCloseReview` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `kind` ENUM('MONTHLY', 'QUARTERLY') NOT NULL,
  `periodYear` INTEGER NOT NULL,
  `startMonth` INTEGER NOT NULL,
  `endMonth` INTEGER NOT NULL,
  `status` ENUM('DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
  `checklist` JSON NOT NULL,
  `reviewSummary` JSON NOT NULL,
  `notes` TEXT NULL,
  `rejectionReason` TEXT NULL,
  `preparedById` VARCHAR(191) NULL,
  `approvedById` VARCHAR(191) NULL,
  `preparedAt` DATETIME(3) NULL,
  `submittedAt` DATETIME(3) NULL,
  `approvedAt` DATETIME(3) NULL,
  `rejectedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `PeriodCloseReview_period_key` (`clientCompanyId`, `kind`, `periodYear`, `endMonth`),
  INDEX `PeriodCloseReview_office_status_year_idx` (`accountingOfficeId`, `status`, `periodYear`),
  INDEX `PeriodCloseReview_client_period_idx` (`clientCompanyId`, `periodYear`, `startMonth`, `endMonth`),
  INDEX `PeriodCloseReview_prepared_by_idx` (`preparedById`),
  INDEX `PeriodCloseReview_approved_by_idx` (`approvedById`),
  PRIMARY KEY (`id`),
  CONSTRAINT `PeriodCloseReview_accountingOfficeId_fkey`
    FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `PeriodCloseReview_clientCompanyId_fkey`
    FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `PeriodCloseReview_preparedById_fkey`
    FOREIGN KEY (`preparedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `PeriodCloseReview_approvedById_fkey`
    FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
