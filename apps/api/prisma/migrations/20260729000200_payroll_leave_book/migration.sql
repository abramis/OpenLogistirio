ALTER TABLE `PayrollEmployee`
  ADD COLUMN `recognizedPriorServiceYears` INTEGER NOT NULL DEFAULT 0;

CREATE TABLE `PayrollLeave` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `fiscalYear` INTEGER NOT NULL,
  `type` ENUM('ANNUAL', 'UNPAID', 'SICK', 'MATERNITY', 'PATERNITY', 'PARENTAL', 'CAREGIVER', 'OTHER') NOT NULL,
  `dateFrom` DATETIME(3) NOT NULL,
  `dateTo` DATETIME(3) NOT NULL,
  `workingDays` DECIMAL(5, 2) NOT NULL,
  `paid` BOOLEAN NOT NULL DEFAULT true,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `PayrollLeave_office_client_year_idx`(`accountingOfficeId`, `clientCompanyId`, `fiscalYear`),
  INDEX `PayrollLeave_employee_year_type_idx`(`employeeId`, `fiscalYear`, `type`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PayrollLeave`
  ADD CONSTRAINT `PayrollLeave_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PayrollLeave_clientCompanyId_fkey`
  FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PayrollLeave_employeeId_fkey`
  FOREIGN KEY (`employeeId`) REFERENCES `PayrollEmployee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
