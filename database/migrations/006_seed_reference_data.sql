INSERT INTO modules (id, name, code, description, is_active) VALUES
('module-english', 'Spoken English', 'ENG-01', 'English learning module', TRUE),
('module-maths', 'Mathematics Basics', 'MATH-02', 'Mathematics module', TRUE),
('module-life-skills', 'Life Skills', 'LIFE-03', 'Life skills and confidence building', TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), code = VALUES(code), description = VALUES(description), is_active = VALUES(is_active);

INSERT INTO users (id, name, email, password_hash, role, cluster_id, phone, must_change_password, status) VALUES
('usr-super-admin', 'Admin', 'admin@tqi.org', '$2b$10$aj/FKfaYSD7AMMrckhHM.O7QWCzClwdCUzjSlHgJOcMWDxsSVsUu2', 'SUPER_ADMIN', NULL, '+91 90000 00000', FALSE, 'ACTIVE'),
('usr-admin-alias', 'Admin', 'admin', '$2b$10$aj/FKfaYSD7AMMrckhHM.O7QWCzClwdCUzjSlHgJOcMWDxsSVsUu2', 'SUPER_ADMIN', NULL, '+91 90000 00000', FALSE, 'ACTIVE')
ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), password_hash = VALUES(password_hash), role = VALUES(role), cluster_id = VALUES(cluster_id), phone = VALUES(phone), must_change_password = FALSE, status = VALUES(status);

