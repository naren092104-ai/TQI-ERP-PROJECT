CREATE TABLE IF NOT EXISTS students (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) NULL,
  name VARCHAR(255) NOT NULL,
  gender ENUM('male','female','other') NULL,
  dob DATE NULL,
  standard VARCHAR(100) NULL,
  cluster_id VARCHAR(64) NOT NULL,
  panchayat_id VARCHAR(64) NOT NULL,
  village_id VARCHAR(64) NOT NULL,
  parent_name VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_students_cluster (cluster_id),
  INDEX idx_students_panchayat (panchayat_id),
  INDEX idx_students_village (village_id)
);

CREATE TABLE IF NOT EXISTS volunteers (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  cluster_id VARCHAR(64) NOT NULL,
  panchayat_id VARCHAR(64) NULL,
  department VARCHAR(255) NULL,
  role VARCHAR(64) NULL,
  status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_volunteers_cluster (cluster_id),
  INDEX idx_volunteers_panchayat (panchayat_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) NULL,
  name VARCHAR(255) NOT NULL,
  module_id VARCHAR(64) NULL,
  cluster_id VARCHAR(64) NOT NULL,
  panchayat_id VARCHAR(64) NOT NULL,
  village_id VARCHAR(64) NULL,
  volunteer_id VARCHAR(64) NULL,
  date DATE NOT NULL,
  time VARCHAR(50) NULL,
  session_status VARCHAR(64) NOT NULL DEFAULT 'Draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sessions_cluster (cluster_id),
  INDEX idx_sessions_panchayat (panchayat_id),
  INDEX idx_sessions_status (session_status),
  INDEX idx_sessions_date (date)
);
