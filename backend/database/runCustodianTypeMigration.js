const pool = require('../config/database');

async function columnUsesLegacyCustodianEnum(tableName) {
  const [rows] = await pool.query(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'custodian_type'`,
    [tableName]
  );
  const columnType = rows[0]?.COLUMN_TYPE || '';
  return columnType.includes('Department Custodian') || columnType.includes('Laboratory Custodian');
}

async function migrateCustodianTypeColumn(tableName) {
  if (!(await columnUsesLegacyCustodianEnum(tableName))) {
    return;
  }

  await pool.query(
    `UPDATE ${tableName} SET custodian_type = 'Department' WHERE custodian_type = 'Department Custodian'`
  );
  await pool.query(
    `UPDATE ${tableName} SET custodian_type = 'Laboratory' WHERE custodian_type = 'Laboratory Custodian'`
  );
  await pool.query(
    `ALTER TABLE ${tableName}
     MODIFY custodian_type ENUM('Property Custodian', 'Department', 'Laboratory') NULL`
  );
}

async function runCustodianTypeMigration() {
  console.log('Running custodian type label migration...');
  await migrateCustodianTypeColumn('departments');
  await migrateCustodianTypeColumn('inventory_items');
  console.log('Custodian type label migration completed.');
}

if (require.main === module) {
  runCustodianTypeMigration().then(() => process.exit(0)).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { runCustodianTypeMigration };
