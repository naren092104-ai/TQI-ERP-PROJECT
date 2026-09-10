ALTER TABLE sessions
  ADD COLUMN session_date_fixed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN session_date_fixed_at DATETIME NULL,
  ADD COLUMN session_date_fixed_by VARCHAR(64) NULL;