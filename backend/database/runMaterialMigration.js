const pool = require('../config/database');

const migrations = [
  `ALTER TABLE inventory_items ADD COLUMN material VARCHAR(50) NULL AFTER asset_classification`
];

function isIgnorable(err) {
  return ['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME'].includes(err.code)
    || err.message.includes('Duplicate column');
}

async function runMaterialMigration() {
  console.log('Running material migration...');
  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch (err) {
      if (!isIgnorable(err)) {
        console.error('Material migration error:', err.message);
        throw err;
      }
    }
  }
  console.log('Material migration completed.');
}

if (require.main === module) {
  runMaterialMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { runMaterialMigration };
