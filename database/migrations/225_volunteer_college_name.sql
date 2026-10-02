-- Store the volunteer's institution independently from the cluster's partner institution.
ALTER TABLE volunteers
  ADD COLUMN college_name VARCHAR(255) NULL AFTER phone;
