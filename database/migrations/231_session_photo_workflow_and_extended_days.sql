ALTER TABLE session_photos ADD COLUMN caption TEXT NULL;
ALTER TABLE session_photos ADD COLUMN photo_type ENUM('session','homework','feedback') NOT NULL DEFAULT 'session';
ALTER TABLE session_photos ADD COLUMN panchayat_id VARCHAR(64) NULL;
ALTER TABLE session_photos ADD COLUMN panchayat_name VARCHAR(255) NULL;
ALTER TABLE session_photos ADD COLUMN village_id VARCHAR(64) NULL;
ALTER TABLE session_photos ADD COLUMN village_name VARCHAR(255) NULL;
ALTER TABLE session_photos ADD COLUMN visit_date DATE NULL;

CREATE TABLE IF NOT EXISTS session_photo_submissions (
  id VARCHAR(64) NOT NULL,
  academic_year_id VARCHAR(64) NOT NULL,
  cluster_id VARCHAR(64) NOT NULL,
  day_number INT NOT NULL,
  status ENUM('Submitted','Approved','Changes Requested','Edit Approved') NOT NULL DEFAULT 'Submitted',
  submitted_by VARCHAR(64) NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by VARCHAR(64) NULL,
  reviewed_at TIMESTAMP NULL,
  review_remarks TEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_photo_submission_year_cluster_day (academic_year_id, cluster_id, day_number),
  INDEX idx_photo_submission_status (status),
  CONSTRAINT fk_photo_submission_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
  CONSTRAINT fk_photo_submission_cluster FOREIGN KEY (cluster_id) REFERENCES clusters(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS session_photo_delete_requests (
  id VARCHAR(64) NOT NULL,
  photo_id VARCHAR(64) NOT NULL,
  academic_year_id VARCHAR(64) NOT NULL,
  cluster_id VARCHAR(64) NOT NULL,
  requested_by VARCHAR(64) NULL,
  reason TEXT NOT NULL,
  status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  reviewed_by VARCHAR(64) NULL,
  reviewed_at TIMESTAMP NULL,
  review_remarks TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_photo_delete_request_photo (photo_id),
  INDEX idx_photo_delete_request_scope (academic_year_id, cluster_id, status),
  CONSTRAINT fk_photo_delete_request_photo FOREIGN KEY (photo_id) REFERENCES session_photos(id) ON DELETE CASCADE,
  CONSTRAINT fk_photo_delete_request_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
  CONSTRAINT fk_photo_delete_request_cluster FOREIGN KEY (cluster_id) REFERENCES clusters(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;