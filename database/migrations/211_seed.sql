-- TQI-ERP v2: seed Super Admin and Default Foundation data
-- Create a default Super Admin only for an empty users table and never overwrite live credentials.
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `cluster_id`, `phone`, `must_change_password`, `status`)
SELECT
  'usr-super-admin',
  'Super Admin',
  'admin@tqi.org',
  '$2b$10$dlTJOo.x9XJ0eeX2hHVvSuXPVUw8WR4R5pehnb998pg./BF6rb25q',
  'Super Admin',
  NULL,
  '+91 90000 00000',
  FALSE,
  'Active'
WHERE NOT EXISTS (SELECT 1 FROM `users` LIMIT 1)
ON DUPLICATE KEY UPDATE
  `password_hash` = VALUES(`password_hash`),
  `name` = VALUES(`name`),
  `role` = VALUES(`role`),
  `status` = 'Active';

INSERT INTO `modules` (`id`, `name`, `code`, `description`, `is_active`)
VALUES
  ('module-english', 'Spoken English', 'ENG-01', 'English communication & vocabulary', TRUE),
  ('module-maths', 'Mathematics Basics', 'MATH-02', 'Foundational arithmetic & problem solving', TRUE),
  ('module-life-skills', 'Life Skills', 'LIFE-03', 'Critical thinking, ethics & leadership', TRUE)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `is_active` = TRUE;
