-- Store volunteer gender for directory, attendance, and profile views.
ALTER TABLE volunteers
  ADD COLUMN gender ENUM('male', 'female', 'other') NULL AFTER name;
