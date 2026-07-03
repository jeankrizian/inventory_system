const pool = require('../config/database');

const columns = [
  'ALTER TABLE users ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0',
  'ALTER TABLE users ADD COLUMN archived_at TIMESTAMP NULL',
  'ALTER TABLE users ADD COLUMN archived_by INT NULL'
];

function isIgnorable(err) {
  return ['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME'].includes(err.code)
    || err.message.includes('Duplicate');
}

async function runUserArchiveMigration() {
  console.log('Running user archive migration...');
  for (const sql of columns) {
    try {
      await pool.query(sql);
    } catch (err) {
      if (!isIgnorable(err)) throw err;
    }
  }
  try {
    await pool.query('CREATE INDEX idx_users_archived ON users(is_archived, archived_at)');
  } catch (err) {
    if (!isIgnorable(err)) throw err;
  }
  console.log('User archive migration completed.');
}

if (require.main === module) {
  runUserArchiveMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { runUserArchiveMigration };
