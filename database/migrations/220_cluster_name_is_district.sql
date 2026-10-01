-- In TQI's location hierarchy the cluster name is the district context.
-- Preserve college_district separately and do not use it as the Cluster/District label.
UPDATE clusters
SET district = TRIM(name)
WHERE name IS NOT NULL
  AND TRIM(name) <> ''
  AND (district IS NULL OR TRIM(district) <> TRIM(name));