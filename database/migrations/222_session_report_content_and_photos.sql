-- Store report outcomes separately from the overview and keep uploaded photos
-- explicitly attached to a report without duplicating master-data names.
ALTER TABLE session_reports ADD COLUMN outcome TEXT NULL AFTER activities;

CREATE TABLE IF NOT EXISTS session_report_photos (
  id VARCHAR(64) NOT NULL,
  session_report_id VARCHAR(64) NOT NULL,
  academic_year_id VARCHAR(64) NOT NULL,
  cluster_id VARCHAR(64) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
  uploaded_by VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_session_report_photos_report (session_report_id),
  INDEX idx_session_report_photos_year_cluster (academic_year_id, cluster_id),
  CONSTRAINT fk_session_report_photos_report
    FOREIGN KEY (session_report_id) REFERENCES session_reports(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_session_report_photos_year
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_session_report_photos_cluster
    FOREIGN KEY (cluster_id) REFERENCES clusters(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_session_report_photos_user
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;