ALTER TABLE `PeriodCloseReview`
  ADD COLUMN `reopenedAt` DATETIME(3) NULL,
  ADD COLUMN `reopenReason` VARCHAR(1000) NULL;
