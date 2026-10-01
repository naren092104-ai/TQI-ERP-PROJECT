-- Upload metadata is optional for older photos but is used for new uploads.
ALTER TABLE session_photos ADD COLUMN mime_type VARCHAR(255) NULL;
ALTER TABLE session_photos ADD COLUMN file_size BIGINT NULL;
