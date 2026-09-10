-- TQI-ERP v2: notifications, audit_logs, auth_otps

CREATE TABLE IF NOT EXISTS notifications (
  id         VARCHAR(64)  NOT NULL,
  user_id    VARCHAR(64)  NULL,
  title      VARCHAR(255) NOT NULL,
  message    TEXT         NOT NULL,
  type       VARCHAR(64)  NOT NULL,
  is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_notifications_user (user_id),
  INDEX idx_notifications_read (is_read),
  INDEX idx_notifications_created (created_at),
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id         VARCHAR(64)  NOT NULL,
  user_id    VARCHAR(64)  NULL,
  user_name  VARCHAR(255) NULL,
  role       VARCHAR(64)  NULL,
  cluster_id VARCHAR(64)  NULL,
  action     VARCHAR(255) NOT NULL,
  module     VARCHAR(128) NULL,
  record_id  VARCHAR(64)  NULL,
  details    TEXT         NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_audit_cluster (cluster_id),
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_module (module),
  INDEX idx_audit_created (created_at),
  CONSTRAINT fk_audit_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_audit_cluster
    FOREIGN KEY (cluster_id) REFERENCES clusters(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_otps (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email      VARCHAR(255)    NOT NULL,
  otp_hash   VARCHAR(255)    NOT NULL,
  expires_at DATETIME        NOT NULL,
  attempts   INT             NOT NULL DEFAULT 0,
  used_at    DATETIME        NULL,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_auth_otps_email_created (email, created_at),
  INDEX idx_auth_otps_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
