CREATE TABLE `AccountingOffice` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `vatNumber` VARCHAR(9) NULL,
  `email` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `address` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `User` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(191) NOT NULL,
  `fullName` VARCHAR(191) NOT NULL,
  `role` ENUM(
    'SUPER_ADMIN',
    'ACCOUNTING_OFFICE_ADMIN',
    'ACCOUNTANT',
    'ASSISTANT',
    'CLIENT_READONLY'
  ) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `User_email_key` (`email`),
  INDEX `User_accountingOfficeId_idx` (`accountingOfficeId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ClientCompany` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `legalName` VARCHAR(191) NOT NULL,
  `tradeName` VARCHAR(191) NULL,
  `vatNumber` VARCHAR(9) NOT NULL,
  `taxOffice` VARCHAR(191) NULL,
  `activityCodes` JSON NULL,
  `address` VARCHAR(191) NULL,
  `email` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `vatRegime` VARCHAR(191) NULL,
  `accountingCategory` VARCHAR(191) NULL,
  `fiscalYearStart` INTEGER NOT NULL DEFAULT 1,
  `fiscalYearEnd` INTEGER NOT NULL DEFAULT 12,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  UNIQUE INDEX `ClientCompany_accountingOfficeId_vatNumber_key` (`accountingOfficeId`, `vatNumber`),
  INDEX `ClientCompany_accountingOfficeId_deletedAt_idx` (`accountingOfficeId`, `deletedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AuditLog` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `action` ENUM('CREATE', 'UPDATE', 'DELETE') NOT NULL,
  `entityType` VARCHAR(191) NOT NULL,
  `entityId` VARCHAR(191) NOT NULL,
  `oldValue` JSON NULL,
  `newValue` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `AuditLog_accountingOfficeId_entityType_entityId_idx` (
    `accountingOfficeId`,
    `entityType`,
    `entityId`
  ),
  INDEX `AuditLog_userId_idx` (`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `User`
  ADD CONSTRAINT `User_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ClientCompany`
  ADD CONSTRAINT `ClientCompany_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `AuditLog`
  ADD CONSTRAINT `AuditLog_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `AuditLog`
  ADD CONSTRAINT `AuditLog_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
