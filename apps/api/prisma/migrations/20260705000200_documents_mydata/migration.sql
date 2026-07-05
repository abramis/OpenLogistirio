CREATE TABLE `Document` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `documentType` ENUM(
    'SALES_INVOICE',
    'PURCHASE_INVOICE',
    'CREDIT_NOTE',
    'RETAIL_RECEIPT'
  ) NOT NULL,
  `series` VARCHAR(191) NULL,
  `documentNumber` VARCHAR(191) NOT NULL,
  `issueDate` DATETIME(3) NOT NULL,
  `counterpartyName` VARCHAR(191) NULL,
  `counterpartyVatNumber` VARCHAR(20) NULL,
  `netAmount` DECIMAL(12, 2) NOT NULL,
  `vatAmount` DECIMAL(12, 2) NOT NULL,
  `totalAmount` DECIMAL(12, 2) NOT NULL,
  `vatCategory` VARCHAR(191) NOT NULL,
  `myDataStatus` ENUM('DRAFT', 'READY_TO_SEND', 'SENT', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `myDataMark` VARCHAR(191) NULL,
  `myDataUid` VARCHAR(191) NULL,
  `myDataQrUrl` VARCHAR(191) NULL,
  `myDataXmlPreview` LONGTEXT NULL,
  `classificationStatus` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  INDEX `Document_accountingOfficeId_clientCompanyId_issueDate_idx` (
    `accountingOfficeId`,
    `clientCompanyId`,
    `issueDate`
  ),
  INDEX `Document_accountingOfficeId_myDataStatus_idx` (`accountingOfficeId`, `myDataStatus`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TransmissionAttempt` (
  `id` VARCHAR(191) NOT NULL,
  `documentId` VARCHAR(191) NOT NULL,
  `provider` VARCHAR(191) NOT NULL,
  `status` ENUM('PREPARED', 'SENT', 'FAILED') NOT NULL,
  `requestPayload` LONGTEXT NOT NULL,
  `responsePayload` JSON NULL,
  `errorCode` VARCHAR(191) NULL,
  `errorMessage` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `TransmissionAttempt_documentId_createdAt_idx` (`documentId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Document`
  ADD CONSTRAINT `Document_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Document`
  ADD CONSTRAINT `Document_clientCompanyId_fkey`
  FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `TransmissionAttempt`
  ADD CONSTRAINT `TransmissionAttempt_documentId_fkey`
  FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
