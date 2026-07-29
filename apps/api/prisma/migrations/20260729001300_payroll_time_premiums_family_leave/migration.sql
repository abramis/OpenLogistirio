-- Production payroll: statutory time premiums, contribution basis and family-leave workflow.
ALTER TABLE `PayrollContract`
  ADD COLUMN `statutoryMonthlySalary` DECIMAL(12, 2) NULL,
  ADD COLUMN `statutoryDailyWage` DECIMAL(12, 2) NULL;

ALTER TABLE `PayrollEntry`
  ADD COLUMN `nightPremiumGross` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `sundayHolidayGross` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `extraWorkGross` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `legalOvertimeGross` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `approvedOvertimeGross` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `illegalOvertimeGross` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `partTimeExtraGross` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `leaveEmployerGross` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `contributionBase` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `contributionExempt` DECIMAL(12, 2) NOT NULL DEFAULT 0;

UPDATE `PayrollEntry`
SET `contributionBase` = `grossEarnings`;

ALTER TABLE `PayrollLeave`
  MODIFY COLUMN `type` ENUM(
    'ANNUAL',
    'UNPAID',
    'SICK',
    'MATERNITY',
    'SPECIAL_MATERNITY_PROTECTION',
    'PATERNITY',
    'PARENTAL',
    'CAREGIVER',
    'OTHER'
  ) NOT NULL,
  ADD COLUMN `paymentSource` ENUM(
    'EMPLOYER',
    'E_EFKA_DYPA',
    'DYPA',
    'UNPAID',
    'MIXED'
  ) NOT NULL DEFAULT 'EMPLOYER',
  ADD COLUMN `employerGrossAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `employeeRequestReference` VARCHAR(191) NULL,
  ADD COLUMN `externalBenefitReference` VARCHAR(191) NULL,
  ADD COLUMN `erganiProtocol` VARCHAR(100) NULL,
  ADD COLUMN `erganiSubmittedAt` DATETIME(3) NULL;
