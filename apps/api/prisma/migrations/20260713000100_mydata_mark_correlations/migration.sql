ALTER TABLE `Document`
  ADD COLUMN `myDataClassificationMark` VARCHAR(40) NULL,
  ADD COLUMN `myDataCancellationMark` VARCHAR(40) NULL,
  ADD COLUMN `myDataCancelledAt` DATETIME(3) NULL;

CREATE INDEX `Document_myDataClassificationMark_idx`
  ON `Document`(`myDataClassificationMark`);

CREATE INDEX `Document_myDataCancellationMark_idx`
  ON `Document`(`myDataCancellationMark`);
