-- Migration 016: Create Session Submissions Table
-- Tracks the complete session submission lifecycle with validation flags
-- Status flow: DRAFT → SUBMITTED → PENDING_REVIEW → APPROVED/RESUBMISSION_REQUIRED → COMPLETED

CREATE TABLE IF NOT EXISTS `session_submissions` (
    `id`                    VARCHAR(64)   NOT NULL,
    `session_id`            VARCHAR(64)   NOT NULL,
    `cluster_id`            VARCHAR(64)   NOT NULL,
    `day_number`            INT           NOT NULL,

    -- Validation completeness flags
    `attendance_complete`   BOOLEAN       NOT NULL DEFAULT FALSE,
    `lesson_plan_complete`  BOOLEAN       NOT NULL DEFAULT FALSE,
    `photos_complete`       BOOLEAN       NOT NULL DEFAULT FALSE,
    `report_complete`       BOOLEAN       NOT NULL DEFAULT FALSE,
    `finance_complete`      BOOLEAN       NOT NULL DEFAULT FALSE,

    -- Submission status
    `status`                VARCHAR(64)   NOT NULL DEFAULT 'DRAFT',

    -- Submission tracking
    `submitted_at`          TIMESTAMP     NULL,
    `submitted_by`          VARCHAR(64)   NULL,

    -- Review tracking
    `reviewed_by`           VARCHAR(64)   NULL,
    `reviewed_at`           TIMESTAMP     NULL,
    `review_remarks`        TEXT          NULL,

    -- Resubmission tracking
    `resubmission_reason`   TEXT          NULL,
    `resubmitted_at`        TIMESTAMP     NULL,

    `created_at`            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_session_submissions_session` (`session_id`, `day_number`),
    INDEX `idx_submissions_cluster`  (`cluster_id`),
    INDEX `idx_submissions_status`   (`status`),
    INDEX `idx_submissions_day`      (`day_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
