-- Normalize legacy uppercase role enums to the canonical values used by the application.
-- Expand first so existing legacy values remain valid while they are converted.
ALTER TABLE users MODIFY COLUMN role ENUM('Super Admin', 'Cluster Admin', 'SUPER_ADMIN', 'CLUSTER_ADMIN') NOT NULL;

UPDATE users
SET role = CASE UPPER(REPLACE(role, ' ', '_'))
  WHEN 'SUPER_ADMIN' THEN 'Super Admin'
  WHEN 'CLUSTER_ADMIN' THEN 'Cluster Admin'
  ELSE role
END;

ALTER TABLE users MODIFY COLUMN role ENUM('Super Admin', 'Cluster Admin') NOT NULL;
