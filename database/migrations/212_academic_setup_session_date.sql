-- TQI-ERP: add session_date column to academic_setup
-- Lets the Super Admin pin a specific date (DD-MM-YY) for each of the 8
-- curriculum days, so the day cards in the Academic Term view show
-- exactly when each session is scheduled.
--
-- MySQL has no `ADD COLUMN IF NOT EXISTS` — the migration runner at
-- backend/src/server.ts already swallows ER_DUP_FIELDNAME (1060), so a
-- plain ADD COLUMN is safe to re-run.

ALTER TABLE academic_setup
  ADD COLUMN session_date DATE NULL AFTER session_name;
