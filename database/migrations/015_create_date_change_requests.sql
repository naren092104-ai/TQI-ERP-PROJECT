-- Migration 015: Create Date Change Requests Table
-- Tracks session date change requests from Cluster Admin → Super Admin review

CREATE TABLE IF NOT EXISTS `date_change_requests` (
    `id`               VARCHAR(64)   NOT NULL,
    `session_id`       VARCHAR(64)   NOT NULL,
    `cluster_id`       VARCHAR(64)   NOT NULL,
    `day_number`       INT           NULL,
    `original_date`    DATE          NOT NULL,
    `requested_date`   DATE          NOT NULL,
    `reason`           TEXT          NOT NULL,
    `status`           VARCHAR(64)   NOT NULL DEFAULT 'PENDING',
    `reviewed_by`      VARCHAR(64)   NULL,
    `review_remarks`   TEXT          NULL,
    `reviewed_at`      TIMESTAMP     NULL,
    `requested_by`     VARCHAR(64)   NOT NULL,
    `created_at`       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_dcr_session`  (`session_id`),
    INDEX `idx_dcr_cluster`  (`cluster_id`),
    INDEX `idx_dcr_status`   (`status`),
    INDEX `idx_dcr_requested_by` (`requested_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
