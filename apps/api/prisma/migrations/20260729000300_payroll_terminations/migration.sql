CREATE TABLE `PayrollTermination` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `contractId` VARCHAR(191) NOT NULL,
  `type` ENUM('EMPLOYER_DISMISSAL', 'VOLUNTARY_RESIGNATION', 'FIXED_TERM_EXPIRY', 'RETIREMENT', 'DEATH', 'OTHER') NOT NULL,
  `status` ENUM('DRAFT', 'COMPLETED') NOT NULL DEFAULT 'DRAFT',
  `terminationDate` DATETIME(3) NOT NULL,
  `withNotice` BOOLEAN NOT NULL DEFAULT false,
  `noticeMonths` INTEGER NOT NULL DEFAULT 0,
  `completedServiceYears` INTEGER NOT NULL,
  `regularMonthlyEarnings` DECIMAL(12, 2) NOT NULL,
  `severanceMonths` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  `statutorySeverance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `severanceAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `calculationDetails` JSON NOT NULL,
  `paymentDate` DATETIME(3) NULL,
  `paymentReference` VARCHAR(100) NULL,
  `erganiProtocol` VARCHAR(100) NULL,
  `erganiSubmittedAt` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `PayrollTermination_contractId_key`(`contractId`),
  INDEX `PayrollTermination_office_client_date_idx`(`accountingOfficeId`, `clientCompanyId`, `terminationDate`),
  INDEX `PayrollTermination_employee_status_idx`(`employeeId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PayrollTermination`
  ADD CONSTRAINT `PayrollTermination_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PayrollTermination_clientCompanyId_fkey`
  FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PayrollTermination_employeeId_fkey`
  FOREIGN KEY (`employeeId`) REFERENCES `PayrollEmployee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PayrollTermination_contractId_fkey`
  FOREIGN KEY (`contractId`) REFERENCES `PayrollContract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
