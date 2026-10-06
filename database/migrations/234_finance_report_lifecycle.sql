-- Persist finance report metadata and edit-request lifecycle independently of the line items.
ALTER TABLE finance_entries
  ADD COLUMN bill_url LONGTEXT NULL AFTER bill_reference,
  ADD COLUMN count INT NULL AFTER bill_url,
  ADD COLUMN count_amount VARCHAR(64) NULL AFTER count,
  ADD COLUMN remarks TEXT NULL AFTER count_amount;

CREATE TABLE IF NOT EXISTS finance_reports (
  id VARCHAR(64) NOT NULL,
  cluster_id VARCHAR(64) NOT NULL,
  academic_year_id VARCHAR(64) NOT NULL,
  session_id VARCHAR(64) NULL,
  report_status ENUM('DRAFT','SUBMITTED','PENDING_APPROVAL','APPROVED','REJECTED') NOT NULL DEFAULT 'DRAFT',
  report_data JSON NOT NULL,
  edit_request_status ENUM('NONE','PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'NONE',
  edit_request_reason TEXT NULL,
  edit_requested_by VARCHAR(64) NULL,
  edit_requested_at DATETIME NULL,
  edit_approved_by VARCHAR(64) NULL,
  edit_approved_at DATETIME NULL,
  edit_rejected_by VARCHAR(64) NULL,
  edit_rejected_at DATETIME NULL,
  edit_rejection_reason TEXT NULL,
  edit_permission BOOLEAN NOT NULL DEFAULT FALSE,
  last_submitted_at DATETIME NULL,
  last_submitted_by VARCHAR(64) NULL,
  created_by VARCHAR(64) NULL,
  updated_by VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id, academic_year_id),
  INDEX idx_finance_reports_cluster (cluster_id, academic_year_id),
  INDEX idx_finance_reports_status (report_status, edit_request_status),
  CONSTRAINT fk_finance_reports_cluster FOREIGN KEY (cluster_id) REFERENCES clusters(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_finance_reports_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_finance_reports_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS finance_report_history (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  report_id VARCHAR(64) NOT NULL,
  academic_year_id VARCHAR(64) NOT NULL,
  event VARCHAR(128) NOT NULL,
  details TEXT NULL,
  user_id VARCHAR(64) NULL,
  user_name VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_finance_history_report (report_id, academic_year_id, created_at),
  CONSTRAINT fk_finance_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;