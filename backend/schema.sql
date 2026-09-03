-- ====================================================================
-- TQI ERP Master Database Initialization Script
-- Compatible with MySQL 5.7+ / 8.0+ / MariaDB
-- ====================================================================

CREATE DATABASE IF NOT EXISTS `TQI_ERP` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `TQI_ERP`;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('SUPER_ADMIN','CLUSTER_ADMIN') NOT NULL,
  `cluster_id` VARCHAR(64) NULL,
  `phone` VARCHAR(50) NULL,
  `must_change_password` BOOLEAN NOT NULL DEFAULT FALSE,
  `status` ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_cluster` (`cluster_id`),
  INDEX `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Clusters Table
CREATE TABLE IF NOT EXISTS `clusters` (
  `id` VARCHAR(64) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `district` VARCHAR(255) NULL,
  `state` VARCHAR(255) NULL,
  `code` VARCHAR(64) NULL,
  `college_name` VARCHAR(255) NULL,
  `spoc_name` VARCHAR(255) NULL,
  `spoc_mobile` VARCHAR(50) NULL,
  `admin_id` VARCHAR(64) NULL,
  `status` ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Panchayats Table
CREATE TABLE IF NOT EXISTS `panchayats` (
  `id` VARCHAR(64) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `cluster_id` VARCHAR(64) NOT NULL,
  `status` VARCHAR(64) NOT NULL DEFAULT 'ACTIVE',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_panchayats_cluster` (`cluster_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Villages Table
CREATE TABLE IF NOT EXISTS `villages` (
  `id` VARCHAR(64) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `panchayat_id` VARCHAR(64) NOT NULL,
  `cluster_id` VARCHAR(64) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_villages_panchayat` (`panchayat_id`),
  INDEX `idx_villages_cluster` (`cluster_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Students Table
CREATE TABLE IF NOT EXISTS `students` (
  `id` VARCHAR(64) PRIMARY KEY,
  `code` VARCHAR(64) NULL,
  `name` VARCHAR(255) NOT NULL,
  `gender` ENUM('male','female','other') NULL,
  `dob` DATE NULL,
  `standard` VARCHAR(100) NULL,
  `cluster_id` VARCHAR(64) NOT NULL,
  `panchayat_id` VARCHAR(64) NOT NULL,
  `village_id` VARCHAR(64) NOT NULL,
  `parent_name` VARCHAR(255) NULL,
  `phone` VARCHAR(50) NULL,
  `status` ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_students_cluster` (`cluster_id`),
  INDEX `idx_students_panchayat` (`panchayat_id`),
  INDEX `idx_students_village` (`village_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Volunteers Table
CREATE TABLE IF NOT EXISTS `volunteers` (
  `id` VARCHAR(64) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NULL,
  `phone` VARCHAR(50) NULL,
  `cluster_id` VARCHAR(64) NOT NULL,
  `panchayat_id` VARCHAR(64) NULL,
  `village_id` VARCHAR(64) NULL,
  `department` VARCHAR(255) NULL,
  `role` VARCHAR(64) NULL,
  `status` ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_volunteers_cluster` (`cluster_id`),
  INDEX `idx_volunteers_panchayat` (`panchayat_id`),
  INDEX `idx_volunteers_village` (`village_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Sessions Table
CREATE TABLE IF NOT EXISTS `sessions` (
  `id` VARCHAR(64) PRIMARY KEY,
  `code` VARCHAR(64) NULL,
  `title` VARCHAR(255) NULL,
  `name` VARCHAR(255) NULL,
  `module_id` VARCHAR(64) NULL,
  `cluster_id` VARCHAR(64) NULL,
  `clusterId` VARCHAR(64) NULL,
  `academic_year` VARCHAR(50) NULL,
  `day_number` INT NULL,
  `session_name_snapshot` VARCHAR(255) NULL,
  `panchayat_id` VARCHAR(64) NULL,
  `panchayatId` VARCHAR(64) NULL,
  `village_id` VARCHAR(64) NULL,
  `villageId` VARCHAR(64) NULL,
  `volunteer_id` VARCHAR(64) NULL,
  `volunteerId` VARCHAR(64) NULL,
  `date` DATE NOT NULL,
  `time` VARCHAR(50) NULL,
  `endTime` VARCHAR(50) NULL,
  `status` VARCHAR(64) NULL,
  `session_status` VARCHAR(64) NOT NULL DEFAULT 'Draft',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_sessions_cluster` (`cluster_id`),
  INDEX `idx_sessions_panchayat` (`panchayat_id`),
  INDEX `idx_sessions_status` (`session_status`),
  INDEX `idx_sessions_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Attendance Sessions Table
CREATE TABLE IF NOT EXISTS `attendance_sessions` (
  `id` VARCHAR(64) PRIMARY KEY,
  `session_id` VARCHAR(64) NOT NULL,
  `cluster_id` VARCHAR(64) NOT NULL,
  `panchayat_id` VARCHAR(64) NULL,
  `village_id` VARCHAR(64) NULL,
  `day_number` INT NOT NULL,
  `status` VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
  `present_count` INT NOT NULL DEFAULT 0,
  `total_count` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_attendance_session` (`session_id`),
  INDEX `idx_attendance_cluster` (`cluster_id`),
  INDEX `idx_attendance_day` (`day_number`),
  INDEX `idx_attendance_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Student Attendance Table
CREATE TABLE IF NOT EXISTS `student_attendance` (
  `id` VARCHAR(64) PRIMARY KEY,
  `attendance_session_id` VARCHAR(64) NOT NULL,
  `student_id` VARCHAR(64) NOT NULL,
  `present` BOOLEAN NOT NULL DEFAULT TRUE,
  `task_status` VARCHAR(64) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_student_attendance_session` (`attendance_session_id`),
  INDEX `idx_student_attendance_student` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Volunteer Attendance Table
CREATE TABLE IF NOT EXISTS `volunteer_attendance` (
  `id` VARCHAR(64) PRIMARY KEY,
  `attendance_session_id` VARCHAR(64) NOT NULL,
  `volunteer_id` VARCHAR(64) NOT NULL,
  `present` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_volunteer_attendance_session` (`attendance_session_id`),
  INDEX `idx_volunteer_attendance_volunteer` (`volunteer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Lesson Plans Table
CREATE TABLE IF NOT EXISTS `lesson_plans` (
  `id` VARCHAR(64) PRIMARY KEY,
  `session_id` VARCHAR(64) NULL,
  `module_id` VARCHAR(64) NULL,
  `cluster_id` VARCHAR(64) NOT NULL,
  `panchayat_id` VARCHAR(64) NULL,
  `title` VARCHAR(255) NOT NULL,
  `topic` VARCHAR(255) NULL,
  `objective` TEXT NULL,
  `activities` TEXT NULL,
  `materials` TEXT NULL,
  `duration` VARCHAR(100) NULL,
  `remarks` TEXT NULL,
  `teaching_method` VARCHAR(255) NULL,
  `assessment_task` TEXT NULL,
  `target_standard` VARCHAR(100) NULL,
  `learning_outcomes` TEXT NULL,
  `day_number` INT NULL,
  `volunteer_id` VARCHAR(64) NULL,
  `status` VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
  `created_by` VARCHAR(64) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_lesson_plans_cluster` (`cluster_id`),
  INDEX `idx_lesson_plans_session` (`session_id`),
  INDEX `idx_lesson_plans_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Session Photos Table
CREATE TABLE IF NOT EXISTS `session_photos` (
  `id` VARCHAR(64) PRIMARY KEY,
  `cluster_id` VARCHAR(64) NOT NULL,
  `session_id` VARCHAR(64) NULL,
  `day_number` INT NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `file_url` VARCHAR(500) NOT NULL,
  `original_filename` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NULL,
  `file_size` BIGINT NULL,
  `uploaded_by` VARCHAR(64) NULL,
  `uploaded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_session_photos_cluster` (`cluster_id`),
  INDEX `idx_session_photos_session` (`session_id`),
  INDEX `idx_session_photos_day` (`day_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Finance Entries Table
CREATE TABLE IF NOT EXISTS `finance_entries` (
  `id` VARCHAR(64) PRIMARY KEY,
  `cluster_id` VARCHAR(64) NOT NULL,
  `session_id` VARCHAR(64) NULL,
  `date` DATE NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `created_by` VARCHAR(64) NULL,
  `status` VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
  `bill_reference` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_finance_cluster` (`cluster_id`),
  INDEX `idx_finance_status` (`status`),
  INDEX `idx_finance_date` (`date`),
  INDEX `idx_finance_session` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Finance Drafts Table
CREATE TABLE IF NOT EXISTS `finance_drafts` (
  `id` VARCHAR(64) PRIMARY KEY,
  `cluster_id` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `session_date` DATE NULL,
  `total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `status` VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
  `created_by` VARCHAR(64) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_finance_drafts_cluster` (`cluster_id`),
  INDEX `idx_finance_drafts_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Correction Requests Table
CREATE TABLE IF NOT EXISTS `correction_requests` (
  `id` VARCHAR(64) PRIMARY KEY,
  `module` VARCHAR(64) NOT NULL,
  `record_id` VARCHAR(64) NOT NULL,
  `reason` TEXT NOT NULL,
  `requested_by` VARCHAR(64) NOT NULL,
  `requested_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `status` VARCHAR(64) NOT NULL DEFAULT 'PENDING',
  `cluster_id` VARCHAR(64) NULL,
  INDEX `idx_correction_module` (`module`),
  INDEX `idx_correction_status` (`status`),
  INDEX `idx_correction_cluster` (`cluster_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Approvals Table
CREATE TABLE IF NOT EXISTS `approvals` (
  `id` VARCHAR(64) PRIMARY KEY,
  `module` VARCHAR(64) NULL,
  `type` VARCHAR(64) NULL,
  `reference` VARCHAR(64) NULL,
  `record_id` VARCHAR(64) NULL,
  `status` VARCHAR(64) NOT NULL DEFAULT 'PENDING',
  `requested_by` VARCHAR(64) NULL,
  `requestedBy` VARCHAR(64) NULL,
  `sessionId` VARCHAR(64) NULL,
  `remarks` TEXT NULL,
  `date` DATE NULL,
  `cluster_id` VARCHAR(64) NULL,
  `clusterId` VARCHAR(64) NULL,
  `reviewed_by` VARCHAR(64) NULL,
  `reviewed_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_approvals_module` (`module`),
  INDEX `idx_approvals_status` (`status`),
  INDEX `idx_approvals_cluster` (`cluster_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. Notifications Table
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` VARCHAR(64) PRIMARY KEY,
  `user_id` VARCHAR(64) NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `type` VARCHAR(64) NOT NULL,
  `is_read` BOOLEAN NOT NULL DEFAULT FALSE,
  `action_tab` VARCHAR(64) NULL,
  `target_id` VARCHAR(64) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_notifications_user` (`user_id`),
  INDEX `idx_notifications_read` (`is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. Audit Logs Table
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(64) PRIMARY KEY,
  `user_id` VARCHAR(64) NULL,
  `user_name` VARCHAR(255) NULL,
  `role` VARCHAR(64) NULL,
  `cluster_id` VARCHAR(64) NULL,
  `action` VARCHAR(255) NOT NULL,
  `module` VARCHAR(128) NULL,
  `entity_type` VARCHAR(128) NULL,
  `record_id` VARCHAR(64) NULL,
  `entity_id` VARCHAR(64) NULL,
  `details` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_audit_cluster` (`cluster_id`),
  INDEX `idx_audit_module` (`module`),
  INDEX `idx_audit_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. Modules Table
CREATE TABLE IF NOT EXISTS `modules` (
  `id` VARCHAR(64) PRIMARY KEY,
  `module_number` VARCHAR(50) NULL,
  `name` VARCHAR(255) NULL,
  `module_name` VARCHAR(255) NULL,
  `code` VARCHAR(64) NULL,
  `topic` VARCHAR(255) NULL,
  `description` TEXT NULL,
  `academic_year` VARCHAR(50) NULL,
  `day_number` INT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `status` VARCHAR(64) NOT NULL DEFAULT 'Active',
  `created_by` VARCHAR(64) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_modules_status` (`status`),
  INDEX `idx_modules_day` (`day_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. Module Resources Table
CREATE TABLE IF NOT EXISTS `module_resources` (
  `id` VARCHAR(64) PRIMARY KEY,
  `module_id` VARCHAR(64) NOT NULL,
  `file_name` VARCHAR(255) NULL,
  `original_file_name` VARCHAR(255) NULL,
  `original_filename` VARCHAR(255) NULL,
  `file_path` VARCHAR(500) NULL,
  `file_url` VARCHAR(500) NULL,
  `drive_url` VARCHAR(500) NULL,
  `mime_type` VARCHAR(100) NULL,
  `file_size` BIGINT NULL,
  `storage_provider` VARCHAR(50) DEFAULT 'local',
  `drive_file_id` VARCHAR(255) NULL,
  `drive_folder_id` VARCHAR(255) NULL,
  `last_modified` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_module_resources_module` (`module_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. Auth OTPs Table
CREATE TABLE IF NOT EXISTS `auth_otps` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL,
  `otp_hash` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `attempts` INT NOT NULL DEFAULT 0,
  `used_at` DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_auth_otps_email_created` (`email`, `created_at`),
  INDEX `idx_auth_otps_expiry` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 22. Academic Setup Table
CREATE TABLE IF NOT EXISTS `academic_setup` (
  `day_number` INT PRIMARY KEY,
  `academic_year` VARCHAR(50) NOT NULL,
  `session_name` VARCHAR(255) NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 23. Academic Years Table
CREATE TABLE IF NOT EXISTS `academic_years` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `start_date` DATE NULL,
  `end_date` DATE NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_by` VARCHAR(64) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_academic_years_name` (`name`),
  INDEX `idx_academic_years_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 24. Session Reports Table
CREATE TABLE IF NOT EXISTS `session_reports` (
  `id` VARCHAR(64) NOT NULL,
  `session_id` VARCHAR(64) NOT NULL,
  `cluster_id` VARCHAR(64) NOT NULL,
  `day_number` INT NULL,
  `session_summary` TEXT NULL,
  `student_count` INT NULL DEFAULT 0,
  `attendance_summary` TEXT NULL,
  `activities` TEXT NULL,
  `issues` TEXT NULL,
  `remarks` TEXT NULL,
  `status` VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
  `created_by` VARCHAR(64) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_session_reports_session` (`session_id`),
  INDEX `idx_session_reports_cluster` (`cluster_id`),
  INDEX `idx_session_reports_day` (`day_number`),
  INDEX `idx_session_reports_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 25. Date Change Requests Table
CREATE TABLE IF NOT EXISTS `date_change_requests` (
  `id` VARCHAR(64) NOT NULL,
  `session_id` VARCHAR(64) NOT NULL,
  `cluster_id` VARCHAR(64) NOT NULL,
  `day_number` INT NULL,
  `original_date` DATE NOT NULL,
  `requested_date` DATE NOT NULL,
  `reason` TEXT NOT NULL,
  `status` VARCHAR(64) NOT NULL DEFAULT 'PENDING',
  `reviewed_by` VARCHAR(64) NULL,
  `review_remarks` TEXT NULL,
  `reviewed_at` TIMESTAMP NULL,
  `requested_by` VARCHAR(64) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_dcr_session` (`session_id`),
  INDEX `idx_dcr_cluster` (`cluster_id`),
  INDEX `idx_dcr_status` (`status`),
  INDEX `idx_dcr_requested_by` (`requested_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 26. Session Submissions Table
CREATE TABLE IF NOT EXISTS `session_submissions` (
  `id` VARCHAR(64) NOT NULL,
  `session_id` VARCHAR(64) NOT NULL,
  `cluster_id` VARCHAR(64) NOT NULL,
  `day_number` INT NOT NULL,
  `attendance_complete` BOOLEAN NOT NULL DEFAULT FALSE,
  `lesson_plan_complete` BOOLEAN NOT NULL DEFAULT FALSE,
  `photos_complete` BOOLEAN NOT NULL DEFAULT FALSE,
  `report_complete` BOOLEAN NOT NULL DEFAULT FALSE,
  `finance_complete` BOOLEAN NOT NULL DEFAULT FALSE,
  `status` VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
  `submitted_at` TIMESTAMP NULL,
  `submitted_by` VARCHAR(64) NULL,
  `reviewed_by` VARCHAR(64) NULL,
  `reviewed_at` TIMESTAMP NULL,
  `review_remarks` TEXT NULL,
  `resubmission_reason` TEXT NULL,
  `resubmitted_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_session_submissions_session` (`session_id`, `day_number`),
  INDEX `idx_submissions_cluster` (`cluster_id`),
  INDEX `idx_submissions_status` (`status`),
  INDEX `idx_submissions_day` (`day_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 27. Schema Migrations Table
CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `version` VARCHAR(255) PRIMARY KEY,
  `applied_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ====================================================================
-- Initial Seed Data: Super Admin, Academic Year, and Standard Modules
-- ====================================================================

-- Default Super Admin (password: admin123)
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `cluster_id`, `phone`, `must_change_password`, `status`)
VALUES
  ('usr-super-admin', 'Super Admin', 'admin@tqi.org', '$2b$10$aj/FKfaYSD7AMMrckhHM.O7QWCzClwdCUzjSlHgJOcMWDxsSVsUu2', 'SUPER_ADMIN', NULL, '+91 90000 00000', FALSE, 'ACTIVE'),
  ('usr-admin-alias', 'Super Admin', 'admin', '$2b$10$aj/FKfaYSD7AMMrckhHM.O7QWCzClwdCUzjSlHgJOcMWDxsSVsUu2', 'SUPER_ADMIN', NULL, '+91 90000 00000', FALSE, 'ACTIVE')
ON DUPLICATE KEY UPDATE
  `password_hash` = VALUES(`password_hash`),
  `name` = VALUES(`name`),
  `role` = VALUES(`role`),
  `must_change_password` = FALSE,
  `status` = 'ACTIVE';

-- Default Active Academic Year
INSERT INTO `academic_years` (`id`, `name`, `start_date`, `end_date`, `is_active`, `created_by`)
VALUES ('ay-2025-2026', '2025-2026', '2025-06-01', '2026-05-31', TRUE, 'usr-super-admin')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Default Foundation Modules
INSERT INTO `modules` (`id`, `name`, `code`, `description`, `is_active`)
VALUES
  ('module-english', 'Spoken English', 'ENG-01', 'English communication & vocabulary', TRUE),
  ('module-maths', 'Mathematics Basics', 'MATH-02', 'Foundational arithmetic & problem solving', TRUE),
  ('module-life-skills', 'Life Skills', 'LIFE-03', 'Critical thinking, ethics & leadership', TRUE)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `is_active` = TRUE;
