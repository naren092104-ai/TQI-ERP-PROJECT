const mysql = require('mysql2/promise');

async function migrate() {
  const pool = mysql.createPool({ host: 'localhost', user: 'root', password: 'root', database: 'TQI_ERP' });
  try {
    await pool.query('ALTER TABLE modules ADD COLUMN academic_year VARCHAR(50) NULL, ADD COLUMN day_number INT NULL').catch(e => console.log('Notice:', e.message));
    const [cols] = await pool.query('SHOW COLUMNS FROM modules');
    console.log('Modules columns:', cols.map(c => c.Field));
  } finally {
    await pool.end();
  }
}

migrate();
