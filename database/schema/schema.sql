-- ====================================================================
-- TQI ERP Master Database Initialization Script (v2 Unified)
-- Compatible with MySQL 5.7+ / 8.0+ / MariaDB
-- ====================================================================

CREATE DATABASE IF NOT EXISTS `TQI_ERP` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `TQI_ERP`;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Clusters Table
CREATE TABLE IF NOT EXISTS `clusters` (
  `id` VARCHAR(64) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `district` VARCHAR(255) NULL,
  `college_district` VARCHAR(255) NULL,
  `state` VARCHAR(255) NULL,
  `code` VARCHAR(64) NULL,
  `college_name` VARCHAR(255) NULL,
  `spoc_name` VARCHAR(255) NULL,
  `spoc_mobile` VARCHAR(50) NULL,
  `admin_id` VARCHAR(64) NULL,
  `status` ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_clusters_name` (`name`),
  INDEX `idx_clusters_status` (`status`),
  INDEX `idx_clusters_admin` (`admin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('Super Admin','Cluster Admin') NOT NULL,
  `cluster_id` VARCHAR(64) NULL,
  `phone` VARCHAR(50) NULL,
  `must_change_password` BOOLEAN NOT NULL DEFAULT FALSE,
  `password_changed_at` DATETIME NULL,
  `password_reset_at` DATETIME NULL,
  `password_reset_by` VARCHAR(64) NULL,
  `password_created_at` DATETIME NULL,
  `status` ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_status` (`status`),
  INDEX `idx_users_cluster` (`cluster_id`),
  INDEX `idx_users_cluster_name` (`cluster_id`, `name`),
  CONSTRAINT `fk_users_cluster`
    FOREIGN KEY (`cluster_id`) REFERENCES `clusters` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_password_history` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(64) NOT NULL,
  `action` ENUM('PASSWORD_CHANGED','PASSWORD_RESET','TEMP_PASSWORD_GENERATED','FORCE_PASSWORD_CHANGE_ENABLED') NOT NULL,
  `changed_by` VARCHAR(64) NULL,
  `changed_by_name` VARCHAR(255) NULL,
  `ip_address` VARCHAR(64) NULL,
  `user_agent` VARCHAR(500) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_password_history_user` (`user_id`, `created_at`),
  CONSTRAINT `fk_password_history_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_password_history_actor` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `clusters`
  ADD CONSTRAINT `fk_clusters_admin`
  FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Panchayats Table
CREATE TABLE IF NOT EXISTS `panchayats` (
  `id` VARCHAR(64) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `cluster_id` VARCHAR(64) NOT NULL,
  `status` ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_panchayats_cluster` (`cluster_id`),
  INDEX `idx_panchayats_cluster_name` (`cluster_id`, `name`),
  CONSTRAINT `fk_panchayats_cluster`
    FOREIGN KEY (`cluster_id`) REFERENCES `clusters` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Villages Table
CREATE TABLE IF NOT EXISTS `villages` (
  `id` VARCHAR(64) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `panchayat_id` VARCHAR(64) NOT NULL,
  `cluster_id` VARCHAR(64) NOT NULL,
  `status` ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_villages_panchayat` (`panchayat_id`),
  INDEX `idx_villages_cluster` (`cluster_id`),
  INDEX `idx_villages_name` (`name`),
  CONSTRAINT `fk_villages_panchayat`
    FOREIGN KEY (`panchayat_id`) REFERENCES `panchayats` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_villages_cluster`
    FOREIGN KEY (`cluster_id`) REFERENCES `clusters` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
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
  `status` ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_students_cluster` (`cluster_id`),
  INDEX `idx_students_panchayat` (`panchayat_id`),
  INDEX `idx_students_village` (`village_id`),
  INDEX `idx_students_cluster_name` (`cluster_id`, `name`),
  CONSTRAINT `fk_students_cluster`
    FOREIGN KEY (`cluster_id`) REFERENCES `clusters` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_students_panchayat`
    FOREIGN KEY (`panchayat_id`) REFERENCES `panchayats` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_students_village`
    FOREIGN KEY (`village_id`) REFERENCES `villages` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Volunteers Table
CREATE TABLE IF NOT EXISTS `volunteers` (
  `id` VARCHAR(64) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `gender` ENUM('male','female','other') NULL,
  `email` VARCHAR(255) NULL,
  `phone` VARCHAR(50) NULL,
  `college_name` VARCHAR(255) NULL,
  `cluster_id` VARCHAR(64) NOT NULL,
  `panchayat_id` VARCHAR(64) NULL,
  `village_id` VARCHAR(64) NULL,
  `department` VARCHAR(255) NULL,
  `study_year` VARCHAR(32) NULL,
  `stream` VARCHAR(100) NULL,
  `passing_out_year` SMALLINT NULL,
  `role` VARCHAR(64) NULL,
  `status` ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_volunteers_cluster` (`cluster_id`),
  INDEX `idx_volunteers_panchayat` (`panchayat_id`),
  INDEX `idx_volunteers_village` (`village_id`),
  INDEX `idx_volunteers_cluster_name` (`cluster_id`, `name`),
  CONSTRAINT `fk_volunteers_cluster`
    FOREIGN KEY (`cluster_id`) REFERENCES `clusters` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_volunteers_panchayat`
    FOREIGN KEY (`panchayat_id`) REFERENCES `panchayats` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_volunteers_village`
    FOREIGN KEY (`village_id`) REFERENCES `villages` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Academic Years Table
CREATE TABLE IF NOT EXISTS `academic_years` (
  `id` VARCHAR(64) PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `start_date` DATE NULL,
  `end_date` DATE NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT FALSE,
  `status` VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  `archived_at` DATETIME NULL,
  `created_by` VARCHAR(64) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_academic_years_name` (`name`),
  INDEX `idx_academic_years_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Academic Setup Table
CREATE TABLE IF NOT EXISTS `academic_setup` (
  `academic_year_id` VARCHAR(64) NOT NULL,
  `day_number` INT NOT NULL,
  `academic_year` VARCHAR(50) NOT NULL,
  `session_name` VARCHAR(255) NULL,
  `session_date` DATE NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`academic_year_id`, `day_number`),
  INDEX `idx_academic_setup_year_name` (`academic_year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Modules Table
CREATE TABLE IF NOT EXISTS `modules` (
  `id` VARCHAR(64) PRIMARY KEY,
  `code` VARCHAR(64) NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `academic_year` VARCHAR(50) NULL,
  `day_number` INT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_modules_code` (`code`),
  INDEX `idx_modules_name` (`name`),
  INDEX `idx_modules_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Module Resources Table
CREATE TABLE IF NOT EXISTS `module_resources` (
  `id` VARCHAR(64) PRIMARY KEY,
  `module_id` VARCHAR(64) NOT NULL,
  `original_filename` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `file_url` VARCHAR(500) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_module_resources_module` (`module_id`),
  CONSTRAINT `fk_module_resources_module`
    FOREIGN KEY (`module_id`) REFERENCES `modules` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Sessions Table
CREATE TABLE IF NOT EXISTS `sessions` (
  `id` VARCHAR(64) PRIMARY KEY,
  `code` VARCHAR(64) NULL,
  `name` VARCHAR(255) NULL,
  `module_id` VARCHAR(64) NULL,
  `cluster_id` VARCHAR(64) NULL,
  `panchayat_id` VARCHAR(64) NULL,
  `village_id` VARCHAR(64) NULL,
  `target_locations_json` JSON NULL,
  `volunteer_id` VARCHAR(64) NULL,
  `academic_year` VARCHAR(50) NULL,
  `day_number` INT NULL,
  `session_date_fixed` BOOLEAN NOT NULL DEFAULT FALSE,
  `session_date_fixed_at` DATETIME NULL,
  `session_date_fixed_by` VARCHAR(64) NULL,
  `date` DATE NULL,
  `time` VARCHAR(50) NULL,
  `session_status` ENUM('Draft','Scheduled','In Progress','Submitted','Pending Review','Approved','Resubmission Required','Resubmitted','Completed','Cancelled') NOT NULL DEFAULT 'Draft',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_sessions_cluster` (`cluster_id`),
  INDEX `idx_sessions_panchayat` (`panchayat_id`),
  INDEX `idx_sessions_village` (`village_id`),
  INDEX `idx_sessions_volunteer` (`volunteer_id`),
  INDEX `idx_sessions_module` (`module_id`),
  INDEX `idx_sessions_status` (`session_status`),
  INDEX `idx_sessions_date` (`date`),
  INDEX `idx_sessions_cluster_date` (`cluster_id`, `date`),
  CONSTRAINT `fk_sessions_module`
    FOREIGN KEY (`module_id`) REFERENCES `modules` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_sessions_cluster`
    FOREIGN KEY (`cluster_id`) REFERENCES `clusters` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_sessions_panchayat`
    FOREIGN KEY (`panchayat_id`) REFERENCES `panchayats` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_sessions_village`
    FOREIGN KEY (`village_id`) REFERENCES `villages` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_sessions_volunteer`
    FOREIGN KEY (`volunteer_id`) REFERENCES `volunteers` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Attendance Sessions Table
CREATE TABLE IF NOT EXISTS `attendance_sessions` (
  `id` VARCHAR(64) PRIMARY KEY,
  `session_id` VARCHAR(64) NOT NULL,
  `cluster_id` VARCHAR(64) NOT NULL,
  `panchayat_id` VARCHAR(64) NULL,
  `village_id` VARCHAR(64) NULL,
  `day_number` INT NOT NULL,
  `academic_year_id` VARCHAR(64) NULL,
  `attendance_type` ENUM('students','volunteers') NOT NULL DEFAULT 'students',
  `status` ENUM('Draft','Submitted','Approved','Rejected','Edit Requested','Edit Approved','Resubmission') NOT NULL DEFAULT 'Draft',
  `present_count` INT NOT NULL DEFAULT 0,
  `total_count` INT NOT NULL DEFAULT 0,
  `task_completed_count` INT NOT NULL DEFAULT 0,
  `not_marked_count` INT NOT NULL DEFAULT 0,
  `edit_reason` TEXT NULL,
  `edit_requested_by` VARCHAR(128) NULL,
  `edit_requested_at` TIMESTAMP NULL,
  `reviewed_by` VARCHAR(128) NULL,
  `reviewed_at` TIMESTAMP NULL,
  `review_remarks` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_attendance_session` (`session_id`),
  INDEX `idx_attendance_cluster` (`cluster_id`),
  INDEX `idx_attendance_day` (`day_number`),
  INDEX `idx_attendance_year` (`academic_year_id`),
  INDEX `idx_attendance_status` (`status`),
  CONSTRAINT `fk_attendance_session`
    FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_attendance_cluster`
    FOREIGN KEY (`cluster_id`) REFERENCES `clusters` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_attendance_panchayat`
    FOREIGN KEY (`panchayat_id`) REFERENCES `panchayats` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_attendance_village`
    FOREIGN KEY (`village_id`) REFERENCES `villages` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Student Attendance Table
CREATE TABLE IF NOT EXISTS `student_attendance` (
  `id` VARCHAR(64) PRIMARY KEY,
  `attendance_session_id` VARCHAR(64) NOT NULL,
  `student_id` VARCHAR(64) NOT NULL,
  `present` TINYINT(1) NULL DEFAULT NULL,
  `task_status` VARCHAR(64) NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_student_attendance_session` (`attendance_session_id`),
  INDEX `idx_student_attendance_student` (`student_id`),
  CONSTRAINT `fk_student_attendance_session`
    FOREIGN KEY (`attendance_session_id`) REFERENCES `attendance_sessions` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_student_attendance_student`
    FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Volunteer Attendance Table
CREATE TABLE IF NOT EXISTS `volunteer_attendance` (
  `id` VARCHAR(64) PRIMARY KEY,
  `attendance_session_id` VARCHAR(64) NOT NULL,
  `volunteer_id` VARCHAR(64) NOT NULL,
  `present` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_volunteer_attendance_session` (`attendance_session_id`),
  INDEX `idx_volunteer_attendance_volunteer` (`volunteer_id`),
  CONSTRAINT `fk_volunteer_attendance_session`
    FOREIGN KEY (`attendance_session_id`) REFERENCES `attendance_sessions` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_volunteer_attendance_volunteer`
    FOREIGN KEY (`volunteer_id`) REFERENCES `volunteers` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Lesson Plans Table
CREATE TABLE IF NOT EXISTS `lesson_plans` (
  `id` VARCHAR(64) PRIMARY KEY,
  `session_id` VARCHAR(64) NULL,
  `module_id` VARCHAR(64) NULL,
  `cluster_id` VARCHAR(64) NOT NULL,
  `panchayat_id` VARCHAR(64) NULL,
  `volunteer_id` VARCHAR(64) NULL,
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
  `academic_year_id` VARCHAR(64) NULL,
  `status` ENUM('Draft','Submitted','Approved','Rejected') NOT NULL DEFAULT 'Draft',
  `created_by` VARCHAR(64) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_lesson_plans_cluster` (`cluster_id`),
  INDEX `idx_lesson_plans_session` (`session_id`),
  INDEX `idx_lesson_plans_module` (`module_id`),
  INDEX `idx_lesson_plans_year` (`academic_year_id`),
  INDEX `idx_lesson_plans_created` (`created_at`),
  CONSTRAINT `fk_lesson_plans_cluster`
    FOREIGN KEY (`cluster_id`) REFERENCES `clusters` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_lesson_plans_session`
    FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_lesson_plans_module`
    FOREIGN KEY (`module_id`) REFERENCES `modules` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_lesson_plans_panchayat`
    FOREIGN KEY (`panchayat_id`) REFERENCES `panchayats` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_lesson_plans_volunteer`
    FOREIGN KEY (`volunteer_id`) REFERENCES `volunteers` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_lesson_plans_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Session Photos Table
CREATE TABLE IF NOT EXISTS `session_photos` (
  `id` VARCHAR(64) PRIMARY KEY,
  `cluster_id` VARCHAR(64) NOT NULL,
  `session_id` VARCHAR(64) NULL,
  `academic_year_id` VARCHAR(64) NULL,
  `day_number` INT NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `file_url` VARCHAR(500) NULL,
  `original_filename` VARCHAR(255) NOT NULL,
  `uploaded_by` VARCHAR(64) NULL,
  `uploaded_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_session_photos_cluster` (`cluster_id`),
  INDEX `idx_session_photos_session` (`session_id`),
  INDEX `idx_session_photos_year` (`academic_year_id`),
  INDEX `idx_session_photos_day` (`day_number`),
  INDEX `idx_session_photos_uploaded` (`uploaded_at`),
  CONSTRAINT `fk_session_photos_cluster`
    FOREIGN KEY (`cluster_id`) REFERENCES `clusters` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_session_photos_session`
    FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_session_photos_user`
    FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. Session Reports Table
CREATE TABLE IF NOT EXISTS `session_reports` (
  `id` VARCHAR(64) PRIMARY KEY,
  `session_id` VARCHAR(64) NOT NULL,
  `cluster_id` VARCHAR(64) NOT NULL,
  `academic_year_id` VARCHAR(64) NULL,
  `day_number` INT NULL,
  `session_summary` TEXT NULL,
  `student_count` INT NULL DEFAULT 0,
  `attendance_summary` TEXT NULL,
  `activities` TEXT NULL,
  `outcome` TEXT NULL,
  `issues` TEXT NULL,
  `remarks` TEXT NULL,
  `status` ENUM('Draft','Submitted','Approved','Rejected') NOT NULL DEFAULT 'Draft',
  `created_by` VARCHAR(64) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_session_reports_session` (`session_id`),
  INDEX `idx_session_reports_cluster` (`cluster_id`),
  INDEX `idx_session_reports_year` (`academic_year_id`),
  INDEX `idx_session_reports_created` (`created_at`),
  CONSTRAINT `fk_session_reports_session`
    FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_session_reports_cluster`
    FOREIGN KEY (`cluster_id`) REFERENCES `clusters` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_session_reports_user`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `session_report_photos` (
  `id` VARCHAR(64) NOT NULL,
  `session_report_id` VARCHAR(64) NOT NULL,
  `academic_year_id` VARCHAR(64) NOT NULL,
  `cluster_id` VARCHAR(64) NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `original_filename` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `file_size` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `uploaded_by` VARCHAR(64) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_session_report_photos_report` (`session_report_id`),
  INDEX `idx_session_report_photos_year_cluster` (`academic_year_id`, `cluster_id`),
  CONSTRAINT `fk_session_report_photos_report`
    FOREIGN KEY (`session_report_id`) REFERENCES `session_reports` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_session_report_photos_year`
    FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_session_report_photos_cluster`
    FOREIGN KEY (`cluster_id`) REFERENCES `clusters` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_session_report_photos_user`
    FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. Finance Entries Table
CREATE TABLE IF NOT EXISTS `finance_entries` (
  `id` VARCHAR(64) PRIMARY KEY,
  `cluster_id` VARCHAR(64) NOT NULL,
  `session_id` VARCHAR(64) NULL,
  `academic_year_id` VARCHAR(64) NULL,
  `date` DATE NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `created_by` VARCHAR(64) NULL,
  `status` ENUM('Draft','Submitted','Approved','Rejected') NOT NULL DEFAULT 'Draft',
  `bill_reference` VARCHAR(255) NULL,
  `bill_url` LONGTEXT NULL,
  `count` INT NULL,
  `count_amount` VARCHAR(64) NULL,
  `remarks` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_finance_cluster` (`cluster_id`),
  INDEX `idx_finance_session` (`session_id`),
  INDEX `idx_finance_year` (`academic_year_id`),
  INDEX `idx_finance_date` (`date`),
  INDEX `idx_finance_status` (`status`),
  CONSTRAINT `fk_finance_cluster`
    FOREIGN KEY (`cluster_id`) REFERENCES `clusters` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_finance_user`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_reports` (
  `id` VARCHAR(64) NOT NULL,
  `cluster_id` VARCHAR(64) NOT NULL,
  `academic_year_id` VARCHAR(64) NOT NULL,
  `session_id` VARCHAR(64) NULL,
  `report_status` ENUM('DRAFT','SUBMITTED','PENDING_APPROVAL','APPROVED','REJECTED') NOT NULL DEFAULT 'DRAFT',
  `report_data` JSON NOT NULL,
  `edit_request_status` ENUM('NONE','PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'NONE',
  `edit_request_reason` TEXT NULL,
  `edit_requested_by` VARCHAR(64) NULL,
  `edit_requested_at` DATETIME NULL,
  `edit_approved_by` VARCHAR(64) NULL,
  `edit_approved_at` DATETIME NULL,
  `edit_rejected_by` VARCHAR(64) NULL,
  `edit_rejected_at` DATETIME NULL,
  `edit_rejection_reason` TEXT NULL,
  `edit_permission` BOOLEAN NOT NULL DEFAULT FALSE,
  `last_submitted_at` DATETIME NULL,
  `last_submitted_by` VARCHAR(64) NULL,
  `created_by` VARCHAR(64) NULL,
  `updated_by` VARCHAR(64) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`, `academic_year_id`),
  INDEX `idx_finance_reports_cluster` (`cluster_id`, `academic_year_id`),
  INDEX `idx_finance_reports_status` (`report_status`, `edit_request_status`),
  CONSTRAINT `fk_finance_reports_cluster` FOREIGN KEY (`cluster_id`) REFERENCES `clusters` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_finance_reports_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_finance_reports_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_report_history` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `report_id` VARCHAR(64) NOT NULL,
  `academic_year_id` VARCHAR(64) NOT NULL,
  `event` VARCHAR(128) NOT NULL,
  `details` TEXT NULL,
  `user_id` VARCHAR(64) NULL,
  `user_name` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_finance_history_report` (`report_id`, `academic_year_id`, `created_at`),
  CONSTRAINT `fk_finance_history_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. Approvals Table
CREATE TABLE IF NOT EXISTS `approvals` (
  `id` VARCHAR(64) PRIMARY KEY,
  `module` VARCHAR(64) NOT NULL,
  `status` ENUM('Pending','Open','Approved','Rejected','Correction Requested') NOT NULL DEFAULT 'Pending',
  `requested_by` VARCHAR(64) NULL,
  `session_id` VARCHAR(64) NULL,
  `academic_year_id` VARCHAR(64) NULL,
  `remarks` TEXT NULL,
  `date` DATE NULL,
  `cluster_id` VARCHAR(64) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_approvals_cluster` (`cluster_id`),
  INDEX `idx_approvals_session` (`session_id`),
  INDEX `idx_approvals_year` (`academic_year_id`),
  INDEX `idx_approvals_status` (`status`),
  INDEX `idx_approvals_created` (`created_at`),
  CONSTRAINT `fk_approvals_cluster`
    FOREIGN KEY (`cluster_id`) REFERENCES `clusters` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_approvals_session`
    FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_approvals_user`
    FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. Date Change Requests Table
CREATE TABLE IF NOT EXISTS `date_change_requests` (
  `id` VARCHAR(64) PRIMARY KEY,
  `session_id` VARCHAR(64) NOT NULL,
  `cluster_id` VARCHAR(64) NOT NULL,
  `academic_year_id` VARCHAR(64) NULL,
  `original_date` DATE NOT NULL,
  `requested_date` DATE NOT NULL,
  `reason` TEXT NOT NULL,
  `status` ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  `reviewed_by` VARCHAR(64) NULL,
  `review_remarks` TEXT NULL,
  `reviewed_at` TIMESTAMP NULL,
  `requested_by` VARCHAR(64) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_dcr_session` (`session_id`),
  INDEX `idx_dcr_cluster` (`cluster_id`),
  INDEX `idx_dcr_year` (`academic_year_id`),
  INDEX `idx_dcr_status` (`status`),
  INDEX `idx_dcr_created` (`created_at`),
  CONSTRAINT `fk_dcr_session`
    FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_dcr_cluster`
    FOREIGN KEY (`cluster_id`) REFERENCES `clusters` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_dcr_reviewer`
    FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_dcr_requester`
    FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. Session Submissions Table
CREATE TABLE IF NOT EXISTS `session_submissions` (
  `id` VARCHAR(64) PRIMARY KEY,
  `session_id` VARCHAR(64) NOT NULL,
  `cluster_id` VARCHAR(64) NOT NULL,
  `academic_year_id` VARCHAR(64) NULL,
  `day_number` INT NOT NULL,
  `attendance_complete` BOOLEAN NOT NULL DEFAULT FALSE,
  `lesson_plan_complete` BOOLEAN NOT NULL DEFAULT FALSE,
  `photos_complete` BOOLEAN NOT NULL DEFAULT FALSE,
  `report_complete` BOOLEAN NOT NULL DEFAULT FALSE,
  `finance_complete` BOOLEAN NOT NULL DEFAULT FALSE,
  `status` ENUM('Draft','Submitted','Approved','Resubmission Required','Resubmitted') NOT NULL DEFAULT 'Draft',
  `submitted_at` TIMESTAMP NULL,
  `submitted_by` VARCHAR(64) NULL,
  `reviewed_by` VARCHAR(64) NULL,
  `reviewed_at` TIMESTAMP NULL,
  `review_remarks` TEXT NULL,
  `resubmission_reason` TEXT NULL,
  `resubmitted_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_submissions_session_day` (`session_id`, `day_number`),
  INDEX `idx_submissions_cluster` (`cluster_id`),
  INDEX `idx_submissions_year` (`academic_year_id`),
  INDEX `idx_submissions_status` (`status`),
  INDEX `idx_submissions_created` (`created_at`),
  INDEX `idx_submissions_updated` (`updated_at`),
  CONSTRAINT `fk_submissions_session`
    FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_submissions_cluster`
    FOREIGN KEY (`cluster_id`) REFERENCES `clusters` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_submissions_submitter`
    FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_submissions_reviewer`
    FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 22. Notifications Table
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` VARCHAR(64) PRIMARY KEY,
  `user_id` VARCHAR(64) NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `type` VARCHAR(64) NOT NULL,
  `is_read` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_notifications_user` (`user_id`),
  INDEX `idx_notifications_read` (`is_read`),
  INDEX `idx_notifications_created` (`created_at`),
  CONSTRAINT `fk_notifications_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 23. Audit Logs Table
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(64) PRIMARY KEY,
  `user_id` VARCHAR(64) NULL,
  `user_name` VARCHAR(255) NULL,
  `role` VARCHAR(64) NULL,
  `cluster_id` VARCHAR(64) NULL,
  `action` VARCHAR(255) NOT NULL,
  `module` VARCHAR(128) NULL,
  `record_id` VARCHAR(64) NULL,
  `details` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_audit_cluster` (`cluster_id`),
  INDEX `idx_audit_user` (`user_id`),
  INDEX `idx_audit_module` (`module`),
  INDEX `idx_audit_created` (`created_at`),
  CONSTRAINT `fk_audit_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_audit_cluster`
    FOREIGN KEY (`cluster_id`) REFERENCES `clusters` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 24. Auth OTPs Table
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

-- 25. Schema Migrations Table
CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `version` VARCHAR(255) PRIMARY KEY,
  `applied_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ====================================================================
-- Initial Seed Data: Super Admin & Standard Modules
-- ====================================================================

-- Default Super Admin (password: admin123)
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `cluster_id`, `phone`, `must_change_password`, `status`)
VALUES
  ('usr-super-admin', 'Super Admin', 'admin@tqi.org', '$2b$10$dlTJOo.x9XJ0eeX2hHVvSuXPVUw8WR4R5pehnb998pg./BF6rb25q', 'Super Admin', NULL, '+91 90000 00000', FALSE, 'Active')
ON DUPLICATE KEY UPDATE
  `password_hash` = VALUES(`password_hash`),
  `name` = VALUES(`name`),
  `role` = VALUES(`role`),
  `must_change_password` = FALSE,
  `status` = 'Active';

-- Default Active Academic Year
INSERT INTO `academic_years` (`id`, `name`, `start_date`, `end_date`, `is_active`)
VALUES ('ay-2025-2026', '2025-2026', '2025-06-01', '2026-05-31', TRUE)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Default Foundation Modules
INSERT INTO `modules` (`id`, `name`, `code`, `description`, `is_active`)
VALUES
  ('module-english', 'Spoken English', 'ENG-01', 'English communication & vocabulary', TRUE),
  ('module-maths', 'Mathematics Basics', 'MATH-02', 'Foundational arithmetic & problem solving', TRUE),
  ('module-life-skills', 'Life Skills', 'LIFE-03', 'Critical thinking, ethics & leadership', TRUE)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `is_active` = TRUE;
