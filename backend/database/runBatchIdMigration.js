const pool = require('../config/database');

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function indexExists(table, indexName) {
  const [rows] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  return rows.length > 0;
}

async function runBatchIdMigration() {
  if (!(await columnExists('inventory_items', 'batch_id'))) {
    await pool.query(
      `ALTER TABLE inventory_items
       ADD COLUMN batch_id VARCHAR(30) NULL AFTER property_tag`
    );
    console.log('Added batch_id column to inventory_items.');
  }

  if (!(await indexExists('inventory_items', 'idx_inventory_batch_id'))) {
    await pool.query('ALTER TABLE inventory_items ADD INDEX idx_inventory_batch_id (batch_id)');
    console.log('Added idx_inventory_batch_id index.');
  }

  return { applied: true };
}

module.exports = { runBatchIdMigration };
