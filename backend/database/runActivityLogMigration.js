const pool = require('../config/database');

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function runActivityLogMigration() {
  const columns = [
    ['entity_type', 'VARCHAR(50) NULL AFTER module'],
    ['entity_id', 'INT NULL AFTER entity_type'],
    ['field_name', 'VARCHAR(100) NULL AFTER entity_id'],
    ['old_value', 'TEXT NULL AFTER field_name'],
    ['new_value', 'TEXT NULL AFTER old_value'],
    ['reference_code', 'VARCHAR(100) NULL AFTER new_value']
  ];

  for (const [name, definition] of columns) {
    if (!(await columnExists('activity_logs', name))) {
      await pool.query(`ALTER TABLE activity_logs ADD COLUMN ${name} ${definition}`);
      console.log(`Added ${name} to activity_logs.`);
    }
  }

  return { applied: true };
}

module.exports = { runActivityLogMigration };
