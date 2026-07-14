ALTER TABLE `ImportBatch`
  MODIFY COLUMN `status` ENUM('PREVIEW', 'COMPLETED', 'FAILED', 'ROLLED_BACK') NOT NULL,
  ADD COLUMN `rolledBackAt` DATETIME(3) NULL;

ALTER TABLE `Document`
  ADD COLUMN `importBatchId` VARCHAR(191) NULL,
  ADD INDEX `Document_importBatchId_idx` (`importBatchId`),
  ADD CONSTRAINT `Document_importBatchId_fkey`
    FOREIGN KEY (`importBatchId`) REFERENCES `ImportBatch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
