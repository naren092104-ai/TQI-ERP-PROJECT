-- TQI-ERP v2: workflow
-- approvals, date_change_requests, session_submissions.

CREATE TABLE IF NOT EXISTS approvals (
  id           VARCHAR(64) NOT NULL,
  module       VARCHAR(64) NOT NULL,
  status       ENUM('Pending','Open','Approved','Rejected','Correction Requested') NOT NULL DEFAULT 'Pending',
  requested_by VARCHAR(64) NULL,
  session_id   VARCHAR(64) NULL,
  academic_year_id VARCHAR(64) NULL,
  remarks      TEXT        NULL,
  date         DATE        NULL,
  cluster_id   VARCHAR(64) NULL,
  created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_approvals_cluster (cluster_id),
  INDEX idx_approvals_session (session_id),
  INDEX idx_approvals_year (academic_year_id),
  INDEX idx_approvals_status (status),
  INDEX idx_approvals_created (created_at),
  CONSTRAINT fk_approvals_cluster
    FOREIGN KEY (cluster_id) REFERENCES clusters(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_approvals_session
    FOREIGN KEY (session_id) REFERENCES sessions(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_approvals_user
    FOREIGN KEY (requested_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS date_change_requests (
  id             VARCHAR(64) NOT NULL,
  session_id     VARCHAR(64) NOT NULL,
  cluster_id     VARCHAR(64) NOT NULL,
  academic_year_id VARCHAR(64) NULL,
  original_date  DATE        NOT NULL,
  requested_date DATE        NOT NULL,
  reason         TEXT        NOT NULL,
  status         ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  reviewed_by    VARCHAR(64) NULL,
  review_remarks TEXT        NULL,
  reviewed_at    TIMESTAMP   NULL,
  requested_by   VARCHAR(64) NULL,
  created_at     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_dcr_session (session_id),
  INDEX idx_dcr_cluster (cluster_id),
  INDEX idx_dcr_year (academic_year_id),
  INDEX idx_dcr_status (status),
  INDEX idx_dcr_created (created_at),
  CONSTRAINT fk_dcr_session
    FOREIGN KEY (session_id) REFERENCES sessions(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_dcr_cluster
    FOREIGN KEY (cluster_id) REFERENCES clusters(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_dcr_reviewer
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_dcr_requester
    FOREIGN KEY (requested_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS session_submissions (
  id                   VARCHAR(64) NOT NULL,
  session_id           VARCHAR(64) NOT NULL,
  cluster_id           VARCHAR(64) NOT NULL,
  academic_year_id     VARCHAR(64) NULL,
  day_number           INT         NOT NULL,
  attendance_complete  BOOLEAN     NOT NULL DEFAULT FALSE,
  lesson_plan_complete BOOLEAN     NOT NULL DEFAULT FALSE,
  photos_complete      BOOLEAN     NOT NULL DEFAULT FALSE,
  report_complete      BOOLEAN     NOT NULL DEFAULT FALSE,
  finance_complete     BOOLEAN     NOT NULL DEFAULT FALSE,
  status               ENUM('Draft','Submitted','Approved','Resubmission Required','Resubmitted') NOT NULL DEFAULT 'Draft',
  submitted_at         TIMESTAMP   NULL,
  submitted_by         VARCHAR(64) NULL,
  reviewed_by          VARCHAR(64) NULL,
  reviewed_at          TIMESTAMP   NULL,
  review_remarks       TEXT        NULL,
  resubmission_reason  TEXT        NULL,
  resubmitted_at       TIMESTAMP   NULL,
  created_at           TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_submissions_session_day (session_id, day_number),
  INDEX idx_submissions_cluster (cluster_id),
  INDEX idx_submissions_year (academic_year_id),
  INDEX idx_submissions_status (status),
  INDEX idx_submissions_created (created_at),
  INDEX idx_submissions_updated (updated_at),
  CONSTRAINT fk_submissions_session
    FOREIGN KEY (session_id) REFERENCES sessions(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_submissions_cluster
    FOREIGN KEY (cluster_id) REFERENCES clusters(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_submissions_submitter
    FOREIGN KEY (submitted_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_submissions_reviewer
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
