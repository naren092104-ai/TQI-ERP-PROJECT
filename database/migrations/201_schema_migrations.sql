-- TQI-ERP v2: schema_migrations
-- Version tracking table for the migration runner.
-- Recorded by backend/src/server.ts:runSqlFiles after each .sql file is applied.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    VARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
