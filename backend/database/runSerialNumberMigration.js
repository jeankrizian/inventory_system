const pool = require('../config/database');

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function runSerialNumberMigration() {
  if (!(await columnExists('inventory_items', 'serial_number'))) {
    await pool.query(
      `ALTER TABLE inventory_items
       ADD COLUMN serial_number VARCHAR(100) NULL AFTER batch_id`
    );
    console.log('Added serial_number column to inventory_items.');
  }

  return { applied: true };
}

module.exports = { runSerialNumberMigration };
