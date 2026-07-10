const pool = require('../config/database');

const migrations = [
  `CREATE TABLE IF NOT EXISTS database_backups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL UNIQUE,
    file_size BIGINT NOT NULL DEFAULT 0,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_backups_created (created_at DESC),
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`
];

function isIgnorable(err) {
  return ['ER_TABLE_EXISTS_ERROR', 'ER_DUP_KEYNAME'].includes(err.code)
    || err.message.includes('already exists');
}

async function runBackupMigration() {
  console.log('Running backup migration...');
  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch (err) {
      if (!isIgnorable(err)) {
        console.error('Backup migration error:', err.message);
        throw err;
      }
    }
  }
  console.log('Backup migration completed.');
}

if (require.main === module) {
  runBackupMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { runBackupMigration };
