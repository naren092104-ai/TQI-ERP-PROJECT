-- Link an approval request to its source record independently of a scheduled session.
ALTER TABLE approvals ADD COLUMN record_id VARCHAR(64) NULL;
