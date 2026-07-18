ALTER TABLE `DispatchNote`
  MODIFY `status` ENUM('DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED', 'REJECTED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT';

CREATE TABLE `DispatchDeliveryReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `dispatchNoteId` VARCHAR(191) NOT NULL,
  `outcome` ENUM('FULL', 'PARTIAL', 'NONE') NOT NULL,
  `deliveredWithoutRecipient` BOOLEAN NOT NULL DEFAULT false,
  `receivedAt` DATETIME(3) NOT NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `DispatchDeliveryReceipt_dispatchNoteId_key`(`dispatchNoteId`),
  INDEX `DispatchReceipt_office_client_date_idx`(`accountingOfficeId`, `clientCompanyId`, `receivedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DispatchDeliveryReceiptLine` (
  `id` VARCHAR(191) NOT NULL,
  `receiptId` VARCHAR(191) NOT NULL,
  `dispatchNoteLineId` VARCHAR(191) NOT NULL,
  `orderedQuantity` DECIMAL(14, 3) NOT NULL,
  `acceptedQuantity` DECIMAL(14, 3) NOT NULL,
  `rejectedQuantity` DECIMAL(14, 3) NOT NULL,
  `missingQuantity` DECIMAL(14, 3) NOT NULL,
  `qualityNotes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `DispatchDeliveryReceiptLine_dispatchNoteLineId_key`(`dispatchNoteLineId`),
  INDEX `DispatchReceiptLine_receipt_idx`(`receiptId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DispatchLifecycleEvent` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `dispatchNoteId` VARCHAR(191) NOT NULL,
  `eventType` ENUM('CREATED', 'UPDATED', 'ISSUED', 'DELIVERY_COMPLETED', 'DELIVERY_PARTIAL', 'DELIVERY_REJECTED', 'CANCELLED') NOT NULL,
  `eventAt` DATETIME(3) NOT NULL,
  `details` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `DispatchEvent_office_client_date_idx`(`accountingOfficeId`, `clientCompanyId`, `eventAt`),
  INDEX `DispatchEvent_note_date_idx`(`dispatchNoteId`, `eventAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `DispatchLifecycleEvent` (`id`, `accountingOfficeId`, `clientCompanyId`, `dispatchNoteId`, `eventType`, `eventAt`, `details`, `createdAt`)
SELECT UUID(), `accountingOfficeId`, `clientCompanyId`, `id`, 'CREATED', `createdAt`, JSON_OBJECT('backfilled', true), `createdAt`
FROM `DispatchNote`;

ALTER TABLE `DispatchDeliveryReceipt` ADD CONSTRAINT `DispatchDeliveryReceipt_accountingOfficeId_fkey` FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DispatchDeliveryReceipt` ADD CONSTRAINT `DispatchDeliveryReceipt_clientCompanyId_fkey` FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DispatchDeliveryReceipt` ADD CONSTRAINT `DispatchDeliveryReceipt_dispatchNoteId_fkey` FOREIGN KEY (`dispatchNoteId`) REFERENCES `DispatchNote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DispatchDeliveryReceiptLine` ADD CONSTRAINT `DispatchDeliveryReceiptLine_receiptId_fkey` FOREIGN KEY (`receiptId`) REFERENCES `DispatchDeliveryReceipt`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DispatchDeliveryReceiptLine` ADD CONSTRAINT `DispatchDeliveryReceiptLine_dispatchNoteLineId_fkey` FOREIGN KEY (`dispatchNoteLineId`) REFERENCES `DispatchNoteLine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DispatchLifecycleEvent` ADD CONSTRAINT `DispatchLifecycleEvent_accountingOfficeId_fkey` FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DispatchLifecycleEvent` ADD CONSTRAINT `DispatchLifecycleEvent_clientCompanyId_fkey` FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DispatchLifecycleEvent` ADD CONSTRAINT `DispatchLifecycleEvent_dispatchNoteId_fkey` FOREIGN KEY (`dispatchNoteId`) REFERENCES `DispatchNote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
