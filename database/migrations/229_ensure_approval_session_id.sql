-- Older databases can retain the legacy approvals schema without the canonical
-- session_id column required by attendance review queries and inserts.
ALTER TABLE approvals ADD COLUMN session_id VARCHAR(64) NULL;
