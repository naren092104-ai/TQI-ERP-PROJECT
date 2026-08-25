CREATE TABLE IF NOT EXISTS modules (
  id VARCHAR(64) PRIMARY KEY,
  module_number VARCHAR(50),
  module_name VARCHAR(255) NOT NULL,
  topic VARCHAR(255),
  description TEXT,
  academic_year VARCHAR(50),
  day_number INT,
  status VARCHAR(64) NOT NULL DEFAULT 'Active',
  created_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_modules_status (status),
  INDEX idx_modules_day (day_number)
);

CREATE TABLE IF NOT EXISTS module_resources (
  id VARCHAR(64) PRIMARY KEY,
  module_id VARCHAR(64) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  original_file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500),
  file_url VARCHAR(500),
  mime_type VARCHAR(100),
  file_size BIGINT,
  storage_provider VARCHAR(50) DEFAULT 'local',
  drive_file_id VARCHAR(255),
  drive_folder_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_mod_res_module (module_id),
  FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
);
