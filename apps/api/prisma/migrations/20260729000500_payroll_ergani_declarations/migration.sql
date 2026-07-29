CREATE TABLE `PayrollErganiDeclaration` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `contractId` VARCHAR(191) NOT NULL,
  `type` ENUM(
    'HIRING',
    'WORK_SCHEDULE_CHANGE',
    'DIGITAL_CARD_ENROLLMENT',
    'EXECUTIVE_STATUS_ACQUIRED',
    'EXECUTIVE_STATUS_LOST',
    'PAY_CHANGE_AGREEMENT',
    'PAY_CHANGE_LEGISLATION',
    'SPECIALTY_CHANGE',
    'WORKPLACE_CHANGE',
    'PART_TIME_TO_FULL_TIME',
    'FULL_TIME_TO_PART_TIME',
    'FULL_TIME_TO_ROTATING',
    'FULL_TIME_TO_ROTATING_UNILATERAL',
    'FIXED_TO_OPEN_ENDED',
    'FIXED_TERM_EXTENSION',
    'WORK_TIME_ARRANGEMENT',
    'OTHER'
  ) NOT NULL,
  `status` ENUM('DRAFT', 'COMPLETED') NOT NULL DEFAULT 'DRAFT',
  `effectiveAt` DATETIME(3) NOT NULL,
  `deadlineAt` DATETIME(3) NOT NULL,
  `erganiProtocol` VARCHAR(100) NULL,
  `erganiSubmittedAt` DATETIME(3) NULL,
  `acceptanceMethod` ENUM(
    'SIGNED_SCAN',
    'QUALIFIED_E_SIGNATURE',
    'GOV_GR_DIGITAL_CONFIRMATION',
    'MYERGANI'
  ) NULL,
  `acceptanceReference` VARCHAR(191) NULL,
  `acceptedAt` DATETIME(3) NULL,
  `lateSubmission` BOOLEAN NOT NULL DEFAULT false,
  `declarationSnapshot` JSON NOT NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `PayrollErganiDeclaration_office_protocol_key`(`accountingOfficeId`, `erganiProtocol`),
  INDEX `PayrollErganiDeclaration_office_client_status_deadline_idx`(`accountingOfficeId`, `clientCompanyId`, `status`, `deadlineAt`),
  INDEX `PayrollErganiDeclaration_employee_effective_idx`(`employeeId`, `effectiveAt`),
  INDEX `PayrollErganiDeclaration_contract_status_idx`(`contractId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PayrollErganiDeclaration`
  ADD CONSTRAINT `PayrollErganiDeclaration_accountingOfficeId_fkey`
  FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PayrollErganiDeclaration_clientCompanyId_fkey`
  FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PayrollErganiDeclaration_employeeId_fkey`
  FOREIGN KEY (`employeeId`) REFERENCES `PayrollEmployee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PayrollErganiDeclaration_contractId_fkey`
  FOREIGN KEY (`contractId`) REFERENCES `PayrollContract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
