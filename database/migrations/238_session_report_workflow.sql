ALTER TABLE session_reports
  MODIFY COLUMN status ENUM(
    'Draft',
    'Submitted',
    'Approved',
    'Rejected',
    'Corrections Required',
    'Edit Request Pending',
    'Delete Request Pending'
  ) NOT NULL DEFAULT 'Draft',
  ADD COLUMN village_ids TEXT NULL AFTER day_number,
  ADD COLUMN summit_number VARCHAR(100) NULL AFTER village_ids,
  ADD COLUMN grade VARCHAR(100) NULL AFTER summit_number,
  ADD COLUMN volunteer_names TEXT NULL AFTER outcome,
  ADD COLUMN submitted_by VARCHAR(64) NULL AFTER created_by,
  ADD COLUMN submitted_at TIMESTAMP NULL AFTER submitted_by,
  ADD COLUMN approved_by VARCHAR(64) NULL AFTER submitted_at,
  ADD COLUMN approved_at TIMESTAMP NULL AFTER approved_by,
  ADD COLUMN correction_reason TEXT NULL AFTER approved_at,
  ADD COLUMN edit_request_reason TEXT NULL AFTER correction_reason,
  ADD COLUMN delete_request_reason TEXT NULL AFTER edit_request_reason,
  ADD COLUMN workflow_previous_status VARCHAR(40) NULL AFTER delete_request_reason;