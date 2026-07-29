ALTER TABLE `DeclarationWorkpaper`
  DROP INDEX `DeclWorkpaper_period_kind_key`,
  ADD COLUMN `returnType` ENUM('INITIAL', 'AMENDING') NOT NULL DEFAULT 'INITIAL' AFTER `periodCloseReviewId`,
  ADD COLUMN `revision` INTEGER NOT NULL DEFAULT 0 AFTER `returnType`,
  ADD COLUMN `submissionDeadline` DATETIME(3) NULL AFTER `generatedAt`,
  ADD COLUMN `lateSubmission` BOOLEAN NULL AFTER `submissionDate`,
  ADD COLUMN `vatPayableAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0 AFTER `submissionAttachments`,
  ADD COLUMN `vatCreditCarryForward` DECIMAL(14, 2) NOT NULL DEFAULT 0 AFTER `vatPayableAmount`,
  ADD COLUMN `vatRefundClaim` DECIMAL(14, 2) NOT NULL DEFAULT 0 AFTER `vatCreditCarryForward`,
  ADD COLUMN `vatDebtId` VARCHAR(160) NULL AFTER `vatRefundClaim`,
  ADD UNIQUE INDEX `DeclWorkpaper_period_revision_key`
    (`clientCompanyId`, `type`, `periodYear`, `periodKind`, `periodEndMonth`, `revision`);

CREATE TABLE `DeclarationTaxPayment` (
  `id` VARCHAR(191) NOT NULL,
  `declarationWorkpaperId` VARCHAR(191) NOT NULL,
  `installmentNumber` INTEGER NOT NULL,
  `dueDate` DATETIME(3) NOT NULL,
  `amount` DECIMAL(14, 2) NOT NULL,
  `paidAt` DATETIME(3) NULL,
  `paymentReference` VARCHAR(160) NULL,
  `latePayment` BOOLEAN NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `DeclarationTaxPayment_workpaper_number_key`(`declarationWorkpaperId`, `installmentNumber`),
  INDEX `DeclarationTaxPayment_due_paid_idx`(`dueDate`, `paidAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DeclarationTaxPayment`
  ADD CONSTRAINT `DeclarationTaxPayment_declarationWorkpaperId_fkey`
  FOREIGN KEY (`declarationWorkpaperId`) REFERENCES `DeclarationWorkpaper`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
