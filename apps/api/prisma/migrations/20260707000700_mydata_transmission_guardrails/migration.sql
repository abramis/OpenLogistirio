ALTER TABLE `TransmissionAttempt`
  ADD COLUMN `environment` VARCHAR(40) NULL,
  ADD COLUMN `endpoint` VARCHAR(255) NULL,
  ADD COLUMN `correlationId` VARCHAR(80) NULL,
  ADD COLUMN `forcedRetry` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `TransmissionAttempt_provider_environment_createdAt_idx`
  ON `TransmissionAttempt`(`provider`, `environment`, `createdAt`);

CREATE INDEX `TransmissionAttempt_correlationId_idx`
  ON `TransmissionAttempt`(`correlationId`);
