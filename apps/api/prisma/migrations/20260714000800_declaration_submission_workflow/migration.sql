ALTER TABLE `DeclarationWorkpaper`
  ADD COLUMN `submissionReference` VARCHAR(160) NULL,
  ADD COLUMN `submissionDate` DATETIME(3) NULL,
  ADD COLUMN `submissionAttachments` JSON NULL;
