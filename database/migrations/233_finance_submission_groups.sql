-- Group finance line items under one submit-for-approval request.
ALTER TABLE finance_entries
  ADD COLUMN draft_id VARCHAR(64) NULL AFTER status,
  ADD INDEX idx_finance_draft (draft_id);
