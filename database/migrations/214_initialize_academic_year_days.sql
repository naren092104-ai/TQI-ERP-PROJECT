-- Every persisted academic year has exactly eight day slots, even when the plan is empty.
INSERT IGNORE INTO academic_setup (academic_year_id, day_number, academic_year, session_name, session_date)
SELECT ay.id, days.day_number, ay.name, NULL, NULL
FROM academic_years ay
CROSS JOIN (
  SELECT 1 AS day_number UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
  UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8
) AS days;
