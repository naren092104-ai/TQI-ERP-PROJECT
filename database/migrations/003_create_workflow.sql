CREATE TABLE IF NOT EXISTS attendance_sessions (
  id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  cluster_id VARCHAR(64) NOT NULL,
  panchayat_id VARCHAR(64) NULL,
  village_id VARCHAR(64) NULL,
  day_number INT NOT NULL,
  status VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
  present_count INT NOT NULL DEFAULT 0,
  total_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_attendance_session (session_id),
  INDEX idx_attendance_cluster (cluster_id),
  INDEX idx_attendance_day (day_number),
  INDEX idx_attendance_status (status)
);

CREATE TABLE IF NOT EXISTS student_attendance (
  id VARCHAR(64) PRIMARY KEY,
  attendance_session_id VARCHAR(64) NOT NULL,
  student_id VARCHAR(64) NOT NULL,
  present BOOLEAN NOT NULL DEFAULT TRUE,
  task_status VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_student_attendance_session (attendance_session_id),
  INDEX idx_student_attendance_student (student_id)
);

CREATE TABLE IF NOT EXISTS volunteer_attendance (
  id VARCHAR(64) PRIMARY KEY,
  attendance_session_id VARCHAR(64) NOT NULL,
  volunteer_id VARCHAR(64) NOT NULL,
  present BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_volunteer_attendance_session (attendance_session_id),
  INDEX idx_volunteer_attendance_volunteer (volunteer_id)
);

CREATE TABLE IF NOT EXISTS lesson_plans (
  id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NULL,
  module_id VARCHAR(64) NULL,
  cluster_id VARCHAR(64) NOT NULL,
  panchayat_id VARCHAR(64) NULL,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
  created_by VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_lesson_plans_cluster (cluster_id),
  INDEX idx_lesson_plans_session (session_id),
  INDEX idx_lesson_plans_status (status)
);

CREATE TABLE IF NOT EXISTS session_photos (
  id VARCHAR(64) PRIMARY KEY,
  cluster_id VARCHAR(64) NOT NULL,
  session_id VARCHAR(64) NULL,
  day_number INT NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NULL,
  file_size BIGINT NULL,
  uploaded_by VARCHAR(64) NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session_photos_cluster (cluster_id),
  INDEX idx_session_photos_session (session_id),
  INDEX idx_session_photos_day (day_number)
);
