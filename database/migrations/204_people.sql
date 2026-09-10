-- TQI-ERP v2: people
-- students and volunteers, both rooted at cluster + panchayat (+ village).

CREATE TABLE IF NOT EXISTS students (
  id           VARCHAR(64)  NOT NULL,
  code         VARCHAR(64)  NULL,
  name         VARCHAR(255) NOT NULL,
  gender       ENUM('male','female','other') NULL,
  dob          DATE         NULL,
  standard     VARCHAR(100) NULL,
  cluster_id   VARCHAR(64)  NOT NULL,
  panchayat_id VARCHAR(64)  NOT NULL,
  village_id   VARCHAR(64)  NOT NULL,
  parent_name  VARCHAR(255) NULL,
  phone        VARCHAR(50)  NULL,
  status       ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_students_cluster (cluster_id),
  INDEX idx_students_panchayat (panchayat_id),
  INDEX idx_students_village (village_id),
  INDEX idx_students_cluster_name (cluster_id, name),
  CONSTRAINT fk_students_cluster
    FOREIGN KEY (cluster_id) REFERENCES clusters(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_students_panchayat
    FOREIGN KEY (panchayat_id) REFERENCES panchayats(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_students_village
    FOREIGN KEY (village_id) REFERENCES villages(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS volunteers (
  id           VARCHAR(64)  NOT NULL,
  name         VARCHAR(255) NOT NULL,
  email        VARCHAR(255) NULL,
  phone        VARCHAR(50)  NULL,
  cluster_id   VARCHAR(64)  NOT NULL,
  panchayat_id VARCHAR(64)  NULL,
  village_id   VARCHAR(64)  NULL,
  department   VARCHAR(255) NULL,
  role         VARCHAR(64)  NULL,
  status       ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_volunteers_cluster (cluster_id),
  INDEX idx_volunteers_panchayat (panchayat_id),
  INDEX idx_volunteers_village (village_id),
  INDEX idx_volunteers_cluster_name (cluster_id, name),
  CONSTRAINT fk_volunteers_cluster
    FOREIGN KEY (cluster_id) REFERENCES clusters(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_volunteers_panchayat
    FOREIGN KEY (panchayat_id) REFERENCES panchayats(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_volunteers_village
    FOREIGN KEY (village_id) REFERENCES villages(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
