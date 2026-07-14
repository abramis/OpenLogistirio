CREATE TABLE `SupportingDocument` (
    `id` VARCHAR(191) NOT NULL,
    `accountingOfficeId` VARCHAR(191) NOT NULL,
    `clientCompanyId` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(255) NOT NULL,
    `storageKey` VARCHAR(255) NOT NULL,
    `contentType` VARCHAR(120) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SupportingDocument_storageKey_key`(`storageKey`),
    INDEX `SupportDoc_office_client_created_idx`(`accountingOfficeId`, `clientCompanyId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SupportingDocument`
    ADD CONSTRAINT `SupportingDocument_accountingOfficeId_fkey`
    FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `SupportingDocument`
    ADD CONSTRAINT `SupportingDocument_clientCompanyId_fkey`
    FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
