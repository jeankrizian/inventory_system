const pool = require('../config/database');

const COLUMNS_TO_DROP = [
  'acquisition_cost',
  'low_stock_threshold',
  'unit',
  'available_quantity',
  'quantity'
];

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function runRemoveQuantityFieldsMigration() {
  const dropped = [];

  for (const column of COLUMNS_TO_DROP) {
    if (await columnExists('inventory_items', column)) {
      await pool.query(`ALTER TABLE inventory_items DROP COLUMN \`${column}\``);
      dropped.push(column);
    }
  }

  if (dropped.length) {
    console.log(`Removed quantity-based columns from inventory_items: ${dropped.join(', ')}`);
  } else {
    console.log('Quantity-based inventory columns already removed.');
  }

  return { dropped };
}

module.exports = { runRemoveQuantityFieldsMigration };
