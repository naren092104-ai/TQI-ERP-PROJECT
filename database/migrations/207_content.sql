-- TQI-ERP v2: content
-- lesson_plans, session_photos, session_reports.

CREATE TABLE IF NOT EXISTS lesson_plans (
  id                VARCHAR(64)  NOT NULL,
  session_id        VARCHAR(64)  NULL,
  module_id         VARCHAR(64)  NULL,
  cluster_id        VARCHAR(64)  NOT NULL,
  panchayat_id      VARCHAR(64)  NULL,
  volunteer_id      VARCHAR(64)  NULL,
  title             VARCHAR(255) NOT NULL,
  topic             VARCHAR(255) NULL,
  objective         TEXT         NULL,
  activities        TEXT         NULL,
  materials         TEXT         NULL,
  duration          VARCHAR(100) NULL,
  remarks           TEXT         NULL,
  teaching_method   VARCHAR(255) NULL,
  assessment_task   TEXT         NULL,
  target_standard   VARCHAR(100) NULL,
  learning_outcomes TEXT         NULL,
  day_number        INT          NULL,
  status            ENUM('Draft','Submitted','Approved','Rejected') NOT NULL DEFAULT 'Draft',
  created_by        VARCHAR(64)  NULL,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_lesson_plans_cluster (cluster_id),
  INDEX idx_lesson_plans_session (session_id),
  INDEX idx_lesson_plans_module (module_id),
  INDEX idx_lesson_plans_created (created_at),
  CONSTRAINT fk_lesson_plans_cluster
    FOREIGN KEY (cluster_id) REFERENCES clusters(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_lesson_plans_session
    FOREIGN KEY (session_id) REFERENCES sessions(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_lesson_plans_module
    FOREIGN KEY (module_id) REFERENCES modules(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_lesson_plans_panchayat
    FOREIGN KEY (panchayat_id) REFERENCES panchayats(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_lesson_plans_volunteer
    FOREIGN KEY (volunteer_id) REFERENCES volunteers(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_lesson_plans_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS session_photos (
  id                VARCHAR(64)  NOT NULL,
  cluster_id        VARCHAR(64)  NOT NULL,
  session_id        VARCHAR(64)  NULL,
  day_number        INT          NOT NULL,
  file_path         VARCHAR(500) NOT NULL,
  file_url          VARCHAR(500) NULL,
  original_filename VARCHAR(255) NOT NULL,
  uploaded_by       VARCHAR(64)  NULL,
  uploaded_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_session_photos_cluster (cluster_id),
  INDEX idx_session_photos_session (session_id),
  INDEX idx_session_photos_day (day_number),
  INDEX idx_session_photos_uploaded (uploaded_at),
  CONSTRAINT fk_session_photos_cluster
    FOREIGN KEY (cluster_id) REFERENCES clusters(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_session_photos_session
    FOREIGN KEY (session_id) REFERENCES sessions(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_session_photos_user
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS session_reports (
  id                 VARCHAR(64) NOT NULL,
  session_id         VARCHAR(64) NOT NULL,
  cluster_id         VARCHAR(64) NOT NULL,
  day_number         INT         NULL,
  session_summary    TEXT        NULL,
  student_count      INT         NULL DEFAULT 0,
  attendance_summary TEXT        NULL,
  activities         TEXT        NULL,
  issues             TEXT        NULL,
  remarks            TEXT        NULL,
  status             ENUM('Draft','Submitted','Approved','Rejected') NOT NULL DEFAULT 'Draft',
  created_by         VARCHAR(64) NULL,
  created_at         TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_session_reports_session (session_id),
  INDEX idx_session_reports_cluster (cluster_id),
  INDEX idx_session_reports_created (created_at),
  CONSTRAINT fk_session_reports_session
    FOREIGN KEY (session_id) REFERENCES sessions(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_session_reports_cluster
    FOREIGN KEY (cluster_id) REFERENCES clusters(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_session_reports_user
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
