-- Migration 014: Create Session Reports Table
-- Stores structured activity reports per session/day

CREATE TABLE IF NOT EXISTS `session_reports` (
    `id`                  VARCHAR(64)   NOT NULL,
    `session_id`          VARCHAR(64)   NOT NULL,
    `cluster_id`          VARCHAR(64)   NOT NULL,
    `day_number`          INT           NULL,
    `session_summary`     TEXT          NULL,
    `student_count`       INT           NULL DEFAULT 0,
    `attendance_summary`  TEXT          NULL,
    `activities`          TEXT          NULL,
    `issues`              TEXT          NULL,
    `remarks`             TEXT          NULL,
    `status`              VARCHAR(64)   NOT NULL DEFAULT 'DRAFT',
    `created_by`          VARCHAR(64)   NULL,
    `created_at`          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_session_reports_session` (`session_id`),
    INDEX `idx_session_reports_cluster` (`cluster_id`),
    INDEX `idx_session_reports_day`     (`day_number`),
    INDEX `idx_session_reports_status`  (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
