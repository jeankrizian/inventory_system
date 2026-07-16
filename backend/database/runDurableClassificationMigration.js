const pool = require('../config/database');

/**
 * Standardize classification: Non-Consumable (Fixed Asset) → Durable.
 * Also adds optional inventory_item_id on asset_components for parent–child inventory links.
 */
async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function tableExists(table) {
  const [rows] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return rows.length > 0;
}

async function runDurableClassificationMigration() {
  const [cols] = await pool.query(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'asset_classification'`
  );
  const columnType = cols[0]?.COLUMN_TYPE || '';

  const alreadyDurableOnly = columnType.includes("'Durable'")
    && !columnType.includes('Non-Consumable')
    && !columnType.includes('Fixed Asset');

  if (!alreadyDurableOnly) {
    // Widen to VARCHAR so legacy → Durable updates always succeed
    await pool.query(
      `ALTER TABLE inventory_items MODIFY COLUMN asset_classification VARCHAR(80) DEFAULT 'Consumable'`
    );

    await pool.query(
      `UPDATE inventory_items
       SET asset_classification = 'Durable'
       WHERE asset_classification IN (
         'Non-Consumable (Fixed Asset)',
         'Non-Consumable',
         'Fixed Asset',
         'Durable (Fixed Asset)'
       )`
    );

    await pool.query(
      `ALTER TABLE inventory_items MODIFY COLUMN asset_classification
       ENUM('Consumable', 'Semi-Durable', 'Durable') DEFAULT 'Consumable'`
    );
    console.log('Durable classification migration applied.');
  }

  // Refresh PAR payload classification labels when stored as Non-Consumable
  if (await tableExists('documents')) {
    try {
      const [docs] = await pool.query(
        `SELECT id, payload_json FROM documents
         WHERE document_type = 'PAR' AND payload_json IS NOT NULL`
      );
      for (const doc of docs || []) {
        let payload = doc.payload_json;
        if (typeof payload === 'string') {
          try {
            payload = JSON.parse(payload);
          } catch (_) {
            continue;
          }
        }
        if (!payload || typeof payload !== 'object') continue;
        const cls = String(payload.classification || '');
        if (
          cls === 'Non-Consumable'
          || cls === 'Non-Consumable (Fixed Asset)'
          || cls === 'Fixed Asset'
        ) {
          payload.classification = 'Durable';
          await pool.query(
            'UPDATE documents SET payload_json = ? WHERE id = ?',
            [JSON.stringify(payload), doc.id]
          );
        }
      }
    } catch (err) {
      console.warn('PAR classification label refresh skipped:', err.message);
    }
  }

  if (await tableExists('asset_components')) {
    if (!(await columnExists('asset_components', 'inventory_item_id'))) {
      await pool.query(`
        ALTER TABLE asset_components
        ADD COLUMN inventory_item_id INT NULL AFTER parent_asset_id,
        ADD INDEX idx_asset_components_inventory (inventory_item_id),
        ADD CONSTRAINT fk_asset_components_inventory
          FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE SET NULL
      `);
      console.log('Added inventory_item_id to asset_components.');
    }
  }

  return { applied: true };
}

if (require.main === module) {
  runDurableClassificationMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = { runDurableClassificationMigration };
