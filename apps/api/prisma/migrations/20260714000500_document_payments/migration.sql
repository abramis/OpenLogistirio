CREATE TABLE `DocumentPayment` (
  `id` VARCHAR(191) NOT NULL,
  `documentId` VARCHAR(191) NOT NULL,
  `paymentNumber` INTEGER NOT NULL,
  `type` INTEGER NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `paymentMethodInfo` VARCHAR(500) NULL,
  `transactionId` VARCHAR(200) NULL,
  `tid` VARCHAR(200) NULL,
  `providerSigningAuthor` VARCHAR(20) NULL,
  `providerSignature` VARCHAR(500) NULL,
  `ecrSigningAuthor` VARCHAR(15) NULL,
  `ecrSessionNumber` VARCHAR(6) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `DocumentPayment_documentId_paymentNumber_key`(`documentId`, `paymentNumber`),
  INDEX `DocumentPayment_documentId_idx`(`documentId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `DocumentPayment_documentId_fkey`
    FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
