-- Password lifecycle metadata. Passwords remain bcrypt hashes in users.password_hash.
ALTER TABLE users
  ADD COLUMN password_changed_at DATETIME NULL AFTER must_change_password,
  ADD COLUMN password_reset_at DATETIME NULL AFTER password_changed_at,
  ADD COLUMN password_reset_by VARCHAR(64) NULL AFTER password_reset_at,
  ADD COLUMN password_created_at DATETIME NULL AFTER password_reset_by;

CREATE TABLE IF NOT EXISTS user_password_history (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  action ENUM('PASSWORD_CHANGED','PASSWORD_RESET','TEMP_PASSWORD_GENERATED','FORCE_PASSWORD_CHANGE_ENABLED') NOT NULL,
  changed_by VARCHAR(64) NULL,
  changed_by_name VARCHAR(255) NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_password_history_user (user_id, created_at),
  CONSTRAINT fk_password_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_password_history_actor FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE users SET password_created_at = COALESCE(password_changed_at, updated_at, created_at) WHERE password_created_at IS NULL;
