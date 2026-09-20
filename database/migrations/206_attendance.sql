-- TQI-ERP v2: attendance
-- attendance_sessions is the per-day attendance book and the
-- per-row records live in student_attendance / volunteer_attendance.
-- All child rows cascade from their parent.

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id           VARCHAR(64) NOT NULL,
  session_id   VARCHAR(64) NOT NULL,
  cluster_id   VARCHAR(64) NOT NULL,
  panchayat_id VARCHAR(64) NULL,
  village_id   VARCHAR(64) NULL,
  day_number   INT         NOT NULL,
  academic_year_id VARCHAR(64) NULL,
  status       ENUM('Draft','Submitted','Approved','Rejected','Edit Requested','Edit Approved','Resubmission') NOT NULL DEFAULT 'Draft',
  present_count INT        NOT NULL DEFAULT 0,
  total_count   INT        NOT NULL DEFAULT 0,
  task_completed_count INT NOT NULL DEFAULT 0,
  not_marked_count INT     NOT NULL DEFAULT 0,
  edit_reason  TEXT        NULL,
  edit_requested_by VARCHAR(128) NULL,
  edit_requested_at TIMESTAMP NULL,
  reviewed_by  VARCHAR(128) NULL,
  reviewed_at  TIMESTAMP   NULL,
  review_remarks TEXT      NULL,
  created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_attendance_session (session_id),
  INDEX idx_attendance_cluster (cluster_id),
  INDEX idx_attendance_day (day_number),
  INDEX idx_attendance_status (status),
  CONSTRAINT fk_attendance_session
    FOREIGN KEY (session_id) REFERENCES sessions(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_attendance_cluster
    FOREIGN KEY (cluster_id) REFERENCES clusters(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_attendance_panchayat
    FOREIGN KEY (panchayat_id) REFERENCES panchayats(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_attendance_village
    FOREIGN KEY (village_id) REFERENCES villages(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS student_attendance (
  id                    VARCHAR(64) NOT NULL,
  attendance_session_id VARCHAR(64) NOT NULL,
  student_id            VARCHAR(64) NOT NULL,
  present               TINYINT(1)  NULL DEFAULT NULL,
  task_status           VARCHAR(64) NULL DEFAULT NULL,
  created_at            TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_student_attendance_session (attendance_session_id),
  INDEX idx_student_attendance_student (student_id),
  CONSTRAINT fk_student_attendance_session
    FOREIGN KEY (attendance_session_id) REFERENCES attendance_sessions(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_student_attendance_student
    FOREIGN KEY (student_id) REFERENCES students(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS volunteer_attendance (
  id                    VARCHAR(64) NOT NULL,
  attendance_session_id VARCHAR(64) NOT NULL,
  volunteer_id          VARCHAR(64) NOT NULL,
  present               BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_volunteer_attendance_session (attendance_session_id),
  INDEX idx_volunteer_attendance_volunteer (volunteer_id),
  CONSTRAINT fk_volunteer_attendance_session
    FOREIGN KEY (attendance_session_id) REFERENCES attendance_sessions(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_volunteer_attendance_volunteer
    FOREIGN KEY (volunteer_id) REFERENCES volunteers(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
