CREATE TABLE `DocumentLine` (
  `id` VARCHAR(191) NOT NULL,
  `documentId` VARCHAR(191) NOT NULL,
  `lineNumber` INTEGER NOT NULL,
  `itemCode` VARCHAR(50) NULL,
  `description` VARCHAR(300) NULL,
  `quantity` DECIMAL(14, 3) NULL,
  `measurementUnit` INTEGER NULL,
  `unitPrice` DECIMAL(12, 4) NULL,
  `discountAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `discountOption` BOOLEAN NULL,
  `netAmount` DECIMAL(12, 2) NOT NULL,
  `vatAmount` DECIMAL(12, 2) NOT NULL,
  `vatCategory` VARCHAR(40) NOT NULL,
  `vatExemptionCategory` INTEGER NULL,
  `withheldAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `withheldCategory` INTEGER NULL,
  `feesAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `feesCategory` INTEGER NULL,
  `stampDutyAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `stampDutyCategory` INTEGER NULL,
  `otherTaxesAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `otherTaxesCategory` INTEGER NULL,
  `deductionsAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `incomeClassificationType` VARCHAR(40) NULL,
  `incomeClassificationCategory` VARCHAR(40) NULL,
  `expenseClassificationType` VARCHAR(40) NULL,
  `expenseClassificationCategory` VARCHAR(40) NULL,
  `vatClassificationType` VARCHAR(40) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `DocumentLine_documentId_lineNumber_key`(`documentId`, `lineNumber`),
  INDEX `DocumentLine_documentId_idx`(`documentId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DocumentLine`
  ADD CONSTRAINT `DocumentLine_documentId_fkey`
  FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
