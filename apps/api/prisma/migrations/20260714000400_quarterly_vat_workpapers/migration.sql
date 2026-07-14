ALTER TABLE `DeclarationWorkpaper`
  DROP INDEX `DeclWorkpaper_period_key`,
  ADD COLUMN `periodKind` ENUM('MONTHLY', 'QUARTERLY', 'ANNUAL') NOT NULL DEFAULT 'MONTHLY' AFTER `periodMonth`,
  ADD COLUMN `periodStartMonth` INTEGER NOT NULL DEFAULT 1 AFTER `periodKind`,
  ADD COLUMN `periodEndMonth` INTEGER NOT NULL DEFAULT 12 AFTER `periodStartMonth`,
  ADD COLUMN `periodCloseReviewId` VARCHAR(191) NULL AFTER `approvedAt`;

UPDATE `DeclarationWorkpaper`
SET
  `periodStartMonth` = COALESCE(`periodMonth`, 1),
  `periodEndMonth` = COALESCE(`periodMonth`, 12),
  `periodKind` = CASE WHEN `periodMonth` IS NULL THEN 'ANNUAL' ELSE 'MONTHLY' END;

ALTER TABLE `DeclarationWorkpaper`
  ADD UNIQUE INDEX `DeclWorkpaper_period_kind_key` (`clientCompanyId`, `type`, `periodYear`, `periodKind`, `periodEndMonth`),
  ADD INDEX `DeclWorkpaper_period_close_idx` (`periodCloseReviewId`),
  ADD CONSTRAINT `DeclarationWorkpaper_periodCloseReviewId_fkey`
    FOREIGN KEY (`periodCloseReviewId`) REFERENCES `PeriodCloseReview`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
