-- Persist the volunteer's current study year (for example, 1st Year or 4th Year).
ALTER TABLE volunteers
  ADD COLUMN study_year VARCHAR(32) NULL AFTER college_name;
