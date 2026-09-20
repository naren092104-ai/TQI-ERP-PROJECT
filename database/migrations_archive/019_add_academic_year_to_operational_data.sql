-- Migration 019: keep operational records explicitly scoped to an academic year
ALTER TABLE attendance_sessions ADD COLUMN academic_year_id VARCHAR(64) NULL;
ALTER TABLE lesson_plans ADD COLUMN academic_year_id VARCHAR(64) NULL;
ALTER TABLE session_photos ADD COLUMN academic_year_id VARCHAR(64) NULL;
ALTER TABLE finance_entries ADD COLUMN academic_year_id VARCHAR(64) NULL;
ALTER TABLE approvals ADD COLUMN academic_year_id VARCHAR(64) NULL;
ALTER TABLE session_reports ADD COLUMN academic_year_id VARCHAR(64) NULL;
ALTER TABLE date_change_requests ADD COLUMN academic_year_id VARCHAR(64) NULL;
ALTER TABLE session_submissions ADD COLUMN academic_year_id VARCHAR(64) NULL;

CREATE INDEX idx_attendance_year ON attendance_sessions(academic_year_id);
CREATE INDEX idx_lesson_plans_year ON lesson_plans(academic_year_id);
CREATE INDEX idx_session_photos_year ON session_photos(academic_year_id);
CREATE INDEX idx_finance_year ON finance_entries(academic_year_id);
CREATE INDEX idx_approvals_year ON approvals(academic_year_id);
CREATE INDEX idx_session_reports_year ON session_reports(academic_year_id);
CREATE INDEX idx_date_change_requests_year ON date_change_requests(academic_year_id);
CREATE INDEX idx_session_submissions_year ON session_submissions(academic_year_id);

-- Backfill records already linked to a session without changing master data.
UPDATE attendance_sessions a INNER JOIN sessions s ON s.id = a.session_id
SET a.academic_year_id = s.academic_year_id WHERE a.academic_year_id IS NULL;
UPDATE lesson_plans l INNER JOIN sessions s ON s.id = l.session_id
SET l.academic_year_id = s.academic_year_id WHERE l.academic_year_id IS NULL;
UPDATE session_photos p INNER JOIN sessions s ON s.id = p.session_id
SET p.academic_year_id = s.academic_year_id WHERE p.academic_year_id IS NULL;
UPDATE finance_entries f INNER JOIN sessions s ON s.id = f.session_id
SET f.academic_year_id = s.academic_year_id WHERE f.academic_year_id IS NULL;
UPDATE session_reports r INNER JOIN sessions s ON s.id = r.session_id
SET r.academic_year_id = s.academic_year_id WHERE r.academic_year_id IS NULL;
UPDATE date_change_requests d INNER JOIN sessions s ON s.id = d.session_id
SET d.academic_year_id = s.academic_year_id WHERE d.academic_year_id IS NULL;
UPDATE session_submissions x INNER JOIN sessions s ON s.id = x.session_id
SET x.academic_year_id = s.academic_year_id WHERE x.academic_year_id IS NULL;