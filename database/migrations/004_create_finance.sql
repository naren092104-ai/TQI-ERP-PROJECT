CREATE TABLE IF NOT EXISTS finance_entries (
  id VARCHAR(64) PRIMARY KEY,
  cluster_id VARCHAR(64) NOT NULL,
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
  INDEX idx_finance_date (date)
);

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
);

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
);

CREATE TABLE IF NOT EXISTS approvals (
  id VARCHAR(64) PRIMARY KEY,
  module VARCHAR(64) NOT NULL,
  record_id VARCHAR(64) NOT NULL,
  status VARCHAR(64) NOT NULL DEFAULT 'PENDING',
  requested_by VARCHAR(64) NULL,
  cluster_id VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_approvals_module (module),
  INDEX idx_approvals_status (status),
  INDEX idx_approvals_cluster (cluster_id)
);
