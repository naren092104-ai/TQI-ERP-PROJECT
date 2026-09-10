-- TQI-ERP v2: core identity
-- clusters and users, with FKs to each other.

CREATE TABLE IF NOT EXISTS clusters (
  id           VARCHAR(64)  NOT NULL,
  name         VARCHAR(255) NOT NULL,
  district     VARCHAR(255) NULL,
  state        VARCHAR(255) NULL,
  code         VARCHAR(64)  NULL,
  college_name VARCHAR(255) NULL,
  spoc_name    VARCHAR(255) NULL,
  spoc_mobile  VARCHAR(50)  NULL,
  admin_id     VARCHAR(64)  NULL,
  status       ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_clusters_name (name),
  INDEX idx_clusters_status (status),
  INDEX idx_clusters_admin (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id                   VARCHAR(64)  NOT NULL,
  name                 VARCHAR(255) NOT NULL,
  email                VARCHAR(255) NOT NULL,
  password_hash        VARCHAR(255) NOT NULL,
  role                 ENUM('Super Admin','Cluster Admin') NOT NULL,
  cluster_id           VARCHAR(64)  NULL,
  phone                VARCHAR(50)  NULL,
  must_change_password BOOLEAN      NOT NULL DEFAULT FALSE,
  status               ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_email (email),
  INDEX idx_users_role (role),
  INDEX idx_users_status (status),
  INDEX idx_users_cluster (cluster_id),
  INDEX idx_users_cluster_name (cluster_id, name),
  CONSTRAINT fk_users_cluster
    FOREIGN KEY (cluster_id) REFERENCES clusters(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- clusters.admin_id references users.id, declared via ALTER so the order of CREATE
-- TABLE statements above is preserved (users comes after clusters in the file).
ALTER TABLE clusters
  ADD CONSTRAINT fk_clusters_admin
  FOREIGN KEY (admin_id) REFERENCES users(id)
  ON DELETE SET NULL ON UPDATE CASCADE;
