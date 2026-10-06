-- Migration 022: Add Attendance Workflow Fields
-- Supports 8-stage workflow: Draft, Submitted - Pending Review, Edit Requested, Edit Approved, Resubmission, Approved, Rejected

ALTER TABLE attendance_sessions
  ADD COLUMN IF NOT EXISTS edit_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS edit_requested_by VARCHAR(128) NULL,
  ADD COLUMN IF NOT EXISTS edit_requested_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(128) NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS review_remarks TEXT NULL,
  ADD COLUMN IF NOT EXISTS task_completed_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS not_marked_count INT NOT NULL DEFAULT 0;

ALTER TABLE student_attendance
  MODIFY COLUMN present TINYINT(1) NULL DEFAULT NULL,
  MODIFY COLUMN task_status VARCHAR(64) NULL DEFAULT NULL;
