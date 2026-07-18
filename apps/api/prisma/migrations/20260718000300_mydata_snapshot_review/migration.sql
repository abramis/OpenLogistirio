ALTER TABLE `MyDataSnapshot`
  ADD COLUMN `reviewStatus` ENUM('PENDING', 'RESOLVED', 'IGNORED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `reviewedById` VARCHAR(191) NULL,
  ADD COLUMN `reviewedAt` DATETIME(3) NULL,
  ADD COLUMN `reviewNotes` TEXT NULL;

UPDATE `MyDataSnapshot`
SET `reviewStatus` = 'RESOLVED', `reviewedAt` = `fetchedAt`
WHERE `reconciliationStatus` = 'MATCHED';

CREATE INDEX `MyDataSnapshot_office_review_fetched_idx`
  ON `MyDataSnapshot`(`accountingOfficeId`, `reviewStatus`, `fetchedAt`);
CREATE INDEX `MyDataSnapshot_reviewed_by_idx` ON `MyDataSnapshot`(`reviewedById`);

ALTER TABLE `MyDataSnapshot`
  ADD CONSTRAINT `MyDataSnapshot_reviewedById_fkey`
  FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
