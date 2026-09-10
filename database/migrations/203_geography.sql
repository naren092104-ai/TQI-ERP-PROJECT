-- TQI-ERP v2: geography
-- panchayats and villages, both rooted at clusters.

CREATE TABLE IF NOT EXISTS panchayats (
  id         VARCHAR(64)  NOT NULL,
  name       VARCHAR(255) NOT NULL,
  cluster_id VARCHAR(64)  NOT NULL,
  status     ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_panchayats_cluster (cluster_id),
  INDEX idx_panchayats_cluster_name (cluster_id, name),
  CONSTRAINT fk_panchayats_cluster
    FOREIGN KEY (cluster_id) REFERENCES clusters(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS villages (
  id           VARCHAR(64)  NOT NULL,
  name         VARCHAR(255) NOT NULL,
  panchayat_id VARCHAR(64)  NOT NULL,
  cluster_id   VARCHAR(64)  NOT NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_villages_panchayat (panchayat_id),
  INDEX idx_villages_cluster (cluster_id),
  INDEX idx_villages_name (name),
  CONSTRAINT fk_villages_panchayat
    FOREIGN KEY (panchayat_id) REFERENCES panchayats(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_villages_cluster
    FOREIGN KEY (cluster_id) REFERENCES clusters(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
