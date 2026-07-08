const pool = require('../config/database');

const migrations = [
  `ALTER TABLE inventory_items ADD COLUMN description TEXT NULL AFTER item_name`
];

function isIgnorable(err) {
  return ['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME'].includes(err.code)
    || err.message.includes('Duplicate column');
}

async function runItemDescriptionMigration() {
  console.log('Running item description migration...');
  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch (err) {
      if (!isIgnorable(err)) {
        console.error('Item description migration error:', err.message);
        throw err;
      }
    }
  }
  console.log('Item description migration completed.');
}

if (require.main === module) {
  runItemDescriptionMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { runItemDescriptionMigration };
