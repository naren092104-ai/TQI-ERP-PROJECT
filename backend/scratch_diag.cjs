const mysql = require('mysql2/promise');

async function diagnose() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'TQI_ERP'
  });

  const check = async (name, fn) => {
    try {
      await fn();
      console.log('✅', name);
    } catch (e) {
      console.log('❌', name, ':', e.message);
    }
  };

  try {
    await check('sessions', () => pool.query("INSERT INTO sessions (id, name, cluster_id, date, session_status) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)", ["test-s", "S", "dharmapuri", "2026-09-25", "Scheduled"]));
    await check('attendance_sessions', () => pool.query("INSERT INTO attendance_sessions (id, session_id, cluster_id, panchayat_id, village_id, day_number, status, present_count, total_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", ["test-att", "test-s", "dharmapuri", "p", "v", 1, "Submitted", 1, 1]));
    await check('student_attendance', () => pool.query("INSERT INTO student_attendance (id, attendance_session_id, student_id, present, task_status) VALUES (?, ?, ?, ?, ?)", ["test-sa", "test-att", "stu-1", 1, "Completed"]));
    await check('volunteer_attendance', () => pool.query("INSERT INTO volunteer_attendance (id, attendance_session_id, volunteer_id, present) VALUES (?, ?, ?, ?)", ["test-va", "test-att", "vol-1", 1]));
    await check('lesson_plans', () => pool.query("INSERT INTO lesson_plans (id, session_id, module_id, cluster_id, panchayat_id, title, topic, objective, activities, materials, duration, remarks, teaching_method, assessment_task, target_standard, learning_outcomes, day_number, volunteer_id, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ["test-lp", "test-s", "module-english", "dharmapuri", "", "T", null, null, null, null, null, "{}", null, null, null, null, 1, null, "Draft", "usr-super-admin"]));
    await check('session_reports', () => pool.query("INSERT INTO session_reports (id, session_id, cluster_id, day_number, session_summary, student_count, attendance_summary, activities, issues, remarks, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ["test-rep", "test-s", "dharmapuri", 1, "S", 1, "A", "act", "iss", "rem", "Draft", "usr-super-admin"]));
    await check('date_change_requests', () => pool.query("INSERT INTO date_change_requests (id, session_id, cluster_id, original_date, requested_date, reason, status, requested_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", ["test-dcr", "test-s", "dharmapuri", "2026-09-25", "2026-09-28", "R", "Pending", "usr-super-admin"]));
    await check('modules', () => pool.query("INSERT INTO modules (id, code, name, description, is_active, academic_year, day_number) VALUES (?, ?, ?, ?, 1, ?, ?)", ["test-mod", "M", "N", "D", "2025-2026", 1]));

    await pool.query("DELETE FROM student_attendance WHERE id = 'test-sa'").catch(() => {});
    await pool.query("DELETE FROM volunteer_attendance WHERE id = 'test-va'").catch(() => {});
    await pool.query("DELETE FROM attendance_sessions WHERE id = 'test-att'").catch(() => {});
    await pool.query("DELETE FROM lesson_plans WHERE id = 'test-lp'").catch(() => {});
    await pool.query("DELETE FROM session_reports WHERE id = 'test-rep'").catch(() => {});
    await pool.query("DELETE FROM date_change_requests WHERE id = 'test-dcr'").catch(() => {});
    await pool.query("DELETE FROM modules WHERE id = 'test-mod'").catch(() => {});
    await pool.query("DELETE FROM sessions WHERE id = 'test-s'").catch(() => {});
  } finally {
    await pool.end();
  }
}

diagnose();
