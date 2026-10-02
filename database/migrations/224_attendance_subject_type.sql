-- Keep student and volunteer attendance submissions separate for each location and day.
ALTER TABLE attendance_sessions
  ADD COLUMN attendance_type ENUM('students', 'volunteers') NOT NULL DEFAULT 'students' AFTER academic_year_id;

-- Preserve the intended subject for legacy records where only volunteer rows were saved.
UPDATE attendance_sessions attendance
LEFT JOIN (
  SELECT attendance_session_id, COUNT(*) AS record_count
  FROM student_attendance
  GROUP BY attendance_session_id
) students ON students.attendance_session_id = attendance.id
JOIN (
  SELECT attendance_session_id, COUNT(*) AS record_count
  FROM volunteer_attendance
  GROUP BY attendance_session_id
) volunteers ON volunteers.attendance_session_id = attendance.id
SET attendance.attendance_type = 'volunteers'
WHERE COALESCE(students.record_count, 0) = 0
  AND volunteers.record_count > 0;
