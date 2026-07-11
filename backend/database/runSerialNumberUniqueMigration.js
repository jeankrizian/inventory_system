const pool = require('../config/database');

async function indexExists(table, indexName) {
  const [rows] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  return rows.length > 0;
}

async function dedupeSerialNumbers(conn) {
  await conn.query(
    `UPDATE inventory_items SET serial_number = NULL WHERE serial_number = ''`
  );

  const [dupes] = await conn.query(
    `SELECT serial_number, MIN(id) AS keep_id
     FROM inventory_items
     WHERE serial_number IS NOT NULL
     GROUP BY serial_number
     HAVING COUNT(*) > 1`
  );

  let cleared = 0;
  for (const row of dupes) {
    const [result] = await conn.query(
      `UPDATE inventory_items
       SET serial_number = NULL
       WHERE serial_number = ? AND id != ?`,
      [row.serial_number, row.keep_id]
    );
    cleared += result.affectedRows || 0;
  }

  return { duplicateGroups: dupes.length, clearedRows: cleared };
}

async function runSerialNumberUniqueMigration() {
  const connection = await pool.getConnection();
  let dedupeResult = { duplicateGroups: 0, clearedRows: 0 };

  try {
    await connection.beginTransaction();
    dedupeResult = await dedupeSerialNumbers(connection);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  if (!(await indexExists('inventory_items', 'uq_inventory_serial_number'))) {
    await pool.query(
      `ALTER TABLE inventory_items
       ADD UNIQUE INDEX uq_inventory_serial_number (serial_number)`
    );
    console.log('Added uq_inventory_serial_number unique index.');
  }

  if (dedupeResult.duplicateGroups > 0) {
    console.log(
      `Serial number dedupe: ${dedupeResult.duplicateGroups} duplicate group(s), cleared ${dedupeResult.clearedRows} row(s).`
    );
  }

  return { applied: true, ...dedupeResult };
}

module.exports = { runSerialNumberUniqueMigration };
