const pool = require('../config/database');

async function tableHasColumn(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.columns
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return rows[0].c > 0;
}

async function runCustodianTypeMigration() {
  console.log('Running custodian type removal migration...');
  for (const tableName of ['departments', 'inventory_items']) {
    if (await tableHasColumn(tableName, 'custodian_type')) {
      await pool.query(`ALTER TABLE \`${tableName}\` DROP COLUMN custodian_type`);
      console.log(`Dropped custodian_type from ${tableName}`);
    }
  }
  console.log('Custodian type removal migration completed.');
}

if (require.main === module) {
  runCustodianTypeMigration().then(() => process.exit(0)).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { runCustodianTypeMigration };
