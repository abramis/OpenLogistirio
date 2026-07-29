ALTER TABLE `AnnualTaxReturn`
  ADD COLUMN `refundAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0 AFTER `totalPayable`;
