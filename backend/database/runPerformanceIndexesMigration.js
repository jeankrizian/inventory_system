const pool = require('../config/database');

async function indexExists(table, indexName) {
  const [rows] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  return rows.length > 0;
}

async function columnHasIndex(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function ensureIndex(table, indexName, ddl, options = {}) {
  const { column = null } = options;
  if (await indexExists(table, indexName)) {
    return false;
  }
  if (column && await columnHasIndex(table, column)) {
    console.log(`Skipped ${indexName}; ${table}.${column} already indexed.`);
    return false;
  }
  await pool.query(ddl);
  console.log(`Added ${indexName} on ${table}.`);
  return true;
}

const INVENTORY_INDEXES = [
  {
    name: 'idx_inventory_borrow_lookup',
    ddl: `ALTER TABLE inventory_items
          ADD INDEX idx_inventory_borrow_lookup (is_archived, item_code, status)`
  },
  {
    name: 'idx_inventory_scope_list',
    ddl: `ALTER TABLE inventory_items
          ADD INDEX idx_inventory_scope_list (is_archived, department_id, status)`
  },
  {
    name: 'idx_inventory_updated_at',
    ddl: 'ALTER TABLE inventory_items ADD INDEX idx_inventory_updated_at (updated_at)'
  },
  {
    name: 'idx_inventory_material',
    ddl: 'ALTER TABLE inventory_items ADD INDEX idx_inventory_material (material)'
  },
  {
    name: 'idx_inventory_fifo_order',
    ddl: `ALTER TABLE inventory_items
          ADD INDEX idx_inventory_fifo_order (acquisition_date, created_at, property_tag)`
  }
];

const BORROW_INDEXES = [
  {
    name: 'idx_borrow_tx_borrower_status',
    ddl: 'ALTER TABLE borrow_transactions ADD INDEX idx_borrow_tx_borrower_status (borrower_id, status)'
  },
  {
    name: 'idx_borrow_items_asset_tx',
    ddl: 'ALTER TABLE borrow_items ADD INDEX idx_borrow_items_asset_tx (inventory_item_id, borrow_transaction_id)'
  }
];

const TRANSACTION_INDEXES = [
  {
    name: 'idx_disposal_inventory_item',
    column: 'inventory_item_id',
    ddl: 'ALTER TABLE disposal_requests ADD INDEX idx_disposal_inventory_item (inventory_item_id)'
  },
  {
    name: 'idx_transfer_inventory_item',
    column: 'inventory_item_id',
    ddl: 'ALTER TABLE transfer_requests ADD INDEX idx_transfer_inventory_item (inventory_item_id)'
  },
  {
    name: 'idx_maintenance_inventory_item',
    column: 'inventory_item_id',
    ddl: 'ALTER TABLE maintenance_records ADD INDEX idx_maintenance_inventory_item (inventory_item_id)'
  }
];

async function runPerformanceIndexesMigration() {
  const added = [];

  for (const spec of INVENTORY_INDEXES) {
    const table = spec.ddl.match(/ALTER TABLE (\w+)/)[1];
    if (await ensureIndex(table, spec.name, spec.ddl)) {
      added.push(spec.name);
    }
  }

  for (const spec of BORROW_INDEXES) {
    const table = spec.ddl.match(/ALTER TABLE (\w+)/)[1];
    if (await ensureIndex(table, spec.name, spec.ddl)) {
      added.push(spec.name);
    }
  }

  for (const spec of TRANSACTION_INDEXES) {
    const table = spec.ddl.match(/ALTER TABLE (\w+)/)[1];
    if (await ensureIndex(table, spec.name, spec.ddl, { column: spec.column })) {
      added.push(spec.name);
    }
  }

  return { applied: true, added };
}

module.exports = { runPerformanceIndexesMigration };
