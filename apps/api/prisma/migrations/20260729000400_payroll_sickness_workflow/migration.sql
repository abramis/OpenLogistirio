ALTER TABLE `PayrollEvent`
  ADD COLUMN `sicknessBenefitStatus` ENUM('PENDING', 'APPROVED', 'NOT_ELIGIBLE') NULL,
  ADD COLUMN `medicalCertificateReference` VARCHAR(100) NULL;

ALTER TABLE `PayrollEntry`
  ADD COLUMN `entryKey` VARCHAR(191) NULL;

UPDATE `PayrollEntry`
SET `entryKey` = IF(
  `payrollEventId` IS NULL,
  CONCAT('REGULAR:', `apdEarningsType`),
  CONCAT('EVENT:', `payrollEventId`)
);

ALTER TABLE `PayrollEntry`
  MODIFY `entryKey` VARCHAR(191) NOT NULL,
  DROP INDEX `PayrollEntry_period_employee_earnings_key`,
  ADD UNIQUE INDEX `PayrollEntry_period_employee_entry_key`(`payrollPeriodId`, `employeeId`, `entryKey`);

ALTER TABLE `PayrollLeave`
  ADD COLUMN `payrollEventId` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `PayrollLeave_payrollEventId_key`(`payrollEventId`);

ALTER TABLE `PayrollLeave`
  ADD CONSTRAINT `PayrollLeave_payrollEventId_fkey`
  FOREIGN KEY (`payrollEventId`) REFERENCES `PayrollEvent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
