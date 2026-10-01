-- Remove only the unused legacy seed year when another active academic year remains.
-- This also handles its historical inconsistent state (DRAFT status + is_active=1).
DELETE FROM academic_years
WHERE id = 'ay-2025-2026'
  AND name = '2025-2026'
  AND EXISTS (
    SELECT 1 FROM (
      SELECT id, status, is_active FROM academic_years WHERE id <> 'ay-2025-2026'
    ) current_year
    WHERE current_year.status = 'ACTIVE' AND current_year.is_active = 1
  )
  AND NOT EXISTS (SELECT 1 FROM academic_setup WHERE academic_year_id = 'ay-2025-2026')
  AND NOT EXISTS (SELECT 1 FROM clusters WHERE academic_year_id = 'ay-2025-2026')
  AND NOT EXISTS (SELECT 1 FROM panchayats WHERE academic_year_id = 'ay-2025-2026')
  AND NOT EXISTS (SELECT 1 FROM villages WHERE academic_year_id = 'ay-2025-2026')
  AND NOT EXISTS (SELECT 1 FROM students WHERE academic_year_id = 'ay-2025-2026')
  AND NOT EXISTS (SELECT 1 FROM volunteers WHERE academic_year_id = 'ay-2025-2026')
  AND NOT EXISTS (SELECT 1 FROM schools WHERE academic_year_id = 'ay-2025-2026')
  AND NOT EXISTS (SELECT 1 FROM sessions WHERE academic_year_id = 'ay-2025-2026')
  AND NOT EXISTS (SELECT 1 FROM modules WHERE academic_year_id = 'ay-2025-2026')
  AND NOT EXISTS (SELECT 1 FROM attendance_sessions WHERE academic_year_id = 'ay-2025-2026')
  AND NOT EXISTS (SELECT 1 FROM lesson_plans WHERE academic_year_id = 'ay-2025-2026')
  AND NOT EXISTS (SELECT 1 FROM session_photos WHERE academic_year_id = 'ay-2025-2026')
  AND NOT EXISTS (SELECT 1 FROM session_reports WHERE academic_year_id = 'ay-2025-2026')
  AND NOT EXISTS (SELECT 1 FROM finance_entries WHERE academic_year_id = 'ay-2025-2026')
  AND NOT EXISTS (SELECT 1 FROM approvals WHERE academic_year_id = 'ay-2025-2026')
  AND NOT EXISTS (SELECT 1 FROM date_change_requests WHERE academic_year_id = 'ay-2025-2026')
  AND NOT EXISTS (SELECT 1 FROM session_submissions WHERE academic_year_id = 'ay-2025-2026');
