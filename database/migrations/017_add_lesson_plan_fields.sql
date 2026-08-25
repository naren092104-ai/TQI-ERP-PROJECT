-- Migration 017: Add Rich Lesson Plan Fields
-- Adds structured fields for the full lesson plan form

ALTER TABLE lesson_plans ADD COLUMN topic VARCHAR(255) NULL;
ALTER TABLE lesson_plans ADD COLUMN objective TEXT NULL;
ALTER TABLE lesson_plans ADD COLUMN activities TEXT NULL;
ALTER TABLE lesson_plans ADD COLUMN materials TEXT NULL;
ALTER TABLE lesson_plans ADD COLUMN duration VARCHAR(100) NULL;
ALTER TABLE lesson_plans ADD COLUMN remarks TEXT NULL;
ALTER TABLE lesson_plans ADD COLUMN teaching_method VARCHAR(255) NULL;
ALTER TABLE lesson_plans ADD COLUMN assessment_task TEXT NULL;
ALTER TABLE lesson_plans ADD COLUMN target_standard VARCHAR(100) NULL;
ALTER TABLE lesson_plans ADD COLUMN learning_outcomes TEXT NULL;
ALTER TABLE lesson_plans ADD COLUMN day_number INT NULL;
ALTER TABLE lesson_plans ADD COLUMN volunteer_id VARCHAR(64) NULL;
