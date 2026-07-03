const pool = require('../config/database');

const tables = ['inventory_items', 'departments', 'locations', 'suppliers'];

const migrations = tables.flatMap(table => [
  `ALTER TABLE ${table} ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0`,
  `ALTER TABLE ${table} ADD COLUMN archived_at TIMESTAMP NULL`,
  `ALTER TABLE ${table} ADD COLUMN archived_by INT NULL`
]);

function isIgnorable(err) {
  return ['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME', 'ER_CANT_CREATE_TABLE', 'ER_FK_DUP_NAME'].includes(err.code)
    || err.message.includes('Duplicate');
}

async function runArchiveMigration() {
  console.log('Running archive migration...');
  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch (err) {
      if (!isIgnorable(err)) {
        console.error('Archive migration error:', err.message);
        throw err;
      }
    }
  }
  for (const table of tables) {
    try {
      await pool.query(`CREATE INDEX idx_${table}_archived ON ${table}(is_archived, archived_at)`);
    } catch (err) {
      if (!isIgnorable(err)) throw err;
    }
  }
  console.log('Archive migration completed.');
}

if (require.main === module) {
  runArchiveMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { runArchiveMigration };
