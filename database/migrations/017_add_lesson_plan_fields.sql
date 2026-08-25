-- Migration 017: Add Rich Lesson Plan Fields
-- Adds structured fields for the full lesson plan form

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

-- Add rich fields to lesson_plans
CALL _tqi_add_column_if_missing('lesson_plans', 'topic',             "VARCHAR(255) NULL");
CALL _tqi_add_column_if_missing('lesson_plans', 'objective',         "TEXT NULL");
CALL _tqi_add_column_if_missing('lesson_plans', 'activities',        "TEXT NULL");
CALL _tqi_add_column_if_missing('lesson_plans', 'materials',         "TEXT NULL");
CALL _tqi_add_column_if_missing('lesson_plans', 'duration',          "VARCHAR(100) NULL");
CALL _tqi_add_column_if_missing('lesson_plans', 'remarks',           "TEXT NULL");
CALL _tqi_add_column_if_missing('lesson_plans', 'teaching_method',   "VARCHAR(255) NULL");
CALL _tqi_add_column_if_missing('lesson_plans', 'assessment_task',   "TEXT NULL");
CALL _tqi_add_column_if_missing('lesson_plans', 'target_standard',   "VARCHAR(100) NULL");
CALL _tqi_add_column_if_missing('lesson_plans', 'learning_outcomes', "TEXT NULL");
CALL _tqi_add_column_if_missing('lesson_plans', 'day_number',        "INT NULL");
CALL _tqi_add_column_if_missing('lesson_plans', 'volunteer_id',      "VARCHAR(64) NULL");

-- Cleanup helper
DROP PROCEDURE IF EXISTS _tqi_add_column_if_missing;
