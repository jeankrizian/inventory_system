/**
 * Phase 13: backfill property tags and batch IDs for legacy inventory rows
 * while preserving transaction history (inventory_item_id references).
 */
const pool = require('../config/database');
const { generateAutoPropertyTags } = require('../utils/propertyTagGenerator');
const { generateNextBatchId } = require('../utils/batchIdGenerator');

const FIXED_ASSET_CLASSIFICATIONS = ['Non-Consumable (Fixed Asset)', 'Fixed Asset'];

const TRANSACTION_TABLES = [
  { table: 'borrow_items', column: 'inventory_item_id' },
  { table: 'maintenance_records', column: 'inventory_item_id' },
  { table: 'transfer_requests', column: 'inventory_item_id' },
  { table: 'disposal_requests', column: 'inventory_item_id' },
  { table: 'transfer_history', column: 'inventory_item_id' }
];

async function verifyInventoryTransactionIntegrity(conn = pool) {
  const issues = [];

  for (const { table, column } of TRANSACTION_TABLES) {
    const [rows] = await conn.query(
      `SELECT DISTINCT t.${column} AS inventory_item_id
       FROM ${table} t
       LEFT JOIN inventory_items i ON i.id = t.${column}
       WHERE t.${column} IS NOT NULL AND i.id IS NULL`
    );
    for (const row of rows) {
      issues.push({
        table,
        column,
        inventory_item_id: row.inventory_item_id
      });
    }
  }

  return issues;
}

async function assignMissingPropertyTags(connection) {
  const [rows] = await connection.query(
    `SELECT id
     FROM inventory_items
     WHERE is_archived = 0
       AND migration_review_required = 0
       AND asset_classification IN (?, ?)
       AND (property_tag IS NULL OR TRIM(property_tag) = '')
     ORDER BY id ASC`,
    FIXED_ASSET_CLASSIFICATIONS
  );

  if (!rows.length) {
    return { assigned: 0, flagged: 0 };
  }

  const tags = await generateAutoPropertyTags(rows.length, connection);
  let assigned = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const [result] = await connection.query(
      'UPDATE inventory_items SET property_tag = ? WHERE id = ? AND (property_tag IS NULL OR TRIM(property_tag) = \'\')',
      [tags[i], rows[i].id]
    );
    assigned += result.affectedRows || 0;
  }

  const [stillMissing] = await connection.query(
    `SELECT id FROM inventory_items
     WHERE is_archived = 0
       AND migration_review_required = 0
       AND asset_classification IN (?, ?)
       AND (property_tag IS NULL OR TRIM(property_tag) = '')`,
    FIXED_ASSET_CLASSIFICATIONS
  );

  let flagged = 0;
  for (const row of stillMissing) {
    await connection.query(
      `UPDATE inventory_items
       SET migration_review_required = 1,
           migration_review_notes = COALESCE(NULLIF(migration_review_notes, ''), 'Unable to assign property tag during legacy data migration')
       WHERE id = ?`,
      [row.id]
    );
    flagged += 1;
  }

  return { assigned, flagged };
}

async function assignMissingBatchIds(connection) {
  const [groups] = await connection.query(
    `SELECT item_code,
            DATE(created_at) AS created_day,
            department_id,
            GROUP_CONCAT(id ORDER BY id) AS ids,
            COUNT(*) AS asset_count
     FROM inventory_items
     WHERE is_archived = 0
       AND migration_review_required = 0
       AND (batch_id IS NULL OR TRIM(batch_id) = '')
     GROUP BY item_code, DATE(created_at), department_id
     ORDER BY MIN(id) ASC`
  );

  let groupsUpdated = 0;
  let assetsUpdated = 0;

  for (const group of groups) {
    const batchId = await generateNextBatchId(connection);
    const ids = String(group.ids).split(',').map((id) => parseInt(id, 10)).filter(Boolean);
    if (!ids.length) continue;

    const placeholders = ids.map(() => '?').join(', ');
    const [result] = await connection.query(
      `UPDATE inventory_items
       SET batch_id = ?
       WHERE id IN (${placeholders})
         AND (batch_id IS NULL OR TRIM(batch_id) = '')`,
      [batchId, ...ids]
    );

    if ((result.affectedRows || 0) > 0) {
      groupsUpdated += 1;
      assetsUpdated += result.affectedRows || 0;
    }
  }

  return { groupsUpdated, assetsUpdated };
}

async function runLegacyDataMigration() {
  const connection = await pool.getConnection();
  let propertyTags = { assigned: 0, flagged: 0 };
  let batchIds = { groupsUpdated: 0, assetsUpdated: 0 };
  let integrityIssues = [];

  try {
    await connection.beginTransaction();
    propertyTags = await assignMissingPropertyTags(connection);
    batchIds = await assignMissingBatchIds(connection);
    integrityIssues = await verifyInventoryTransactionIntegrity(connection);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  if (propertyTags.assigned || propertyTags.flagged || batchIds.assetsUpdated) {
    console.log(
      `Legacy data migration: property tags assigned=${propertyTags.assigned}, flagged=${propertyTags.flagged}, ` +
      `batch groups=${batchIds.groupsUpdated}, batch assets=${batchIds.assetsUpdated}.`
    );
  }

  if (integrityIssues.length) {
    console.warn(
      `Legacy data migration integrity check found ${integrityIssues.length} orphaned transaction reference(s).`
    );
  }

  return {
    applied: true,
    propertyTags,
    batchIds,
    integrityIssues
  };
}

module.exports = {
  runLegacyDataMigration,
  verifyInventoryTransactionIntegrity
};
