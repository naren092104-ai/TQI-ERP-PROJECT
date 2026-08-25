-- Migration 012: Fix Schema Drift
-- Reconciles modules (005 vs 007), approvals (code vs schema), and adds missing FK columns

-- modules: add missing columns from migration 007
ALTER TABLE modules ADD COLUMN module_number VARCHAR(50) NULL AFTER id;
ALTER TABLE modules ADD COLUMN module_name VARCHAR(255) NULL AFTER module_number;
ALTER TABLE modules ADD COLUMN topic VARCHAR(255) NULL;
ALTER TABLE modules ADD COLUMN academic_year VARCHAR(50) NULL;
ALTER TABLE modules ADD COLUMN day_number INT NULL;
ALTER TABLE modules ADD COLUMN status VARCHAR(64) NOT NULL DEFAULT 'Active';
ALTER TABLE modules ADD COLUMN created_by VARCHAR(64) NULL;
ALTER TABLE modules ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- modules: add indexes
CREATE INDEX idx_modules_status ON modules(status);
CREATE INDEX idx_modules_day ON modules(day_number);

-- approvals: Reconcile code vs schema
ALTER TABLE approvals ADD COLUMN type VARCHAR(64) NULL;
ALTER TABLE approvals ADD COLUMN reference VARCHAR(64) NULL;
ALTER TABLE approvals ADD COLUMN requestedBy VARCHAR(64) NULL;
ALTER TABLE approvals ADD COLUMN sessionId VARCHAR(64) NULL;
ALTER TABLE approvals ADD COLUMN remarks TEXT NULL;
ALTER TABLE approvals ADD COLUMN date DATE NULL;
ALTER TABLE approvals ADD COLUMN clusterId VARCHAR(64) NULL;
ALTER TABLE approvals ADD COLUMN reviewed_by VARCHAR(64) NULL;
ALTER TABLE approvals ADD COLUMN reviewed_at TIMESTAMP NULL;

-- finance_entries: Add session_id
ALTER TABLE finance_entries ADD COLUMN session_id VARCHAR(64) NULL;
CREATE INDEX idx_finance_session ON finance_entries(session_id);

-- volunteers: Add village_id
ALTER TABLE volunteers ADD COLUMN village_id VARCHAR(64) NULL;
CREATE INDEX idx_volunteers_village ON volunteers(village_id);

-- module_resources: add missing columns from 007
ALTER TABLE module_resources ADD COLUMN original_file_name VARCHAR(255) NULL;
ALTER TABLE module_resources ADD COLUMN file_path VARCHAR(500) NULL;
ALTER TABLE module_resources ADD COLUMN file_url VARCHAR(500) NULL;
ALTER TABLE module_resources ADD COLUMN file_size BIGINT NULL;
ALTER TABLE module_resources ADD COLUMN storage_provider VARCHAR(50) DEFAULT 'local';
ALTER TABLE module_resources ADD COLUMN drive_file_id VARCHAR(255) NULL;
ALTER TABLE module_resources ADD COLUMN drive_folder_id VARCHAR(255) NULL;
ALTER TABLE module_resources ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
