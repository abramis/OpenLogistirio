ALTER TABLE `PayrollPeriod`
  ADD COLUMN `apdSubmissionDeadline` DATETIME(3) NULL,
  ADD COLUMN `apdSubmittedAt` DATETIME(3) NULL,
  ADD COLUMN `apdProtocol` VARCHAR(100) NULL,
  ADD COLUMN `apdLateSubmission` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `contributionsPaymentDeadline` DATETIME(3) NULL,
  ADD COLUMN `contributionsPaidAt` DATETIME(3) NULL,
  ADD COLUMN `contributionsPaymentDate` DATETIME(3) NULL,
  ADD COLUMN `contributionsPaymentReference` VARCHAR(100) NULL,
  ADD COLUMN `contributionsLatePayment` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `tekaContributionAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `tekaSubmittedAt` DATETIME(3) NULL,
  ADD COLUMN `tekaProtocol` VARCHAR(100) NULL,
  ADD COLUMN `tekaLateSubmission` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `tekaPaymentDate` DATETIME(3) NULL,
  ADD COLUMN `tekaPaymentReference` VARCHAR(100) NULL,
  ADD COLUMN `tekaLatePayment` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `fmySubmissionDeadline` DATETIME(3) NULL,
  ADD COLUMN `fmySubmittedAt` DATETIME(3) NULL,
  ADD COLUMN `fmyProtocol` VARCHAR(100) NULL,
  ADD COLUMN `fmyDebtId` VARCHAR(100) NULL,
  ADD COLUMN `fmyLateSubmission` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `fmyPaidAt` DATETIME(3) NULL,
  ADD COLUMN `fmyPaymentDate` DATETIME(3) NULL,
  ADD COLUMN `fmyPaymentReference` VARCHAR(100) NULL,
  ADD COLUMN `fmyLatePayment` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `PayrollEmployerSettings`
  ADD COLUMN `tekaPaymentRf` VARCHAR(25) NULL;

ALTER TABLE `PayrollEmployee`
  ADD COLUMN `tekaInsured` BOOLEAN NOT NULL DEFAULT false;
