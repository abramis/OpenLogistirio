CREATE TABLE `PayrollEmployerSettings` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `employerRegistryNumber` VARCHAR(10) NOT NULL,
  `submissionOfficeCode` VARCHAR(10) NOT NULL,
  `submissionOfficeName` VARCHAR(50) NOT NULL,
  `street` VARCHAR(50) NOT NULL,
  `streetNumber` VARCHAR(10) NOT NULL,
  `postalCode` VARCHAR(5) NOT NULL,
  `city` VARCHAR(30) NOT NULL,
  `efkaPaymentRf` VARCHAR(23) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `PayrollEmployerSettings_clientCompanyId_key`(`clientCompanyId`),
  INDEX `PayrollEmployerSettings_office_client_idx`(`accountingOfficeId`, `clientCompanyId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PayrollEmployee` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(40) NOT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `lastName` VARCHAR(50) NOT NULL,
  `firstName` VARCHAR(30) NOT NULL,
  `fatherName` VARCHAR(30) NOT NULL,
  `motherName` VARCHAR(30) NOT NULL,
  `birthDate` DATETIME(3) NOT NULL,
  `afm` VARCHAR(9) NOT NULL,
  `amka` VARCHAR(11) NOT NULL,
  `insuranceRegistryNumber` VARCHAR(9) NOT NULL,
  `dependentChildren` INTEGER NOT NULL DEFAULT 0,
  `email` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `iban` VARCHAR(34) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `PayrollEmployee_client_code_key`(`clientCompanyId`, `code`),
  UNIQUE INDEX `PayrollEmployee_client_amka_key`(`clientCompanyId`, `amka`),
  INDEX `PayrollEmployee_office_client_status_idx`(`accountingOfficeId`, `clientCompanyId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PayrollContract` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `startDate` DATETIME(3) NOT NULL,
  `endDate` DATETIME(3) NULL,
  `compensationType` ENUM('MONTHLY', 'DAILY') NOT NULL,
  `monthlySalary` DECIMAL(12, 2) NULL,
  `dailyWage` DECIMAL(12, 2) NULL,
  `fullTime` BOOLEAN NOT NULL DEFAULT true,
  `weeklySystem` ENUM('FIVE_DAY', 'SIX_DAY') NOT NULL DEFAULT 'FIVE_DAY',
  `weeklyHours` DECIMAL(5, 2) NOT NULL DEFAULT 40,
  `workDaysPerWeek` INTEGER NOT NULL DEFAULT 5,
  `apdBranchNumber` INTEGER NOT NULL DEFAULT 0,
  `apdKad` VARCHAR(4) NOT NULL,
  `apdSpecialtyCode` VARCHAR(6) NOT NULL,
  `apdSpecialInsuranceCase` VARCHAR(2) NOT NULL DEFAULT '00',
  `apdCoveragePackageCode` VARCHAR(4) NOT NULL DEFAULT '101',
  `externalSupplementaryFund` VARCHAR(2) NOT NULL DEFAULT '00',
  `externalHealthFund` VARCHAR(2) NOT NULL DEFAULT '00',
  `employeeContributionRate` DECIMAL(6, 3) NOT NULL DEFAULT 13.370,
  `employerContributionRate` DECIMAL(6, 3) NOT NULL DEFAULT 21.790,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `PayrollContract_employee_start_key`(`employeeId`, `startDate`),
  INDEX `PayrollContract_office_client_dates_idx`(`accountingOfficeId`, `clientCompanyId`, `startDate`, `endDate`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PayrollPeriod` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `periodYear` INTEGER NOT NULL,
  `periodMonth` INTEGER NOT NULL,
  `declarationType` ENUM('NORMAL', 'SUPPLEMENTARY') NOT NULL DEFAULT 'NORMAL',
  `status` ENUM('DRAFT', 'CALCULATED', 'APPROVED', 'PAID') NOT NULL DEFAULT 'DRAFT',
  `totalGross` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `totalEmployeeContributions` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `totalEmployerContributions` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `totalWithholdingTax` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `totalNet` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `approvedById` VARCHAR(191) NULL,
  `calculatedAt` DATETIME(3) NULL,
  `approvedAt` DATETIME(3) NULL,
  `paidAt` DATETIME(3) NULL,
  `paymentDate` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `PayrollPeriod_client_period_type_key`(`clientCompanyId`, `periodYear`, `periodMonth`, `declarationType`),
  INDEX `PayrollPeriod_office_period_status_idx`(`accountingOfficeId`, `periodYear`, `periodMonth`, `status`),
  INDEX `PayrollPeriod_approved_by_idx`(`approvedById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PayrollEntry` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `payrollPeriodId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `contractId` VARCHAR(191) NOT NULL,
  `employmentFrom` DATETIME(3) NOT NULL,
  `employmentTo` DATETIME(3) NOT NULL,
  `insuranceDays` INTEGER NOT NULL,
  `apdEarningsType` VARCHAR(3) NOT NULL DEFAULT '001',
  `baseGross` DECIMAL(12, 2) NOT NULL,
  `overtimeGross` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `bonusGross` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `otherGross` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `grossEarnings` DECIMAL(12, 2) NOT NULL,
  `employeeContributions` DECIMAL(12, 2) NOT NULL,
  `employerContributions` DECIMAL(12, 2) NOT NULL,
  `taxableEarnings` DECIMAL(12, 2) NOT NULL,
  `withholdingTax` DECIMAL(12, 2) NOT NULL,
  `otherDeductions` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `netPayable` DECIMAL(12, 2) NOT NULL,
  `calculationSnapshot` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `PayrollEntry_period_employee_key`(`payrollPeriodId`, `employeeId`),
  INDEX `PayrollEntry_office_client_employee_idx`(`accountingOfficeId`, `clientCompanyId`, `employeeId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PayrollEmployerSettings`
  ADD CONSTRAINT `PayrollEmployerSettings_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PayrollEmployerSettings_clientCompanyId_fkey`
  FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `PayrollEmployee`
  ADD CONSTRAINT `PayrollEmployee_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PayrollEmployee_clientCompanyId_fkey`
  FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `PayrollContract`
  ADD CONSTRAINT `PayrollContract_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PayrollContract_clientCompanyId_fkey`
  FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PayrollContract_employeeId_fkey`
  FOREIGN KEY (`employeeId`) REFERENCES `PayrollEmployee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `PayrollPeriod`
  ADD CONSTRAINT `PayrollPeriod_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PayrollPeriod_clientCompanyId_fkey`
  FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PayrollPeriod_approvedById_fkey`
  FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `PayrollEntry`
  ADD CONSTRAINT `PayrollEntry_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PayrollEntry_clientCompanyId_fkey`
  FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PayrollEntry_payrollPeriodId_fkey`
  FOREIGN KEY (`payrollPeriodId`) REFERENCES `PayrollPeriod`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PayrollEntry_employeeId_fkey`
  FOREIGN KEY (`employeeId`) REFERENCES `PayrollEmployee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PayrollEntry_contractId_fkey`
  FOREIGN KEY (`contractId`) REFERENCES `PayrollContract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
