/**
 * Phase 1: normalize legacy quantity-based rows to property-based (one asset = one row).
 */
const pool = require('../config/database');

const LEGACY_STATUSES = ['Low Stock', 'Out of Stock', 'Unavailable'];

async function runPropertyBasedInventoryMigration() {
  const connection = await pool.getConnection();
  let normalizedQty = 0;
  let normalizedStatus = 0;

  try {
    const [qtyColumn] = await connection.query(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'quantity'`
    );

    await connection.beginTransaction();

    if (qtyColumn.length) {
      const [qtyRows] = await connection.query(
        `UPDATE inventory_items
         SET quantity = 1
         WHERE is_archived = 0
           AND quantity != 1
           AND migration_review_required = 0`
      );
      normalizedQty = qtyRows.affectedRows || 0;
    }

    const [statusRows] = await connection.query(
      `UPDATE inventory_items
       SET status = 'Available'
       WHERE is_archived = 0
         AND status IN (?, ?, ?)
         AND status != 'Disposed'`,
      LEGACY_STATUSES
    );
    normalizedStatus = statusRows.affectedRows || 0;

    await connection.commit();
    console.log(
      `Property-based inventory migration completed. Quantity normalized: ${normalizedQty}, status normalized: ${normalizedStatus}.`
    );
    return { normalizedQty, normalizedStatus };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = { runPropertyBasedInventoryMigration };
