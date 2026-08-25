-- Migration 013: Create Academic Years Table
-- Dedicated table for defining academic year cycles

CREATE TABLE IF NOT EXISTS `academic_years` (
    `id`          VARCHAR(64)   NOT NULL,
    `name`        VARCHAR(100)  NOT NULL,
    `start_date`  DATE          NULL,
    `end_date`    DATE          NULL,
    `is_active`   BOOLEAN       NOT NULL DEFAULT FALSE,
    `created_by`  VARCHAR(64)   NULL,
    `created_at`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_academic_years_name` (`name`),
    INDEX `idx_academic_years_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed the current academic year
INSERT INTO `academic_years` (`id`, `name`, `start_date`, `end_date`, `is_active`, `created_by`)
VALUES ('ay-2025-2026', '2025-2026', '2025-06-01', '2026-05-31', TRUE, 'usr-super-admin')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
