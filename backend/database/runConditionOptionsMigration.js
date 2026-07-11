/**
 * Expand inventory_items.condition ENUM with additional asset conditions.
 * Safe to run multiple times. Existing values (including Good) are preserved.
 */
const pool = require('../config/database');

const CONDITION_ENUM_SQL = `ENUM(
  'New',
  'Excellent',
  'Good',
  'Fair',
  'Poor',
  'For Repair',
  'Damaged',
  'Unserviceable'
)`;

async function runConditionOptionsMigration() {
  console.log('Running condition options migration...');

  const [rows] = await pool.query(
    `SELECT COLUMN_TYPE, COLUMN_DEFAULT, IS_NULLABLE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'inventory_items'
       AND COLUMN_NAME = 'condition'`
  );

  if (!rows.length) {
    console.log('inventory_items.condition not found; skipping.');
    return { applied: false };
  }

  const columnType = String(rows[0].COLUMN_TYPE || '');
  const required = ['Excellent', 'For Repair', 'Unserviceable'];
  const alreadyApplied = required.every((value) => columnType.includes(`'${value}'`));

  if (alreadyApplied) {
    console.log('Condition options migration already applied.');
    return { applied: false };
  }

  const nullable = String(rows[0].IS_NULLABLE || '').toUpperCase() === 'YES' ? 'NULL' : 'NOT NULL';
  const defaultValue = rows[0].COLUMN_DEFAULT != null ? `'${rows[0].COLUMN_DEFAULT}'` : `'Good'`;

  await pool.query(
    `ALTER TABLE inventory_items
     MODIFY COLUMN \`condition\` ${CONDITION_ENUM_SQL} ${nullable} DEFAULT ${defaultValue}`
  );

  console.log('Condition options migration completed.');
  return { applied: true };
}

if (require.main === module) {
  runConditionOptionsMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = { runConditionOptionsMigration };
