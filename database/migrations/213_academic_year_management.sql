-- Persist independent academic-year ownership for ERP master and operational data.
-- Existing rows are attached to the currently active year so the legacy dataset remains visible.

ALTER TABLE academic_years ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'DRAFT';
ALTER TABLE academic_years ADD COLUMN archived_at DATETIME NULL;
ALTER TABLE academic_years ADD COLUMN created_by VARCHAR(64) NULL;
UPDATE academic_years SET status = CASE WHEN is_active = 1 THEN 'ACTIVE' ELSE 'DRAFT' END;

ALTER TABLE clusters ADD COLUMN academic_year_id VARCHAR(64) NULL;
ALTER TABLE clusters ADD COLUMN source_cluster_id VARCHAR(64) NULL;
ALTER TABLE panchayats ADD COLUMN academic_year_id VARCHAR(64) NULL;
ALTER TABLE villages ADD COLUMN academic_year_id VARCHAR(64) NULL;
ALTER TABLE students ADD COLUMN academic_year_id VARCHAR(64) NULL;
ALTER TABLE students ADD COLUMN school_name VARCHAR(255) NULL;
ALTER TABLE volunteers ADD COLUMN academic_year_id VARCHAR(64) NULL;
ALTER TABLE sessions ADD COLUMN academic_year_id VARCHAR(64) NULL;
ALTER TABLE modules ADD COLUMN academic_year_id VARCHAR(64) NULL;
ALTER TABLE academic_setup ADD COLUMN academic_year_id VARCHAR(64) NULL;

CREATE TABLE IF NOT EXISTS schools (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  academic_year_id VARCHAR(64) NOT NULL,
  cluster_id VARCHAR(64) NOT NULL,
  panchayat_id VARCHAR(64) NULL,
  village_id VARCHAR(64) NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_schools_year_village_name (academic_year_id, village_id, name),
  INDEX idx_schools_year (academic_year_id),
  INDEX idx_schools_village (village_id),
  INDEX idx_schools_cluster (cluster_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE clusters SET academic_year_id = (
  SELECT active_year.id FROM (SELECT id FROM academic_years WHERE is_active = 1 ORDER BY start_date DESC LIMIT 1) active_year
) WHERE academic_year_id IS NULL;
UPDATE panchayats SET academic_year_id = (
  SELECT active_year.id FROM (SELECT id FROM academic_years WHERE is_active = 1 ORDER BY start_date DESC LIMIT 1) active_year
) WHERE academic_year_id IS NULL;
UPDATE villages SET academic_year_id = (
  SELECT active_year.id FROM (SELECT id FROM academic_years WHERE is_active = 1 ORDER BY start_date DESC LIMIT 1) active_year
) WHERE academic_year_id IS NULL;
UPDATE students SET academic_year_id = (
  SELECT active_year.id FROM (SELECT id FROM academic_years WHERE is_active = 1 ORDER BY start_date DESC LIMIT 1) active_year
) WHERE academic_year_id IS NULL;
UPDATE volunteers SET academic_year_id = (
  SELECT active_year.id FROM (SELECT id FROM academic_years WHERE is_active = 1 ORDER BY start_date DESC LIMIT 1) active_year
) WHERE academic_year_id IS NULL;
UPDATE sessions s JOIN academic_years ay ON ay.name = s.academic_year
SET s.academic_year_id = ay.id WHERE s.academic_year_id IS NULL;
UPDATE sessions SET academic_year_id = (
  SELECT active_year.id FROM (SELECT id FROM academic_years WHERE is_active = 1 ORDER BY start_date DESC LIMIT 1) active_year
) WHERE academic_year_id IS NULL;
UPDATE modules m JOIN academic_years ay ON ay.name = m.academic_year
SET m.academic_year_id = ay.id WHERE m.academic_year_id IS NULL AND m.academic_year IS NOT NULL;
UPDATE modules SET academic_year_id = (
  SELECT active_year.id FROM (SELECT id FROM academic_years WHERE is_active = 1 ORDER BY start_date DESC LIMIT 1) active_year
) WHERE academic_year_id IS NULL;
UPDATE academic_setup a JOIN academic_years ay ON ay.name = a.academic_year
SET a.academic_year_id = ay.id WHERE a.academic_year_id IS NULL;
UPDATE academic_setup SET academic_year_id = (
  SELECT active_year.id FROM (SELECT id FROM academic_years WHERE is_active = 1 ORDER BY start_date DESC LIMIT 1) active_year
) WHERE academic_year_id IS NULL;

-- Legacy operational records without a year are retained under the active year.
-- Existing rows that were already assigned a year are not changed.
UPDATE attendance_sessions SET academic_year_id = (
  SELECT active_year.id FROM (SELECT id FROM academic_years WHERE is_active = 1 ORDER BY start_date DESC LIMIT 1) active_year
) WHERE academic_year_id IS NULL;
UPDATE lesson_plans SET academic_year_id = (
  SELECT active_year.id FROM (SELECT id FROM academic_years WHERE is_active = 1 ORDER BY start_date DESC LIMIT 1) active_year
) WHERE academic_year_id IS NULL;
UPDATE session_photos SET academic_year_id = (
  SELECT active_year.id FROM (SELECT id FROM academic_years WHERE is_active = 1 ORDER BY start_date DESC LIMIT 1) active_year
) WHERE academic_year_id IS NULL;
UPDATE session_reports SET academic_year_id = (
  SELECT active_year.id FROM (SELECT id FROM academic_years WHERE is_active = 1 ORDER BY start_date DESC LIMIT 1) active_year
) WHERE academic_year_id IS NULL;
UPDATE finance_entries SET academic_year_id = (
  SELECT active_year.id FROM (SELECT id FROM academic_years WHERE is_active = 1 ORDER BY start_date DESC LIMIT 1) active_year
) WHERE academic_year_id IS NULL;
UPDATE approvals SET academic_year_id = (
  SELECT active_year.id FROM (SELECT id FROM academic_years WHERE is_active = 1 ORDER BY start_date DESC LIMIT 1) active_year
) WHERE academic_year_id IS NULL;
UPDATE date_change_requests SET academic_year_id = (
  SELECT active_year.id FROM (SELECT id FROM academic_years WHERE is_active = 1 ORDER BY start_date DESC LIMIT 1) active_year
) WHERE academic_year_id IS NULL;
UPDATE session_submissions SET academic_year_id = (
  SELECT active_year.id FROM (SELECT id FROM academic_years WHERE is_active = 1 ORDER BY start_date DESC LIMIT 1) active_year
) WHERE academic_year_id IS NULL;

ALTER TABLE academic_setup DROP PRIMARY KEY, ADD PRIMARY KEY (academic_year_id, day_number);
ALTER TABLE academic_setup ADD INDEX idx_academic_setup_year_name (academic_year);
ALTER TABLE clusters ADD INDEX idx_clusters_academic_year (academic_year_id);
ALTER TABLE panchayats ADD INDEX idx_panchayats_academic_year (academic_year_id);
ALTER TABLE villages ADD INDEX idx_villages_academic_year (academic_year_id);
ALTER TABLE students ADD INDEX idx_students_academic_year (academic_year_id);
ALTER TABLE volunteers ADD INDEX idx_volunteers_academic_year (academic_year_id);
ALTER TABLE sessions ADD INDEX idx_sessions_academic_year (academic_year_id);
ALTER TABLE modules ADD INDEX idx_modules_academic_year_id (academic_year_id);
