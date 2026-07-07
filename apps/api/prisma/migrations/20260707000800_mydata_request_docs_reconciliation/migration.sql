CREATE TABLE `MyDataSyncRun` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `source` ENUM('REQUEST_DOCS', 'REQUEST_TRANSMITTED_DOCS') NOT NULL,
  `status` ENUM('COMPLETED', 'FAILED') NOT NULL,
  `environment` VARCHAR(40) NULL,
  `endpoint` VARCHAR(255) NULL,
  `markFrom` VARCHAR(40) NULL,
  `maxMark` VARCHAR(40) NULL,
  `dateFrom` DATETIME(3) NULL,
  `dateTo` DATETIME(3) NULL,
  `fetchedCount` INTEGER NOT NULL DEFAULT 0,
  `matchedCount` INTEGER NOT NULL DEFAULT 0,
  `mismatchCount` INTEGER NOT NULL DEFAULT 0,
  `errorMessage` VARCHAR(191) NULL,
  `rawResponse` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MyDataSnapshot` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `syncRunId` VARCHAR(191) NOT NULL,
  `matchedDocumentId` VARCHAR(191) NULL,
  `source` ENUM('REQUEST_DOCS', 'REQUEST_TRANSMITTED_DOCS') NOT NULL,
  `reconciliationStatus` ENUM('MATCHED', 'MISSING_INTERNAL', 'AMOUNT_MISMATCH', 'DATE_MISMATCH', 'TYPE_MISMATCH', 'COUNTERPARTY_MISMATCH') NOT NULL,
  `reconciliationIssues` JSON NULL,
  `mark` VARCHAR(40) NOT NULL,
  `uid` VARCHAR(120) NULL,
  `qrUrl` VARCHAR(191) NULL,
  `issuerVatNumber` VARCHAR(20) NULL,
  `counterpartyVatNumber` VARCHAR(20) NULL,
  `invoiceType` VARCHAR(20) NULL,
  `series` VARCHAR(80) NULL,
  `documentNumber` VARCHAR(80) NOT NULL,
  `issueDate` DATETIME(3) NULL,
  `netAmount` DECIMAL(12, 2) NULL,
  `vatAmount` DECIMAL(12, 2) NULL,
  `totalAmount` DECIMAL(12, 2) NULL,
  `rawPayload` JSON NOT NULL,
  `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `MyDataSyncRun_office_client_created_idx`
  ON `MyDataSyncRun`(`accountingOfficeId`, `clientCompanyId`, `createdAt`);
CREATE INDEX `MyDataSyncRun_source_status_created_idx`
  ON `MyDataSyncRun`(`source`, `status`, `createdAt`);

CREATE UNIQUE INDEX `MyDataSnapshot_clientCompanyId_source_mark_key`
  ON `MyDataSnapshot`(`clientCompanyId`, `source`, `mark`);
CREATE INDEX `MyDataSnapshot_office_client_status_idx`
  ON `MyDataSnapshot`(`accountingOfficeId`, `clientCompanyId`, `reconciliationStatus`);
CREATE INDEX `MyDataSnapshot_client_issue_idx`
  ON `MyDataSnapshot`(`clientCompanyId`, `issueDate`);
CREATE INDEX `MyDataSnapshot_matched_doc_idx`
  ON `MyDataSnapshot`(`matchedDocumentId`);

ALTER TABLE `MyDataSyncRun`
  ADD CONSTRAINT `MyDataSyncRun_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `MyDataSyncRun`
  ADD CONSTRAINT `MyDataSyncRun_clientCompanyId_fkey`
  FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `MyDataSnapshot`
  ADD CONSTRAINT `MyDataSnapshot_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `MyDataSnapshot`
  ADD CONSTRAINT `MyDataSnapshot_clientCompanyId_fkey`
  FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `MyDataSnapshot`
  ADD CONSTRAINT `MyDataSnapshot_syncRunId_fkey`
  FOREIGN KEY (`syncRunId`) REFERENCES `MyDataSyncRun`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `MyDataSnapshot`
  ADD CONSTRAINT `MyDataSnapshot_matchedDocumentId_fkey`
  FOREIGN KEY (`matchedDocumentId`) REFERENCES `Document`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
