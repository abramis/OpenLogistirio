ALTER TABLE Document
  ADD COLUMN expenseClassificationApprovalStatus
    ENUM('NOT_REQUESTED', 'PENDING', 'APPROVED', 'REJECTED', 'CONSUMED')
    NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN expenseClassificationApprovedById VARCHAR(191) NULL,
  ADD COLUMN expenseClassificationApprovedAt DATETIME(3) NULL,
  ADD COLUMN expenseClassificationApprovalNotes VARCHAR(500) NULL;

CREATE INDEX Document_office_expense_approval_idx
  ON Document(accountingOfficeId, expenseClassificationApprovalStatus);

CREATE INDEX Document_expense_approved_by_idx
  ON Document(expenseClassificationApprovedById);

ALTER TABLE Document
  ADD CONSTRAINT Document_expense_approved_by_fkey
  FOREIGN KEY (expenseClassificationApprovedById) REFERENCES User(id)
  ON DELETE SET NULL ON UPDATE CASCADE;
