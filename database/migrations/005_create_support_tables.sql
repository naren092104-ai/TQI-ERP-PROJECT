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
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NULL,
  user_name VARCHAR(255) NULL,
  role VARCHAR(64) NULL,
  cluster_id VARCHAR(64) NULL,
  action VARCHAR(255) NOT NULL,
  module VARCHAR(128) NOT NULL,
  record_id VARCHAR(64) NULL,
  details TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_cluster (cluster_id),
  INDEX idx_audit_module (module),
  INDEX idx_audit_user (user_id)
);

CREATE TABLE IF NOT EXISTS modules (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(64) NULL,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS module_resources (
  id VARCHAR(64) PRIMARY KEY,
  module_id VARCHAR(64) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  drive_url VARCHAR(500) NULL,
  mime_type VARCHAR(100) NULL,
  last_modified TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_module_resources_module (module_id)
);
