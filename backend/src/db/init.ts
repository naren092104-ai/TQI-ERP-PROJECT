import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { pool } from './connection.js';

export const TABLE_DEFINITIONS: { name: string; ddl: string }[] = [
  {
    name: 'schema_migrations',
    ddl: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'users',
    ddl: `
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('SUPER_ADMIN','CLUSTER_ADMIN') NOT NULL,
        cluster_id VARCHAR(64) NULL,
        phone VARCHAR(50) NULL,
        must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
        status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_users_role (role),
        INDEX idx_users_cluster (cluster_id),
        INDEX idx_users_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'clusters',
    ddl: `
      CREATE TABLE IF NOT EXISTS clusters (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        district VARCHAR(255) NULL,
        state VARCHAR(255) NULL,
        code VARCHAR(64) NULL,
        college_name VARCHAR(255) NULL,
        college_id VARCHAR(64) NULL,
        spoc_name VARCHAR(255) NULL,
        spoc_mobile VARCHAR(50) NULL,
        admin_id VARCHAR(64) NULL,
        status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'colleges',
    ddl: `
      CREATE TABLE IF NOT EXISTS colleges (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        district VARCHAR(255) NULL,
        status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_colleges_name_district (name, district)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'panchayats',
    ddl: `
      CREATE TABLE IF NOT EXISTS panchayats (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        cluster_id VARCHAR(64) NOT NULL,
        status VARCHAR(64) NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_panchayats_cluster (cluster_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'villages',
    ddl: `
      CREATE TABLE IF NOT EXISTS villages (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        panchayat_id VARCHAR(64) NOT NULL,
        cluster_id VARCHAR(64) NOT NULL,
        status VARCHAR(64) NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_villages_panchayat (panchayat_id),
        INDEX idx_villages_cluster (cluster_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'students',
    ddl: `
      CREATE TABLE IF NOT EXISTS students (
        id VARCHAR(64) PRIMARY KEY,
        code VARCHAR(64) NULL,
        name VARCHAR(255) NOT NULL,
        gender ENUM('male','female','other') NULL,
        dob DATE NULL,
        standard VARCHAR(100) NULL,
        cluster_id VARCHAR(64) NOT NULL,
        college_id VARCHAR(64) NULL,
        panchayat_id VARCHAR(64) NOT NULL,
        village_id VARCHAR(64) NOT NULL,
        parent_name VARCHAR(255) NULL,
        phone VARCHAR(50) NULL,
        status ENUM('active','inactive') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_students_cluster (cluster_id),
        INDEX idx_students_panchayat (panchayat_id),
        INDEX idx_students_village (village_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'volunteers',
    ddl: `
      CREATE TABLE IF NOT EXISTS volunteers (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NULL,
        phone VARCHAR(50) NULL,
        cluster_id VARCHAR(64) NOT NULL,
        college_id VARCHAR(64) NULL,
        panchayat_id VARCHAR(64) NULL,
        village_id VARCHAR(64) NULL,
        department VARCHAR(255) NULL,
        stream VARCHAR(100) NULL,
        passing_out_year SMALLINT NULL,
        role VARCHAR(64) NULL,
        status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_volunteers_cluster (cluster_id),
        INDEX idx_volunteers_panchayat (panchayat_id),
        INDEX idx_volunteers_village (village_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'sessions',
    ddl: `
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(64) PRIMARY KEY,
        code VARCHAR(64) NULL,
        title VARCHAR(255) NULL,
        name VARCHAR(255) NULL,
        module_id VARCHAR(64) NULL,
        cluster_id VARCHAR(64) NULL,
        clusterId VARCHAR(64) NULL,
        academic_year VARCHAR(50) NULL,
        day_number INT NULL,
        session_name_snapshot VARCHAR(255) NULL,
        panchayat_id VARCHAR(64) NULL,
        panchayatId VARCHAR(64) NULL,
        village_id VARCHAR(64) NULL,
        villageId VARCHAR(64) NULL,
        volunteer_id VARCHAR(64) NULL,
        volunteerId VARCHAR(64) NULL,
        date DATE NOT NULL,
        session_date_fixed BOOLEAN NOT NULL DEFAULT FALSE,
        session_date_fixed_at DATETIME NULL,
        session_date_fixed_by VARCHAR(64) NULL,
        time VARCHAR(50) NULL,
        endTime VARCHAR(50) NULL,
        status VARCHAR(64) NULL,
        session_status VARCHAR(64) NOT NULL DEFAULT 'Draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_sessions_cluster (cluster_id),
        INDEX idx_sessions_panchayat (panchayat_id),
        INDEX idx_sessions_status (session_status),
        INDEX idx_sessions_date (date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'attendance_sessions',
    ddl: `
      CREATE TABLE IF NOT EXISTS attendance_sessions (
        id VARCHAR(64) PRIMARY KEY,
        session_id VARCHAR(64) NOT NULL,
        cluster_id VARCHAR(64) NOT NULL,
        panchayat_id VARCHAR(64) NULL,
        village_id VARCHAR(64) NULL,
        day_number INT NOT NULL,
        status VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
        present_count INT NOT NULL DEFAULT 0,
        total_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_attendance_session (session_id),
        INDEX idx_attendance_cluster (cluster_id),
        INDEX idx_attendance_day (day_number),
        INDEX idx_attendance_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'student_attendance',
    ddl: `
      CREATE TABLE IF NOT EXISTS student_attendance (
        id VARCHAR(64) PRIMARY KEY,
        attendance_session_id VARCHAR(64) NOT NULL,
        student_id VARCHAR(64) NOT NULL,
        present BOOLEAN NOT NULL DEFAULT TRUE,
        round_number TINYINT NOT NULL DEFAULT 1,
        task_status VARCHAR(64) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_student_attendance_session (attendance_session_id),
        INDEX idx_student_attendance_student (student_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'volunteer_attendance',
    ddl: `
      CREATE TABLE IF NOT EXISTS volunteer_attendance (
        id VARCHAR(64) PRIMARY KEY,
        attendance_session_id VARCHAR(64) NOT NULL,
        volunteer_id VARCHAR(64) NOT NULL,
        present BOOLEAN NOT NULL DEFAULT TRUE,
        round_number TINYINT NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_volunteer_attendance_session (attendance_session_id),
        INDEX idx_volunteer_attendance_volunteer (volunteer_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'lesson_plans',
    ddl: `
      CREATE TABLE IF NOT EXISTS lesson_plans (
        id VARCHAR(64) PRIMARY KEY,
        session_id VARCHAR(64) NULL,
        module_id VARCHAR(64) NULL,
        cluster_id VARCHAR(64) NOT NULL,
        panchayat_id VARCHAR(64) NULL,
        title VARCHAR(255) NOT NULL,
        topic VARCHAR(255) NULL,
        objective TEXT NULL,
        activities TEXT NULL,
        materials TEXT NULL,
        duration VARCHAR(100) NULL,
        remarks TEXT NULL,
        teaching_method VARCHAR(255) NULL,
        assessment_task TEXT NULL,
        target_standard VARCHAR(100) NULL,
        learning_outcomes TEXT NULL,
        day_number INT NULL,
        volunteer_id VARCHAR(64) NULL,
        status VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
        created_by VARCHAR(64) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_lesson_plans_cluster (cluster_id),
        INDEX idx_lesson_plans_session (session_id),
        INDEX idx_lesson_plans_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'session_photos',
    ddl: `
      CREATE TABLE IF NOT EXISTS session_photos (
        id VARCHAR(64) PRIMARY KEY,
        cluster_id VARCHAR(64) NOT NULL,
        session_id VARCHAR(64) NULL,
        day_number INT NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_url VARCHAR(500) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NULL,
        file_size BIGINT NULL,
        uploaded_by VARCHAR(64) NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_session_photos_cluster (cluster_id),
        INDEX idx_session_photos_session (session_id),
        INDEX idx_session_photos_day (day_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'finance_entries',
    ddl: `
      CREATE TABLE IF NOT EXISTS finance_entries (
        id VARCHAR(64) PRIMARY KEY,
        cluster_id VARCHAR(64) NOT NULL,
        session_id VARCHAR(64) NULL,
        date DATE NOT NULL,
        description VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        created_by VARCHAR(64) NULL,
        status VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
        bill_reference VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_finance_cluster (cluster_id),
        INDEX idx_finance_status (status),
        INDEX idx_finance_date (date),
        INDEX idx_finance_session (session_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'finance_drafts',
    ddl: `
      CREATE TABLE IF NOT EXISTS finance_drafts (
        id VARCHAR(64) PRIMARY KEY,
        cluster_id VARCHAR(64) NOT NULL,
        title VARCHAR(255) NOT NULL,
        session_date DATE NULL,
        total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        status VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
        created_by VARCHAR(64) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_finance_drafts_cluster (cluster_id),
        INDEX idx_finance_drafts_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'correction_requests',
    ddl: `
      CREATE TABLE IF NOT EXISTS correction_requests (
        id VARCHAR(64) PRIMARY KEY,
        module VARCHAR(64) NOT NULL,
        record_id VARCHAR(64) NOT NULL,
        reason TEXT NOT NULL,
        requested_by VARCHAR(64) NOT NULL,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(64) NOT NULL DEFAULT 'PENDING',
        cluster_id VARCHAR(64) NULL,
        INDEX idx_correction_module (module),
        INDEX idx_correction_status (status),
        INDEX idx_correction_cluster (cluster_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'approvals',
    ddl: `
      CREATE TABLE IF NOT EXISTS approvals (
        id VARCHAR(64) PRIMARY KEY,
        module VARCHAR(64) NULL,
        type VARCHAR(64) NULL,
        reference VARCHAR(64) NULL,
        record_id VARCHAR(64) NULL,
        status VARCHAR(64) NOT NULL DEFAULT 'PENDING',
        requested_by VARCHAR(64) NULL,
        requestedBy VARCHAR(64) NULL,
        sessionId VARCHAR(64) NULL,
        remarks TEXT NULL,
        date DATE NULL,
        cluster_id VARCHAR(64) NULL,
        clusterId VARCHAR(64) NULL,
        reviewed_by VARCHAR(64) NULL,
        reviewed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_approvals_module (module),
        INDEX idx_approvals_status (status),
        INDEX idx_approvals_cluster (cluster_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'notifications',
    ddl: `
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(64) NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        action_tab VARCHAR(64) NULL,
        target_id VARCHAR(64) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notifications_user (user_id),
        INDEX idx_notifications_read (is_read)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'audit_logs',
    ddl: `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NULL,
        user_name VARCHAR(255) NULL,
        role VARCHAR(64) NULL,
        cluster_id VARCHAR(64) NULL,
        action VARCHAR(255) NOT NULL,
        module VARCHAR(128) NULL,
        entity_type VARCHAR(128) NULL,
        record_id VARCHAR(64) NULL,
        entity_id VARCHAR(64) NULL,
        details TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_cluster (cluster_id),
        INDEX idx_audit_module (module),
        INDEX idx_audit_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'modules',
    ddl: `
      CREATE TABLE IF NOT EXISTS modules (
        id VARCHAR(64) PRIMARY KEY,
        module_number VARCHAR(50) NULL,
        name VARCHAR(255) NULL,
        module_name VARCHAR(255) NULL,
        code VARCHAR(64) NULL,
        topic VARCHAR(255) NULL,
        description TEXT NULL,
        academic_year VARCHAR(50) NULL,
        day_number INT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        status VARCHAR(64) NOT NULL DEFAULT 'Active',
        created_by VARCHAR(64) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_modules_status (status),
        INDEX idx_modules_day (day_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'module_resources',
    ddl: `
      CREATE TABLE IF NOT EXISTS module_resources (
        id VARCHAR(64) PRIMARY KEY,
        module_id VARCHAR(64) NOT NULL,
        file_name VARCHAR(255) NULL,
        original_file_name VARCHAR(255) NULL,
        original_filename VARCHAR(255) NULL,
        file_path VARCHAR(500) NULL,
        file_url VARCHAR(500) NULL,
        drive_url VARCHAR(500) NULL,
        mime_type VARCHAR(100) NULL,
        file_size BIGINT NULL,
        storage_provider VARCHAR(50) DEFAULT 'local',
        drive_file_id VARCHAR(255) NULL,
        drive_folder_id VARCHAR(255) NULL,
        last_modified TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_module_resources_module (module_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'auth_otps',
    ddl: `
      CREATE TABLE IF NOT EXISTS auth_otps (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        used_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_auth_otps_email_created (email, created_at),
        INDEX idx_auth_otps_expiry (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'password_reset_tokens',
    ddl: `
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        token_hash VARCHAR(128) NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_password_reset_token_hash (token_hash),
        INDEX idx_password_reset_user (user_id),
        INDEX idx_password_reset_expiry (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'academic_setup',
    ddl: `
      CREATE TABLE IF NOT EXISTS academic_setup (
        day_number INT PRIMARY KEY,
        academic_year VARCHAR(50) NOT NULL,
        session_name VARCHAR(255) NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'academic_years',
    ddl: `
      CREATE TABLE IF NOT EXISTS academic_years (
        id VARCHAR(64) NOT NULL,
        name VARCHAR(100) NOT NULL,
        start_date DATE NULL,
        end_date DATE NULL,
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        created_by VARCHAR(64) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_academic_years_name (name),
        INDEX idx_academic_years_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'program_days',
    ddl: `
      CREATE TABLE IF NOT EXISTS program_days (
        id VARCHAR(64) NOT NULL,
        academic_year_id VARCHAR(64) NOT NULL,
        day_number INT NOT NULL,
        day_name VARCHAR(100) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_program_days_year_day (academic_year_id, day_number),
        INDEX idx_program_days_year (academic_year_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'session_reports',
    ddl: `
      CREATE TABLE IF NOT EXISTS session_reports (
        id VARCHAR(64) NOT NULL,
        session_id VARCHAR(64) NOT NULL,
        cluster_id VARCHAR(64) NOT NULL,
        day_number INT NULL,
        session_summary TEXT NULL,
        student_count INT NULL DEFAULT 0,
        attendance_summary TEXT NULL,
        activities TEXT NULL,
        issues TEXT NULL,
        remarks TEXT NULL,
        status VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
        created_by VARCHAR(64) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_session_reports_session (session_id),
        INDEX idx_session_reports_cluster (cluster_id),
        INDEX idx_session_reports_day (day_number),
        INDEX idx_session_reports_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'date_change_requests',
    ddl: `
      CREATE TABLE IF NOT EXISTS date_change_requests (
        id VARCHAR(64) NOT NULL,
        session_id VARCHAR(64) NOT NULL,
        cluster_id VARCHAR(64) NOT NULL,
        day_number INT NULL,
        original_date DATE NOT NULL,
        requested_date DATE NOT NULL,
        reason TEXT NOT NULL,
        status VARCHAR(64) NOT NULL DEFAULT 'PENDING',
        reviewed_by VARCHAR(64) NULL,
        review_remarks TEXT NULL,
        reviewed_at TIMESTAMP NULL,
        requested_by VARCHAR(64) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_dcr_session (session_id),
        INDEX idx_dcr_cluster (cluster_id),
        INDEX idx_dcr_status (status),
        INDEX idx_dcr_requested_by (requested_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'session_submissions',
    ddl: `
      CREATE TABLE IF NOT EXISTS session_submissions (
        id VARCHAR(64) NOT NULL,
        session_id VARCHAR(64) NOT NULL,
        cluster_id VARCHAR(64) NOT NULL,
        day_number INT NOT NULL,
        attendance_complete BOOLEAN NOT NULL DEFAULT FALSE,
        lesson_plan_complete BOOLEAN NOT NULL DEFAULT FALSE,
        photos_complete BOOLEAN NOT NULL DEFAULT FALSE,
        report_complete BOOLEAN NOT NULL DEFAULT FALSE,
        finance_complete BOOLEAN NOT NULL DEFAULT FALSE,
        status VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
        submitted_at TIMESTAMP NULL,
        submitted_by VARCHAR(64) NULL,
        reviewed_by VARCHAR(64) NULL,
        reviewed_at TIMESTAMP NULL,
        review_remarks TEXT NULL,
        resubmission_reason TEXT NULL,
        resubmitted_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_session_submissions_session (session_id, day_number),
        INDEX idx_submissions_cluster (cluster_id),
        INDEX idx_submissions_status (status),
        INDEX idx_submissions_day (day_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'session_photo_submissions',
    ddl: `
      CREATE TABLE IF NOT EXISTS session_photo_submissions (
        id VARCHAR(64) PRIMARY KEY,
        cluster_id VARCHAR(64) NOT NULL,
        academic_year_id VARCHAR(64) NOT NULL,
        day_number INT NOT NULL,
        session_id VARCHAR(64) NULL,
        status VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
        submitted_by VARCHAR(64) NULL,
        submitted_at TIMESTAMP NULL,
        reviewed_by VARCHAR(64) NULL,
        reviewed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_photo_sub (cluster_id, academic_year_id, day_number),
        INDEX idx_photo_sub_cluster (cluster_id),
        INDEX idx_photo_sub_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'photo_delete_requests',
    ddl: `
      CREATE TABLE IF NOT EXISTS photo_delete_requests (
        id VARCHAR(64) PRIMARY KEY,
        photo_id VARCHAR(64) NOT NULL,
        cluster_id VARCHAR(64) NOT NULL,
        academic_year_id VARCHAR(64) NOT NULL,
        day_number INT NOT NULL,
        session_id VARCHAR(64) NULL,
        requested_by VARCHAR(64) NOT NULL,
        requested_by_name VARCHAR(255) NULL,
        reason TEXT NOT NULL,
        status VARCHAR(64) NOT NULL DEFAULT 'PENDING',
        reviewed_by VARCHAR(64) NULL,
        reviewed_at TIMESTAMP NULL,
        review_remarks TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_pdr_photo (photo_id),
        INDEX idx_pdr_cluster (cluster_id),
        INDEX idx_pdr_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: 'photo_change_requests',
    ddl: `
      CREATE TABLE IF NOT EXISTS photo_change_requests (
        id VARCHAR(64) PRIMARY KEY,
        cluster_id VARCHAR(64) NOT NULL,
        academic_year_id VARCHAR(64) NOT NULL,
        day_number INT NOT NULL,
        session_id VARCHAR(64) NULL,
        requested_by VARCHAR(64) NOT NULL,
        requested_by_name VARCHAR(255) NULL,
        reason TEXT NOT NULL,
        status VARCHAR(64) NOT NULL DEFAULT 'PENDING',
        reviewed_by VARCHAR(64) NULL,
        reviewed_at TIMESTAMP NULL,
        review_remarks TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_pcr_cluster (cluster_id),
        INDEX idx_pcr_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
];

export const COLUMN_PATCHES: { table: string; column: string; definition: string }[] = [
  { table: 'users', column: 'must_change_password', definition: 'BOOLEAN NOT NULL DEFAULT FALSE' },
  { table: 'clusters', column: 'college_name', definition: 'VARCHAR(255) NULL' },
  { table: 'clusters', column: 'spoc_name', definition: 'VARCHAR(255) NULL' },
  { table: 'clusters', column: 'spoc_mobile', definition: 'VARCHAR(50) NULL' },
  { table: 'clusters', column: 'admin_id', definition: 'VARCHAR(64) NULL' },
  { table: 'clusters', column: 'college_id', definition: 'VARCHAR(64) NULL' },
  { table: 'students', column: 'college_id', definition: 'VARCHAR(64) NULL' },
  { table: 'volunteers', column: 'college_id', definition: 'VARCHAR(64) NULL' },
  { table: 'volunteers', column: 'created_by', definition: 'VARCHAR(64) NULL' },
  { table: 'sessions', column: 'title', definition: 'VARCHAR(255) NULL' },
  { table: 'sessions', column: 'academic_year', definition: 'VARCHAR(50) NULL' },
  { table: 'sessions', column: 'day_number', definition: 'INT NULL' },
  { table: 'sessions', column: 'session_name_snapshot', definition: 'VARCHAR(255) NULL' },
  { table: 'sessions', column: 'panchayatId', definition: 'VARCHAR(64) NULL' },
  { table: 'sessions', column: 'villageId', definition: 'VARCHAR(64) NULL' },
  { table: 'sessions', column: 'volunteerId', definition: 'VARCHAR(64) NULL' },
  { table: 'sessions', column: 'academic_year_id', definition: 'VARCHAR(64) NULL' },
  { table: 'sessions', column: 'day_id', definition: 'VARCHAR(64) NULL' },
  { table: 'sessions', column: 'clusterId', definition: 'VARCHAR(64) NULL' },
  { table: 'attendance_sessions', column: 'academic_year_id', definition: 'VARCHAR(64) NULL' },
  { table: 'attendance_sessions', column: 'edit_reason', definition: 'TEXT NULL' },
  { table: 'attendance_sessions', column: 'edit_requested_by', definition: 'VARCHAR(128) NULL' },
  { table: 'attendance_sessions', column: 'edit_requested_at', definition: 'TIMESTAMP NULL' },
  { table: 'attendance_sessions', column: 'reviewed_by', definition: 'VARCHAR(128) NULL' },
  { table: 'attendance_sessions', column: 'reviewed_at', definition: 'TIMESTAMP NULL' },
  { table: 'attendance_sessions', column: 'review_remarks', definition: 'TEXT NULL' },
  { table: 'attendance_sessions', column: 'task_completed_count', definition: 'INT NOT NULL DEFAULT 0' },
  { table: 'attendance_sessions', column: 'not_marked_count', definition: 'INT NOT NULL DEFAULT 0' },
  { table: 'lesson_plans', column: 'academic_year_id', definition: 'VARCHAR(64) NULL' },
  { table: 'session_photos', column: 'academic_year_id', definition: 'VARCHAR(64) NULL' },
  { table: 'finance_entries', column: 'academic_year_id', definition: 'VARCHAR(64) NULL' },
  { table: 'approvals', column: 'academic_year_id', definition: 'VARCHAR(64) NULL' },
  { table: 'session_reports', column: 'academic_year_id', definition: 'VARCHAR(64) NULL' },
  { table: 'date_change_requests', column: 'academic_year_id', definition: 'VARCHAR(64) NULL' },
  { table: 'session_submissions', column: 'academic_year_id', definition: 'VARCHAR(64) NULL' },
  { table: 'sessions', column: 'time', definition: 'VARCHAR(50) NULL' },
  { table: 'sessions', column: 'endTime', definition: 'VARCHAR(50) NULL' },
  { table: 'sessions', column: 'status', definition: 'VARCHAR(64) NULL' },
  { table: 'volunteers', column: 'village_id', definition: 'VARCHAR(64) NULL' },
  { table: 'student_attendance', column: 'round_number', definition: 'TINYINT NOT NULL DEFAULT 1' },
  { table: 'volunteer_attendance', column: 'round_number', definition: 'TINYINT NOT NULL DEFAULT 1' },
  { table: 'volunteers', column: 'stream', definition: 'VARCHAR(100) NULL' },
  { table: 'volunteers', column: 'passing_out_year', definition: 'SMALLINT NULL' },
  { table: 'modules', column: 'module_number', definition: 'VARCHAR(50) NULL' },
  { table: 'modules', column: 'module_name', definition: 'VARCHAR(255) NULL' },
  { table: 'modules', column: 'topic', definition: 'VARCHAR(255) NULL' },
  { table: 'modules', column: 'academic_year', definition: 'VARCHAR(50) NULL' },
  { table: 'modules', column: 'day_number', definition: 'INT NULL' },
  { table: 'modules', column: 'status', definition: 'VARCHAR(64) NOT NULL DEFAULT \'Active\'' },
  { table: 'modules', column: 'created_by', definition: 'VARCHAR(64) NULL' },
  { table: 'module_resources', column: 'original_file_name', definition: 'VARCHAR(255) NULL' },
  { table: 'module_resources', column: 'original_filename', definition: 'VARCHAR(255) NULL' },
  { table: 'module_resources', column: 'file_path', definition: 'VARCHAR(500) NULL' },
  { table: 'module_resources', column: 'file_url', definition: 'VARCHAR(500) NULL' },
  { table: 'module_resources', column: 'file_size', definition: 'BIGINT NULL' },
  { table: 'module_resources', column: 'storage_provider', definition: 'VARCHAR(50) DEFAULT \'local\'' },
  { table: 'module_resources', column: 'drive_file_id', definition: 'VARCHAR(255) NULL' },
  { table: 'module_resources', column: 'drive_folder_id', definition: 'VARCHAR(255) NULL' },
  { table: 'approvals', column: 'type', definition: 'VARCHAR(64) NULL' },
  { table: 'approvals', column: 'reference', definition: 'VARCHAR(64) NULL' },
  { table: 'approvals', column: 'requestedBy', definition: 'VARCHAR(64) NULL' },
  { table: 'approvals', column: 'sessionId', definition: 'VARCHAR(64) NULL' },
  { table: 'approvals', column: 'remarks', definition: 'TEXT NULL' },
  { table: 'approvals', column: 'date', definition: 'DATE NULL' },
  { table: 'approvals', column: 'clusterId', definition: 'VARCHAR(64) NULL' },
  { table: 'approvals', column: 'reviewed_by', definition: 'VARCHAR(64) NULL' },
  { table: 'approvals', column: 'reviewed_at', definition: 'TIMESTAMP NULL' },
  { table: 'finance_entries', column: 'session_id', definition: 'VARCHAR(64) NULL' },
  { table: 'lesson_plans', column: 'topic', definition: 'VARCHAR(255) NULL' },
  { table: 'lesson_plans', column: 'objective', definition: 'TEXT NULL' },
  { table: 'lesson_plans', column: 'activities', definition: 'TEXT NULL' },
  { table: 'lesson_plans', column: 'materials', definition: 'TEXT NULL' },
  { table: 'lesson_plans', column: 'duration', definition: 'VARCHAR(100) NULL' },
  { table: 'lesson_plans', column: 'remarks', definition: 'TEXT NULL' },
  { table: 'lesson_plans', column: 'teaching_method', definition: 'VARCHAR(255) NULL' },
  { table: 'lesson_plans', column: 'assessment_task', definition: 'TEXT NULL' },
  { table: 'lesson_plans', column: 'target_standard', definition: 'VARCHAR(100) NULL' },
  { table: 'lesson_plans', column: 'learning_outcomes', definition: 'TEXT NULL' },
  { table: 'lesson_plans', column: 'day_number', definition: 'INT NULL' },
  { table: 'lesson_plans', column: 'volunteer_id', definition: 'VARCHAR(64) NULL' },
  { table: 'academic_years', column: 'status', definition: 'VARCHAR(32) NOT NULL DEFAULT \'DRAFT\'' },
  { table: 'date_change_requests', column: 'academic_year_id', definition: 'VARCHAR(64) NULL' },
  { table: 'date_change_requests', column: 'day_id', definition: 'VARCHAR(64) NULL' },
  { table: 'session_photos', column: 'delete_request_status', definition: 'VARCHAR(64) NULL' },
  { table: 'session_photos', column: 'delete_request_id', definition: 'VARCHAR(64) NULL' },
];

export async function initDatabaseSchema(): Promise<void> {
  console.log('[DB] Verifying and initializing database schema tables...');

  // 1. Create all base tables
  for (const table of TABLE_DEFINITIONS) {
    try {
      await pool.query(table.ddl);
    } catch (err: any) {
      console.warn(`[DB WARNING] Failed creating table ${table.name}:`, err.message);
    }
  }

  // 2. Reconcile schema drift for existing tables
  for (const patch of COLUMN_PATCHES) {
    try {
      const [cols] = await pool.query<any[]>(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [patch.table, patch.column]
      );
      if (cols.length === 0) {
        await pool.query(`ALTER TABLE \`${patch.table}\` ADD COLUMN \`${patch.column}\` ${patch.definition}`);
        console.log(`[DB] Added column '${patch.column}' to '${patch.table}'.`);
      }
    } catch (err: any) {
      // Ignore column alter warnings if already handled
    }
  }

  try {
    const [legacyClusters] = await pool.query<any[]>("SELECT id, college_name, district FROM clusters WHERE (college_id IS NULL OR college_id = '') AND college_name IS NOT NULL AND TRIM(college_name) <> ''");
    for (const cluster of legacyClusters) {
      const collegeId = `college-legacy-${cluster.id}`;
      await pool.query('INSERT INTO colleges (id, name, district) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), district = VALUES(district)', [collegeId, cluster.college_name, cluster.district]);
      await pool.query('UPDATE clusters SET college_id = ? WHERE id = ?', [collegeId, cluster.id]);
    }
  } catch (err: any) {
    console.warn('[DB WARNING] Could not backfill college mappings:', err.message);
  }

  try {
    await pool.query('CREATE UNIQUE INDEX uk_sessions_year_day_cluster ON sessions (academic_year_id, day_id, cluster_id)');
  } catch {
    // The index already exists or legacy duplicate rows require manual cleanup.
  }
  try {
    await pool.query("ALTER TABLE users MODIFY COLUMN status ENUM('ACTIVE','INACTIVE','BLOCKED') NOT NULL DEFAULT 'ACTIVE'");
  } catch {
    // Existing installations may already have the expanded status enum.
  }

  // 3. Seed default Super Admin account if not present
  const defaultPasswordHash = await bcrypt.hash('admin123', 10);
  try {
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, cluster_id, phone, must_change_password, status)
       VALUES
         ('usr-super-admin', 'Super Admin', 'admin@tqi.org', ?, 'SUPER_ADMIN', NULL, '+91 90000 00000', FALSE, 'ACTIVE'),
         ('usr-admin-alias', 'Super Admin', 'admin', ?, 'SUPER_ADMIN', NULL, '+91 90000 00000', FALSE, 'ACTIVE'),
         ('usr-admin-gmail', 'Admin', 'admin@gmail.com', ?, 'SUPER_ADMIN', NULL, NULL, FALSE, 'ACTIVE')
       ON DUPLICATE KEY UPDATE
         password_hash = VALUES(password_hash),
         name = VALUES(name),
         role = VALUES(role),
         must_change_password = FALSE,
         status = 'ACTIVE'`,
      [defaultPasswordHash, defaultPasswordHash, defaultPasswordHash]
    );
    console.log('[DB] Super Admin accounts verified.');
  } catch (err: any) {
    console.warn('[DB WARNING] Could not seed Super Admin:', err.message);
  }

  // 4. Seed default Academic Year if empty
  try {
    await pool.query(
      `INSERT INTO academic_years (id, name, start_date, end_date, is_active, created_by)
       VALUES ('ay-2025-2026', '2025-2026', '2025-06-01', '2026-05-31', TRUE, 'usr-super-admin')
       ON DUPLICATE KEY UPDATE name = VALUES(name)`
    );
  } catch (err: any) {
    // benign
  }

  // 5. Seed default standard modules if none exist
  try {
    const [existingModules] = await pool.query<any[]>('SELECT COUNT(*) as count FROM modules');
    if (existingModules[0]?.count === 0) {
      await pool.query(
        `INSERT INTO modules (id, name, code, description, is_active) VALUES
         ('module-english', 'Spoken English', 'ENG-01', 'English learning module', TRUE),
         ('module-maths', 'Mathematics Basics', 'MATH-02', 'Mathematics module', TRUE),
         ('module-life-skills', 'Life Skills', 'LIFE-03', 'Life skills and confidence building', TRUE)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`
      );
      console.log('[DB] Seeded standard foundation modules.');
    }
  } catch (err: any) {
    // benign
  }

  // 6. Record any filesystem migration files if available
  try {
    const possibleMigrationDirs = [
      path.resolve(process.cwd(), 'database', 'migrations'),
      path.resolve(process.cwd(), '..', 'database', 'migrations'),
    ];
    for (const dir of possibleMigrationDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
        for (const file of files) {
          await pool.query('INSERT IGNORE INTO schema_migrations (version) VALUES (?)', [file]);
        }
        break;
      }
    }
  } catch (err: any) {
    // benign
  }

  console.log('[DB] Database schema and tables initialization complete.');
}
