CREATE TABLE IF NOT EXISTS maintenance_settings (
  id VARCHAR(100) NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  title VARCHAR(255) NOT NULL DEFAULT 'Website Under Maintenance',
  message TEXT NOT NULL,
  expected_completion DATETIME NULL,
  show_countdown TINYINT(1) NOT NULL DEFAULT 0,
  auto_disable TINYINT(1) NOT NULL DEFAULT 0,
  enabled_at DATETIME NULL,
  enabled_by VARCHAR(64) NULL,
  disabled_at DATETIME NULL,
  disabled_by VARCHAR(64) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_maintenance_settings_enabled_by FOREIGN KEY (enabled_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_maintenance_settings_disabled_by FOREIGN KEY (disabled_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO maintenance_settings (id, enabled, title, message, expected_completion, show_countdown, auto_disable, enabled_at, enabled_by, disabled_at, disabled_by, updated_at)
VALUES ('website_maintenance', 0, 'Website Under Maintenance', 'We are currently performing scheduled maintenance and system improvements. Please check back shortly.', NULL, 0, 0, NULL, NULL, NULL, NULL, NOW())
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  message = VALUES(message),
  expected_completion = VALUES(expected_completion),
  show_countdown = VALUES(show_countdown),
  auto_disable = VALUES(auto_disable),
  enabled_at = VALUES(enabled_at),
  enabled_by = VALUES(enabled_by),
  disabled_at = VALUES(disabled_at),
  disabled_by = VALUES(disabled_by),
  updated_at = NOW();
