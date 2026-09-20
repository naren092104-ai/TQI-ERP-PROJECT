const mysql = require('mysql2/promise');

async function testAttendanceAndLessonPlan() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'TQI_ERP'
  });

  try {
    const clusterId = 'test-cl-1789826026593';
    const sessionId = `academic-session-${clusterId}-1`;
    const attId = `att-test-123`;

    const [sessRows] = await pool.query('SELECT * FROM sessions WHERE id = ?', [sessionId]);
    console.log('Session in DB:', sessRows);

    console.log('1. Testing attendance_sessions insert:');
    try {
      await pool.query(
        'INSERT INTO attendance_sessions (id, session_id, cluster_id, panchayat_id, village_id, day_number, status, present_count, total_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE session_id = VALUES(session_id)',
        [attId, sessionId, clusterId, 'p1', 'v1', 1, 'Submitted', 1, 1]
      );
      console.log('✅ attendance_sessions OK');
    } catch (e) {
      console.log('❌ attendance_sessions failed:', e.code, e.message);
    }

    console.log('2. Testing approvals insert:');
    try {
      await pool.query(
        `INSERT INTO approvals (id, module, status, requested_by, session_id, cluster_id, date)
         SELECT ?, ?, ?, ?, ?, ?, CURDATE()
         WHERE NOT EXISTS (SELECT 1 FROM approvals WHERE session_id = ? AND status IN ('Open', 'Pending'))`,
        ['app-test-123', 'Attendance', 'Pending', 'usr-admin', attId, clusterId, attId]
      );
      console.log('✅ approvals OK');
    } catch (e) {
      console.log('❌ approvals failed:', e.code, e.message);
    }

    console.log('3. Testing lesson_plans insert:');
    try {
      const extraMeta = { test: true };
      await pool.query(
        `INSERT INTO lesson_plans (id, session_id, module_id, cluster_id, panchayat_id, title, topic, objective, activities, materials, duration, remarks, teaching_method, assessment_task, target_standard, learning_outcomes, day_number, volunteer_id, status, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'lp-test-123', sessionId, 'module-english', clusterId, 'p1', 'Phonetics',
          'Alphabet', 'Read words', null, null, null, JSON.stringify(extraMeta),
          null, null, null, null, 1, null, 'Submitted', 'usr-admin'
        ]
      );
      console.log('✅ lesson_plans OK');
    } catch (e) {
      console.log('❌ lesson_plans failed:', e.code, e.message);
    }

  } finally {
    await pool.end();
  }
}

testAttendanceAndLessonPlan();
