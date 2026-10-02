-- Repair the legacy Dharmapuri panchayat/village links where old IDs were written.
-- The update only runs when exactly one active Dharmapuri Vedakattamaduvu
-- panchayat exists for that academic year.
UPDATE villages v
JOIN (
  SELECT p.academic_year_id, MIN(p.id) AS panchayat_id, MIN(p.cluster_id) AS cluster_id
  FROM panchayats p
  JOIN clusters c
    ON c.id = p.cluster_id
   AND c.academic_year_id = p.academic_year_id
  WHERE LOWER(TRIM(p.name)) = 'vedakattamaduvu'
    AND LOWER(TRIM(c.name)) = 'dharmapuri'
    AND UPPER(COALESCE(c.status, 'ACTIVE')) = 'ACTIVE'
  GROUP BY p.academic_year_id
  HAVING COUNT(*) = 1
) canonical
  ON canonical.academic_year_id = v.academic_year_id
SET v.panchayat_id = canonical.panchayat_id,
    v.cluster_id = canonical.cluster_id
WHERE LOWER(TRIM(v.name)) = 'ammapettai'
  AND v.panchayat_id = 'vedakattamaduvu'
  AND v.cluster_id = 'all';

-- Drop the legacy duplicate only when its canonical counterpart exists and no
-- dependent row references the legacy panchayat ID.
DELETE legacy
FROM panchayats legacy
JOIN clusters c
  ON c.academic_year_id = legacy.academic_year_id
 AND LOWER(TRIM(c.name)) = 'dharmapuri'
 AND UPPER(COALESCE(c.status, 'ACTIVE')) = 'ACTIVE'
JOIN panchayats canonical
  ON canonical.academic_year_id = legacy.academic_year_id
 AND canonical.cluster_id = c.id
 AND LOWER(TRIM(canonical.name)) = 'vedakattamaduvu'
WHERE LOWER(TRIM(legacy.name)) = 'vedakattamaduvu'
  AND legacy.cluster_id = 'dharmapuri-ksr'
  AND legacy.id <> canonical.id
  AND NOT EXISTS (SELECT 1 FROM attendance_sessions r WHERE r.panchayat_id = legacy.id)
  AND NOT EXISTS (SELECT 1 FROM lesson_plans r WHERE r.panchayat_id = legacy.id)
  AND NOT EXISTS (SELECT 1 FROM schools r WHERE r.panchayat_id = legacy.id)
  AND NOT EXISTS (SELECT 1 FROM sessions r WHERE r.panchayat_id = legacy.id)
  AND NOT EXISTS (SELECT 1 FROM sessions r WHERE r.panchayatId = legacy.id)
  AND NOT EXISTS (SELECT 1 FROM students r WHERE r.panchayat_id = legacy.id)
  AND NOT EXISTS (SELECT 1 FROM villages r WHERE r.panchayat_id = legacy.id)
  AND NOT EXISTS (SELECT 1 FROM volunteers r WHERE r.panchayat_id = legacy.id);
