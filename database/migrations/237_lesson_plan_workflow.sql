ALTER TABLE lesson_plans MODIFY status VARCHAR(40) NOT NULL DEFAULT 'Draft';
ALTER TABLE lesson_plans ADD COLUMN submitted_by VARCHAR(64) NULL;
ALTER TABLE lesson_plans ADD COLUMN submitted_at DATETIME NULL;
ALTER TABLE lesson_plans ADD COLUMN approved_by VARCHAR(64) NULL;
ALTER TABLE lesson_plans ADD COLUMN approved_at DATETIME NULL;
ALTER TABLE lesson_plans ADD COLUMN correction_reason TEXT NULL;
ALTER TABLE lesson_plans ADD COLUMN edit_request_reason TEXT NULL;
ALTER TABLE lesson_plans ADD COLUMN delete_request_reason TEXT NULL;
ALTER TABLE lesson_plans ADD COLUMN village_id VARCHAR(64) NULL AFTER panchayat_id;
ALTER TABLE lesson_plans ADD INDEX idx_lesson_plans_village (village_id);
ALTER TABLE lesson_plans ADD CONSTRAINT fk_lesson_plans_village FOREIGN KEY (village_id) REFERENCES villages(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE lesson_plans ADD INDEX idx_lesson_plans_status (status);

UPDATE lesson_plans
SET status = 'Corrections Required',
		correction_reason = COALESCE(correction_reason, CASE
			WHEN JSON_VALID(remarks) THEN JSON_UNQUOTE(JSON_EXTRACT(remarks, '$.correctionReason'))
			ELSE NULL
		END)
WHERE status = 'Rejected';

INSERT INTO approvals (id, module, status, requested_by, session_id, academic_year_id, remarks, date, cluster_id, record_id)
SELECT CONCAT('lp-migr-', LEFT(SHA2(lesson_plans.id, 256), 32)), 'Lesson Plan', 'Pending',
			 lesson_plans.submitted_by, NULL, lesson_plans.academic_year_id, NULL, DATE(lesson_plans.updated_at),
			 lesson_plans.cluster_id, lesson_plans.id
FROM lesson_plans
WHERE lesson_plans.status = 'Submitted'
	AND NOT EXISTS (
		SELECT 1 FROM approvals
		WHERE approvals.module = 'Lesson Plan'
			AND approvals.record_id = lesson_plans.id
			AND approvals.academic_year_id = lesson_plans.academic_year_id
			AND approvals.status = 'Pending'
	);