CREATE TABLE `InventoryItem` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `measurementUnit` INTEGER NOT NULL DEFAULT 1,
  `trackInventory` BOOLEAN NOT NULL DEFAULT true,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  UNIQUE INDEX `InventoryItem_client_code_key`(`clientCompanyId`, `code`),
  INDEX `InventoryItem_office_client_active_idx`(`accountingOfficeId`, `clientCompanyId`, `isActive`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Warehouse` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(40) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `address` TEXT NULL,
  `branchNumber` INTEGER NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  UNIQUE INDEX `Warehouse_client_code_key`(`clientCompanyId`, `code`),
  INDEX `Warehouse_office_client_active_idx`(`accountingOfficeId`, `clientCompanyId`, `isActive`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Vehicle` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `registrationNumber` VARCHAR(40) NOT NULL,
  `description` TEXT NULL,
  `vehicleType` VARCHAR(80) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  UNIQUE INDEX `Vehicle_client_registration_key`(`clientCompanyId`, `registrationNumber`),
  INDEX `Vehicle_office_client_active_idx`(`accountingOfficeId`, `clientCompanyId`, `isActive`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WarehouseStock` (
  `id` VARCHAR(191) NOT NULL,
  `warehouseId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `quantity` DECIMAL(14, 3) NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `WarehouseStock_warehouse_item_key`(`warehouseId`, `itemId`),
  INDEX `WarehouseStock_item_idx`(`itemId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DispatchNote` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `series` VARCHAR(40) NOT NULL,
  `number` VARCHAR(80) NOT NULL,
  `issueDate` DATETIME(3) NOT NULL,
  `plannedDispatchAt` DATETIME(3) NOT NULL,
  `status` ENUM('DRAFT', 'ISSUED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `movePurpose` INTEGER NOT NULL,
  `otherMovePurposeTitle` VARCHAR(150) NULL,
  `counterpartyId` VARCHAR(191) NULL,
  `recipientName` VARCHAR(191) NULL,
  `recipientVatNumber` VARCHAR(20) NULL,
  `loadingWarehouseId` VARCHAR(191) NOT NULL,
  `deliveryWarehouseId` VARCHAR(191) NULL,
  `vehicleId` VARCHAR(191) NULL,
  `vehicleNumber` VARCHAR(150) NULL,
  `loadingAddress` TEXT NOT NULL,
  `deliveryAddress` TEXT NOT NULL,
  `notes` TEXT NULL,
  `issuedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `cancelledAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `DispatchNote_client_series_number_key`(`clientCompanyId`, `series`, `number`),
  INDEX `DispatchNote_office_client_status_date_idx`(`accountingOfficeId`, `clientCompanyId`, `status`, `plannedDispatchAt`),
  INDEX `DispatchNote_counterparty_idx`(`counterpartyId`),
  INDEX `DispatchNote_vehicle_idx`(`vehicleId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DispatchNoteLine` (
  `id` VARCHAR(191) NOT NULL,
  `dispatchNoteId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `lineNumber` INTEGER NOT NULL,
  `itemCode` VARCHAR(50) NOT NULL,
  `description` VARCHAR(300) NOT NULL,
  `quantity` DECIMAL(14, 3) NOT NULL,
  `measurementUnit` INTEGER NOT NULL,
  `movePurposeLine` INTEGER NULL,
  `otherMovePurposeLineTitle` VARCHAR(150) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `DispatchNoteLine_note_line_key`(`dispatchNoteId`, `lineNumber`),
  INDEX `DispatchNoteLine_item_idx`(`itemId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StockMovement` (
  `id` VARCHAR(191) NOT NULL,
  `accountingOfficeId` VARCHAR(191) NOT NULL,
  `clientCompanyId` VARCHAR(191) NOT NULL,
  `warehouseId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `dispatchNoteId` VARCHAR(191) NULL,
  `dispatchNoteLineId` VARCHAR(191) NULL,
  `kind` ENUM('ADJUSTMENT', 'DISPATCH_OUT', 'DELIVERY_IN', 'CANCEL_OUT_REVERSAL', 'CANCEL_IN_REVERSAL') NOT NULL,
  `quantity` DECIMAL(14, 3) NOT NULL,
  `occurredAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `StockMovement_line_warehouse_kind_key`(`dispatchNoteLineId`, `warehouseId`, `kind`),
  INDEX `StockMovement_office_client_date_idx`(`accountingOfficeId`, `clientCompanyId`, `occurredAt`),
  INDEX `StockMovement_warehouse_item_date_idx`(`warehouseId`, `itemId`, `occurredAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `InventoryItem` ADD CONSTRAINT `InventoryItem_accountingOfficeId_fkey` FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `InventoryItem` ADD CONSTRAINT `InventoryItem_clientCompanyId_fkey` FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Warehouse` ADD CONSTRAINT `Warehouse_accountingOfficeId_fkey` FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Warehouse` ADD CONSTRAINT `Warehouse_clientCompanyId_fkey` FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Vehicle` ADD CONSTRAINT `Vehicle_accountingOfficeId_fkey` FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Vehicle` ADD CONSTRAINT `Vehicle_clientCompanyId_fkey` FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WarehouseStock` ADD CONSTRAINT `WarehouseStock_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WarehouseStock` ADD CONSTRAINT `WarehouseStock_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `InventoryItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DispatchNote` ADD CONSTRAINT `DispatchNote_accountingOfficeId_fkey` FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DispatchNote` ADD CONSTRAINT `DispatchNote_clientCompanyId_fkey` FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DispatchNote` ADD CONSTRAINT `DispatchNote_counterpartyId_fkey` FOREIGN KEY (`counterpartyId`) REFERENCES `Counterparty`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DispatchNote` ADD CONSTRAINT `DispatchNote_loadingWarehouseId_fkey` FOREIGN KEY (`loadingWarehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DispatchNote` ADD CONSTRAINT `DispatchNote_deliveryWarehouseId_fkey` FOREIGN KEY (`deliveryWarehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DispatchNote` ADD CONSTRAINT `DispatchNote_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DispatchNoteLine` ADD CONSTRAINT `DispatchNoteLine_dispatchNoteId_fkey` FOREIGN KEY (`dispatchNoteId`) REFERENCES `DispatchNote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DispatchNoteLine` ADD CONSTRAINT `DispatchNoteLine_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `InventoryItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_accountingOfficeId_fkey` FOREIGN KEY (`accountingOfficeId`) REFERENCES `AccountingOffice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_clientCompanyId_fkey` FOREIGN KEY (`clientCompanyId`) REFERENCES `ClientCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `InventoryItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_dispatchNoteId_fkey` FOREIGN KEY (`dispatchNoteId`) REFERENCES `DispatchNote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_dispatchNoteLineId_fkey` FOREIGN KEY (`dispatchNoteLineId`) REFERENCES `DispatchNoteLine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
