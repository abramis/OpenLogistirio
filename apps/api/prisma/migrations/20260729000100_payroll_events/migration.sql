ALTER TABLE `PayrollEntry`
  DROP INDEX `PayrollEntry_period_employee_key`,
  ADD COLUMN `payrollEventId` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `PayrollEntry_period_employee_earnings_key`(`payrollPeriodId`, `employeeId`, `apdEarningsType`),
  ADD UNIQUE INDEX `PayrollEntry_event_key`(`payrollEventId`);

CREATE TABLE `PayrollEvent` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `contractId` VARCHAR(191) NOT NULL,
  `periodYear` INTEGER NOT NULL,
  `periodMonth` INTEGER NOT NULL,
  `type` ENUM('CHRISTMAS_BONUS', 'EASTER_BONUS', 'LEAVE_ALLOWANCE', 'SICKNESS', 'RETROACTIVE', 'BONUS', 'OVERTIME') NOT NULL,
  `dateFrom` DATETIME(3) NULL,
  `dateTo` DATETIME(3) NULL,
  `insuranceDays` INTEGER NOT NULL DEFAULT 0,
  `leaveDays` INTEGER NULL,
  `efkaBenefit` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `grossAmount` DECIMAL(12, 2) NOT NULL,
  `autoCalculated` BOOLEAN NOT NULL DEFAULT false,
  `calculationDetails` JSON NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `PayrollEvent_office_client_period_idx`(`accountingOfficeId`, `clientCompanyId`, `periodYear`, `periodMonth`),
  INDEX `PayrollEvent_employee_type_year_idx`(`employeeId`, `type`, `periodYear`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PayrollEvent`
  ADD CONSTRAINT `PayrollEvent_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PayrollEvent_clientCompanyId_fkey`
  FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PayrollEvent_employeeId_fkey`
  FOREIGN KEY (`employeeId`) REFERENCES `PayrollEmployee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PayrollEvent_contractId_fkey`
  FOREIGN KEY (`contractId`) REFERENCES `PayrollContract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `PayrollEntry`
  ADD CONSTRAINT `PayrollEntry_payrollEventId_fkey`
  FOREIGN KEY (`payrollEventId`) REFERENCES `PayrollEvent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
