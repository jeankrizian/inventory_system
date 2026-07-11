/**
 * Phase 3: workflow-only inventory status (no manual / quantity-derived statuses).
 */
const pool = require('../config/database');
const { LEGACY_QUANTITY_STATUSES } = require('../utils/inventoryStatusService');

const WORKFLOW_STATUSES = ['Available', 'Borrowed', 'Under Maintenance', 'Disposed'];

async function columnTypeIncludesStatus(table) {
  const [rows] = await pool.query(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'status'`,
    [table]
  );
  return rows[0]?.COLUMN_TYPE || '';
}

async function runStatusAutomationMigration() {
  const legacy = Array.from(LEGACY_QUANTITY_STATUSES);
  let normalizedStatus = 0;

  const workflowList = WORKFLOW_STATUSES.map(() => '?').join(', ');
  const [nonWorkflow] = await pool.query(
    `UPDATE inventory_items
     SET status = 'Available'
     WHERE status NOT IN (${workflowList})`,
    WORKFLOW_STATUSES
  );
  normalizedStatus += nonWorkflow.affectedRows || 0;

  const columnType = await columnTypeIncludesStatus('inventory_items');
  const enumValues = WORKFLOW_STATUSES.map((s) => `'${s}'`).join(', ');
  const targetEnum = `enum(${enumValues.toLowerCase()})`;

  if (!columnType.toLowerCase().includes('low stock')) {
    console.log(
      `Status automation migration completed. Status normalized: ${normalizedStatus} (ENUM already workflow-only).`
    );
    return { normalizedStatus, enumUpdated: false };
  }

  await pool.query(
    `ALTER TABLE inventory_items
     MODIFY COLUMN status ENUM(${enumValues}) DEFAULT 'Available'`
  );

  console.log(
    `Status automation migration completed. Status normalized: ${normalizedStatus}, ENUM restricted to workflow statuses.`
  );
  return { normalizedStatus, enumUpdated: true };
}

module.exports = { runStatusAutomationMigration };
