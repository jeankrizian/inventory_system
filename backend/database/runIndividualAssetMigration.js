const pool = require('../config/database');
const {
  generatePropertyTagSequence,
  findConflictingPropertyTags,
  canAutoSequencePropertyTag
} = require('../utils/propertyTagGenerator');

const FIXED_ASSET = 'Durable';

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

async function runSchemaMigration() {
  if (!(await columnExists('inventory_items', 'migration_review_required'))) {
    await pool.query(
      `ALTER TABLE inventory_items
       ADD COLUMN migration_review_required TINYINT(1) NOT NULL DEFAULT 0,
       ADD COLUMN migration_review_notes VARCHAR(500) NULL`
    );
    console.log('Added migration_review columns.');
  }

  const [uniqueCols] = await pool.query(
    `SELECT INDEX_NAME, NON_UNIQUE FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'item_code'`
  );

  const uniqueIndex = uniqueCols.find((row) => Number(row.NON_UNIQUE) === 0);
  if (uniqueIndex) {
    await pool.query(`ALTER TABLE inventory_items DROP INDEX \`${uniqueIndex.INDEX_NAME}\``);
    console.log(`Dropped unique index on item_code (${uniqueIndex.INDEX_NAME}).`);
  }

  if (!(await indexExists('inventory_items', 'idx_item_code'))) {
    await pool.query('ALTER TABLE inventory_items ADD INDEX idx_item_code (item_code)');
    console.log('Added non-unique idx_item_code index.');
  }
}

function buildAssetStatuses(quantity, availableQuantity) {
  const borrowed = Math.max(0, Number(quantity) - Number(availableQuantity));
  const available = Math.max(0, Number(availableQuantity));
  const statuses = [];

  for (let i = 0; i < available; i += 1) statuses.push('Available');
  for (let i = 0; i < borrowed; i += 1) statuses.push('Borrowed');

  while (statuses.length < quantity) statuses.push('Available');
  return statuses.slice(0, quantity);
}

async function insertAssetClone(connection, source, propertyTag, status) {
  const availableQty = status === 'Available' ? 1 : 0;
  const [result] = await connection.query(
    `INSERT INTO inventory_items
     (item_code, item_name, description, department_id, asset_classification, material, property_tag, custodian_id,
      parent_asset_id, brand, model, quantity, available_quantity, unit,
      supplier_id, acquisition_date, purchase_request_number, purchase_order_number,
      invoice_number, unit_cost, acquisition_cost, \`condition\`, status, location_id, low_stock_threshold,
      maintenance_schedule, next_maintenance_date, maintenance_status, service_provider)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      source.item_code,
      source.item_name,
      source.description,
      source.department_id,
      source.asset_classification,
      source.material,
      propertyTag,
      source.custodian_id,
      source.parent_asset_id,
      source.brand,
      source.model,
      availableQty,
      source.unit,
      source.supplier_id,
      source.acquisition_date || source.purchase_date || null,
      source.purchase_request_number,
      source.purchase_order_number,
      source.invoice_number,
      source.unit_cost,
      source.acquisition_cost,
      source.condition,
      status,
      source.location_id,
      source.low_stock_threshold,
      source.maintenance_schedule,
      source.next_maintenance_date,
      source.maintenance_status,
      source.service_provider
    ]
  );
  return result.insertId;
}

async function markForReview(connection, id, notes) {
  await connection.query(
    `UPDATE inventory_items
     SET migration_review_required = 1, migration_review_notes = ?
     WHERE id = ?`,
    [notes, id]
  );
}

async function splitQuantityBasedRecords() {
  if (!(await columnExists('inventory_items', 'quantity'))) {
    console.log('Quantity column absent; skipping legacy quantity-based split.');
    return { split: 0, flagged: 0 };
  }

  const [rows] = await pool.query(
    `SELECT * FROM inventory_items
     WHERE is_archived = 0 AND quantity > 1 AND migration_review_required = 0`
  );

  if (!rows.length) {
    console.log('No quantity-based inventory rows to split.');
    return { split: 0, flagged: 0 };
  }

  let split = 0;
  let flagged = 0;

  for (const row of rows) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const qty = Number(row.quantity);
      const statuses = buildAssetStatuses(qty, row.available_quantity);
      const isFixedAsset = row.asset_classification === FIXED_ASSET;
      let tags = [];

      if (isFixedAsset) {
        if (!row.property_tag) {
          await markForReview(connection, row.id, 'Missing property tag; cannot split quantity-based fixed asset safely.');
          flagged += 1;
          await connection.commit();
          continue;
        }
        if (!canAutoSequencePropertyTag(row.property_tag)) {
          await markForReview(connection, row.id, 'Property tag cannot be auto-sequenced; admin review required.');
          flagged += 1;
          await connection.commit();
          continue;
        }
        tags = generatePropertyTagSequence(row.property_tag, qty);
        const conflicts = await findConflictingPropertyTags(tags, connection, [row.id]);
        if (conflicts.length) {
          await markForReview(
            connection,
            row.id,
            `Generated property tags conflict with existing tags: ${conflicts.join(', ')}`
          );
          flagged += 1;
          await connection.commit();
          continue;
        }
      } else if (row.property_tag && canAutoSequencePropertyTag(row.property_tag)) {
        tags = generatePropertyTagSequence(row.property_tag, qty);
        const conflicts = await findConflictingPropertyTags(tags, connection, [row.id]);
        if (conflicts.length) {
          tags = [row.property_tag, ...Array(qty - 1).fill(null)];
        }
      } else {
        tags = [row.property_tag || null, ...Array(qty - 1).fill(null)];
      }

      const firstStatus = statuses[0];
      const firstAvail = firstStatus === 'Available' ? 1 : 0;

      await connection.query(
        `UPDATE inventory_items
         SET quantity = 1, available_quantity = ?, property_tag = ?, status = ?
         WHERE id = ?`,
        [firstAvail, tags[0] || row.property_tag, firstStatus, row.id]
      );

      for (let i = 1; i < qty; i += 1) {
        await insertAssetClone(connection, row, tags[i] || null, statuses[i]);
      }

      await connection.commit();
      split += 1;
    } catch (err) {
      await connection.rollback();
      console.error(`Failed to split inventory item ${row.id}:`, err.message);
      flagged += 1;
    } finally {
      connection.release();
    }
  }

  return { split, flagged };
}

async function runIndividualAssetMigration() {
  console.log('Running individual asset migration...');
  await runSchemaMigration();
  const result = await splitQuantityBasedRecords();
  console.log(`Individual asset migration completed. Split: ${result.split}, flagged for review: ${result.flagged}.`);
  return result;
}

if (require.main === module) {
  runIndividualAssetMigration().then(() => process.exit(0)).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { runIndividualAssetMigration };
