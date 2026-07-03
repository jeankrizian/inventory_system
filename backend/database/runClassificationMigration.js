const pool = require('../config/database');

async function runClassificationMigration() {
  console.log('Running asset classification migration...');

  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'asset_classification'`
    );
    const columnType = cols[0]?.COLUMN_TYPE || '';
    if (columnType.includes('Non-Consumable (Fixed Asset)')) {
      console.log('Asset classification migration already applied.');
      return;
    }
  } catch (_) { /* continue */ }

  await pool.query(
    `ALTER TABLE inventory_items MODIFY COLUMN asset_classification VARCHAR(80) DEFAULT 'Consumable'`
  );

  await pool.query(
    `UPDATE inventory_items SET asset_classification = 'Non-Consumable (Fixed Asset)'
     WHERE asset_classification IN ('Fixed Asset', 'Non-Consumable')`
  );

  await pool.query(
    `UPDATE inventory_items SET asset_classification = 'Non-Consumable (Fixed Asset)'
     WHERE asset_classification = 'Consumable'
       AND (
         item_code LIKE 'ICT-%' OR item_code LIKE 'FUR-%' OR item_code LIKE 'LAB-00%'
         OR LOWER(item_name) LIKE '%computer%' OR LOWER(item_name) LIKE '%laptop%'
         OR LOWER(item_name) LIKE '%projector%' OR LOWER(item_name) LIKE '%microscope%'
         OR LOWER(item_name) LIKE '%printer%' OR LOWER(item_name) LIKE '%cabinet%'
         OR LOWER(item_name) LIKE '%desk%' OR LOWER(item_name) LIKE '%chair%'
         OR property_tag IS NOT NULL AND property_tag != ''
       )`
  );

  await pool.query(
    `UPDATE inventory_items SET asset_classification = 'Semi-Durable'
     WHERE asset_classification = 'Consumable'
       AND (
         LOWER(item_name) LIKE '%cable%' OR LOWER(item_name) LIKE '%mouse%'
         OR LOWER(item_name) LIKE '%keyboard%' OR LOWER(item_name) LIKE '%adapter%'
         OR LOWER(item_name) LIKE '%flash drive%' OR LOWER(item_name) LIKE '%mouse pad%'
         OR LOWER(item_name) LIKE '%extension cord%'
       )`
  );

  await pool.query(
    `UPDATE inventory_items SET asset_classification = 'Consumable'
     WHERE asset_classification IS NULL OR asset_classification = ''`
  );

  await pool.query(
    `ALTER TABLE inventory_items MODIFY COLUMN asset_classification
     ENUM('Consumable', 'Semi-Durable', 'Non-Consumable (Fixed Asset)') DEFAULT 'Consumable'`
  );

  console.log('Asset classification migration completed.');
}

if (require.main === module) {
  runClassificationMigration().then(() => process.exit(0)).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { runClassificationMigration };
