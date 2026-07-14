ALTER TABLE `Document`
  ADD COLUMN `replacesDocumentId` VARCHAR(191) NULL,
  ADD COLUMN `correctsDocumentId` VARCHAR(191) NULL,
  ADD INDEX `Document_replacesDocumentId_idx` (`replacesDocumentId`),
  ADD INDEX `Document_correctsDocumentId_idx` (`correctsDocumentId`),
  ADD CONSTRAINT `Document_replacesDocumentId_fkey`
    FOREIGN KEY (`replacesDocumentId`) REFERENCES `Document`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Document_correctsDocumentId_fkey`
    FOREIGN KEY (`correctsDocumentId`) REFERENCES `Document`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
