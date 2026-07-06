ALTER TABLE `Document`
  ADD COLUMN `movementCode` VARCHAR(80) NULL,
  ADD COLUMN `journalCode` VARCHAR(80) NULL;

CREATE INDEX `Document_clientCompanyId_movementCode_issueDate_idx`
  ON `Document`(`clientCompanyId`, `movementCode`, `issueDate`);

CREATE INDEX `Document_clientCompanyId_journalCode_issueDate_idx`
  ON `Document`(`clientCompanyId`, `journalCode`, `issueDate`);
