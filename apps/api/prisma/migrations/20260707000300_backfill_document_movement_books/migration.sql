UPDATE `Document`
SET
  `movementCode` = CASE
    WHEN `documentType` = 'PURCHASE_INVOICE' THEN 'PURCHASE_INVOICE'
    WHEN `documentType` = 'CREDIT_NOTE' THEN 'CREDIT_NOTE'
    ELSE 'SALE_INVOICE'
  END,
  `journalCode` = CASE
    WHEN `documentType` = 'PURCHASE_INVOICE' THEN 'PURCHASES'
    ELSE 'SALES'
  END
WHERE `movementCode` IS NULL
  OR `journalCode` IS NULL;
