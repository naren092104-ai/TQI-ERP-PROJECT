-- Migration 012: Fix Schema Drift
-- Reconciles modules (005 vs 007), approvals (code vs schema), and adds missing FK columns

-- ============================================================
-- 1. Fix `modules` table: Add columns from migration 007 that
--    were silently skipped due to CREATE TABLE IF NOT EXISTS
-- ============================================================

-- Helper procedure for safe ADD COLUMN (MySQL doesn't support IF NOT EXISTS on ALTER TABLE ADD COLUMN)
DROP PROCEDURE IF EXISTS _tqi_add_column_if_missing;
DELIMITER //
CREATE PROCEDURE _tqi_add_column_if_missing(
    IN p_table VARCHAR(64),
    IN p_column VARCHAR(64),
    IN p_definition VARCHAR(512)
)
BEGIN
    SET @col_exists = 0;
    SELECT COUNT(*) INTO @col_exists
      FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = p_table
       AND COLUMN_NAME  = p_column;

    IF @col_exists = 0 THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //
DELIMITER ;

-- modules: add missing columns from migration 007
CALL _tqi_add_column_if_missing('modules', 'module_number',  "VARCHAR(50) NULL AFTER `id`");
CALL _tqi_add_column_if_missing('modules', 'module_name',    "VARCHAR(255) NULL AFTER `module_number`");
CALL _tqi_add_column_if_missing('modules', 'topic',          "VARCHAR(255) NULL");
CALL _tqi_add_column_if_missing('modules', 'academic_year',  "VARCHAR(50) NULL");
CALL _tqi_add_column_if_missing('modules', 'day_number',     "INT NULL");
CALL _tqi_add_column_if_missing('modules', 'status',         "VARCHAR(64) NOT NULL DEFAULT 'Active'");
CALL _tqi_add_column_if_missing('modules', 'created_by',     "VARCHAR(64) NULL");
CALL _tqi_add_column_if_missing('modules', 'updated_at',     "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

-- modules: add indexes if missing
CREATE INDEX idx_modules_status ON modules(status);
CREATE INDEX idx_modules_day    ON modules(day_number);
-- (These will error silently if already exist; migration runner handles this)

-- ============================================================
-- 2. Fix `approvals` table: Reconcile code vs schema
--    Code uses: type, reference, requestedBy, sessionId, remarks, date
--    Schema has: module, record_id, requested_by, cluster_id
-- ============================================================

CALL _tqi_add_column_if_missing('approvals', 'type',          "VARCHAR(64) NULL");
CALL _tqi_add_column_if_missing('approvals', 'reference',     "VARCHAR(64) NULL");
CALL _tqi_add_column_if_missing('approvals', 'requestedBy',   "VARCHAR(64) NULL");
CALL _tqi_add_column_if_missing('approvals', 'sessionId',     "VARCHAR(64) NULL");
CALL _tqi_add_column_if_missing('approvals', 'remarks',       "TEXT NULL");
CALL _tqi_add_column_if_missing('approvals', 'date',          "DATE NULL");
CALL _tqi_add_column_if_missing('approvals', 'clusterId',     "VARCHAR(64) NULL");
CALL _tqi_add_column_if_missing('approvals', 'reviewed_by',   "VARCHAR(64) NULL");
CALL _tqi_add_column_if_missing('approvals', 'reviewed_at',   "TIMESTAMP NULL");

-- ============================================================
-- 3. Add `session_id` to `finance_entries` for session linkage
-- ============================================================

CALL _tqi_add_column_if_missing('finance_entries', 'session_id', "VARCHAR(64) NULL");
CREATE INDEX idx_finance_session ON finance_entries(session_id);

-- ============================================================
-- 4. Add `village_id` to `volunteers` (referenced in flow)
-- ============================================================

CALL _tqi_add_column_if_missing('volunteers', 'village_id', "VARCHAR(64) NULL");
CREATE INDEX idx_volunteers_village ON volunteers(village_id);

-- ============================================================
-- 5. Fix `module_resources` table: add missing columns from 007
-- ============================================================

CALL _tqi_add_column_if_missing('module_resources', 'original_file_name', "VARCHAR(255) NULL");
CALL _tqi_add_column_if_missing('module_resources', 'file_path',          "VARCHAR(500) NULL");
CALL _tqi_add_column_if_missing('module_resources', 'file_url',           "VARCHAR(500) NULL");
CALL _tqi_add_column_if_missing('module_resources', 'file_size',          "BIGINT NULL");
CALL _tqi_add_column_if_missing('module_resources', 'storage_provider',   "VARCHAR(50) DEFAULT 'local'");
CALL _tqi_add_column_if_missing('module_resources', 'drive_file_id',      "VARCHAR(255) NULL");
CALL _tqi_add_column_if_missing('module_resources', 'drive_folder_id',    "VARCHAR(255) NULL");
CALL _tqi_add_column_if_missing('module_resources', 'updated_at',         "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

-- Cleanup helper
DROP PROCEDURE IF EXISTS _tqi_add_column_if_missing;
