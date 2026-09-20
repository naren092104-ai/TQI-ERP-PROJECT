-- TQI-ERP v2: sessions, modules, academic setup
-- All session/module metadata. Sessions reference modules, clusters, panchayats,
-- villages, and volunteers. Academic_setup is the per-day session name table.

CREATE TABLE IF NOT EXISTS academic_years (
  id         VARCHAR(64)  NOT NULL,
  name       VARCHAR(100) NOT NULL,
  start_date DATE         NULL,
  end_date   DATE         NULL,
  is_active  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_academic_years_name (name),
  INDEX idx_academic_years_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS academic_setup (
  day_number    INT          NOT NULL,
  academic_year VARCHAR(50)  NOT NULL,
  session_name  VARCHAR(255) NULL,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (day_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS modules (
  id          VARCHAR(64)  NOT NULL,
  code        VARCHAR(64)  NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT         NULL,
  academic_year VARCHAR(50) NULL,
  day_number  INT          NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_modules_code (code),
  INDEX idx_modules_name (name),
  INDEX idx_modules_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS module_resources (
  id                VARCHAR(64)  NOT NULL,
  module_id         VARCHAR(64)  NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_path         VARCHAR(500) NOT NULL,
  file_url          VARCHAR(500) NULL,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_module_resources_module (module_id),
  CONSTRAINT fk_module_resources_module
    FOREIGN KEY (module_id) REFERENCES modules(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id             VARCHAR(64)  NOT NULL,
  code           VARCHAR(64)  NULL,
  name           VARCHAR(255) NULL,
  module_id      VARCHAR(64)  NULL,
  cluster_id     VARCHAR(64)  NULL,
  panchayat_id   VARCHAR(64)  NULL,
  village_id     VARCHAR(64)  NULL,
  volunteer_id   VARCHAR(64)  NULL,
  academic_year  VARCHAR(50)  NULL,
  day_number     INT          NULL,
  session_date_fixed BOOLEAN  NOT NULL DEFAULT FALSE,
  session_date_fixed_at DATETIME NULL,
  session_date_fixed_by VARCHAR(64) NULL,
  date           DATE         NULL,
  time           VARCHAR(50)  NULL,
  session_status ENUM('Draft','Scheduled','In Progress','Submitted','Pending Review','Approved','Resubmission Required','Resubmitted','Completed','Cancelled') NOT NULL DEFAULT 'Draft',
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_sessions_cluster (cluster_id),
  INDEX idx_sessions_panchayat (panchayat_id),
  INDEX idx_sessions_village (village_id),
  INDEX idx_sessions_volunteer (volunteer_id),
  INDEX idx_sessions_module (module_id),
  INDEX idx_sessions_status (session_status),
  INDEX idx_sessions_date (date),
  INDEX idx_sessions_cluster_date (cluster_id, date),
  CONSTRAINT fk_sessions_module
    FOREIGN KEY (module_id) REFERENCES modules(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_sessions_cluster
    FOREIGN KEY (cluster_id) REFERENCES clusters(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_sessions_panchayat
    FOREIGN KEY (panchayat_id) REFERENCES panchayats(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_sessions_village
    FOREIGN KEY (village_id) REFERENCES villages(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_sessions_volunteer
    FOREIGN KEY (volunteer_id) REFERENCES volunteers(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
