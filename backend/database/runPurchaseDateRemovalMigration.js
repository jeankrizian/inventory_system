/**
 * Collapse purchase_date into acquisition_date, then remove purchase_date.
 * Safe to run multiple times. Preserves existing acquisition_date values.
 */
const pool = require('../config/database');

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function runPurchaseDateRemovalMigration() {
  console.log('Running purchase date removal migration...');

  const hasPurchaseDate = await columnExists('inventory_items', 'purchase_date');
  if (!hasPurchaseDate) {
    console.log('Purchase date removal migration already applied.');
    return { applied: false };
  }

  const hasAcquisitionDate = await columnExists('inventory_items', 'acquisition_date');
  if (!hasAcquisitionDate) {
    await pool.query(
      `ALTER TABLE inventory_items ADD COLUMN acquisition_date DATE NULL`
    );
  }

  await pool.query(
    `UPDATE inventory_items
     SET acquisition_date = purchase_date
     WHERE acquisition_date IS NULL AND purchase_date IS NOT NULL`
  );

  await pool.query(`ALTER TABLE inventory_items DROP COLUMN purchase_date`);

  console.log('Purchase date removal migration completed.');
  return { applied: true };
}

if (require.main === module) {
  runPurchaseDateRemovalMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = { runPurchaseDateRemovalMigration };
