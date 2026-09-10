-- TQI-ERP v2: finance
-- finance_entries only. (finance_drafts was a dead table — removed.)

CREATE TABLE IF NOT EXISTS finance_entries (
  id             VARCHAR(64)   NOT NULL,
  cluster_id     VARCHAR(64)   NOT NULL,
  date           DATE          NOT NULL,
  description    VARCHAR(255)  NOT NULL,
  category       VARCHAR(100)  NOT NULL,
  amount         DECIMAL(12,2) NOT NULL,
  created_by     VARCHAR(64)   NULL,
  status         ENUM('Draft','Submitted','Approved','Rejected') NOT NULL DEFAULT 'Draft',
  bill_reference VARCHAR(255)  NULL,
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_finance_cluster (cluster_id),
  INDEX idx_finance_date (date),
  INDEX idx_finance_status (status),
  CONSTRAINT fk_finance_cluster
    FOREIGN KEY (cluster_id) REFERENCES clusters(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_finance_user
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
