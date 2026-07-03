const pool = require('../config/database');

const migrations = [
  `ALTER TABLE inventory_items ADD COLUMN purchase_request_number VARCHAR(50) NULL AFTER acquisition_date`,
  `ALTER TABLE inventory_items ADD COLUMN purchase_order_number VARCHAR(50) NULL AFTER purchase_request_number`,
  `ALTER TABLE inventory_items ADD COLUMN invoice_number VARCHAR(50) NULL AFTER purchase_order_number`,
  `ALTER TABLE inventory_items ADD COLUMN unit_cost DECIMAL(12,2) NULL AFTER invoice_number`,
  `ALTER TABLE inventory_items ADD COLUMN acquisition_cost DECIMAL(12,2) NULL AFTER unit_cost`
];

function isIgnorable(err) {
  return ['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME'].includes(err.code)
    || err.message.includes('Duplicate column');
}

async function runPurchaseMigration() {
  console.log('Running purchase/receiving migration...');
  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch (err) {
      if (!isIgnorable(err)) {
        console.error('Purchase migration error:', err.message);
        throw err;
      }
    }
  }
  console.log('Purchase/receiving migration completed.');
}

if (require.main === module) {
  runPurchaseMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { runPurchaseMigration };
