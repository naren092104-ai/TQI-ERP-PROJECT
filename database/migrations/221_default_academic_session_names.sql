-- Set the active academic year to the standard curriculum shown in the app.
-- For inactive years, fill only blank slots so historical plans remain intact.
UPDATE academic_setup AS setup
LEFT JOIN academic_years AS active_year
  ON active_year.id = setup.academic_year_id
  AND active_year.is_active = 1
  AND UPPER(COALESCE(active_year.status, 'ACTIVE')) = 'ACTIVE'
SET setup.session_name = CASE setup.day_number
  WHEN 1 THEN 'Parents Meet'
  WHEN 2 THEN 'Know Your Locality'
  WHEN 3 THEN 'Books to Bytes'
  WHEN 4 THEN 'Sports'
  WHEN 5 THEN 'Science'
  WHEN 6 THEN 'Art Education'
  WHEN 7 THEN 'Constitution'
  WHEN 8 THEN 'Tinkering Session'
  ELSE setup.session_name
END
WHERE setup.day_number BETWEEN 1 AND 8
  AND (
    active_year.id IS NOT NULL
    OR COALESCE(TRIM(setup.session_name), '') = ''
  );