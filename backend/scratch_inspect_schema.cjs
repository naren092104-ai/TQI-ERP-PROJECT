const mysql = require('mysql2/promise');

async function inspectSchema() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'TQI_ERP'
  });

  try {
    const [clusters] = await pool.query('SELECT id, name FROM clusters');
    console.log('Existing clusters in DB:', clusters);

    const [modulesCols] = await pool.query("SHOW COLUMNS FROM modules");
    console.log('modules table columns:', modulesCols.map(c => c.Field));

    const [sessionsCols] = await pool.query("SHOW COLUMNS FROM sessions");
    console.log('sessions table columns:', sessionsCols.map(c => c.Field));

    const [lessonCols] = await pool.query("SHOW COLUMNS FROM lesson_plans");
    console.log('lesson_plans table columns:', lessonCols.map(c => c.Field));

    const [approvalsCols] = await pool.query("SHOW COLUMNS FROM approvals");
    console.log('approvals table columns:', approvalsCols.map(c => c.Field));

    const [dcrCols] = await pool.query("SHOW COLUMNS FROM date_change_requests");
    console.log('date_change_requests table columns:', dcrCols.map(c => c.Field));

    const [repCols] = await pool.query("SHOW COLUMNS FROM session_reports");
    console.log('session_reports table columns:', repCols.map(c => c.Field));

    const [subCols] = await pool.query("SHOW COLUMNS FROM session_submissions");
    console.log('session_submissions table columns:', subCols.map(c => c.Field));

    const [academicSetup] = await pool.query("SELECT * FROM academic_setup");
    console.log('academic_setup rows:', academicSetup);

  } finally {
    await pool.end();
  }
}

inspectSchema();
