const pool = require('../config/database');

function isIgnorable(err) {
  return ['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME', 'ER_TABLE_EXISTS_ERROR'].includes(err.code)
    || err.message.includes('Duplicate')
    || err.message.includes('already exists');
}

async function runPasswordResetMigration() {
  console.log('Running password reset OTP migration...');
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_otps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        used_at TIMESTAMP NULL,
        password_reset_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  } catch (err) {
    if (!isIgnorable(err)) throw err;
  }
  try {
    await pool.query(
      'CREATE INDEX idx_reset_otp_user_active ON password_reset_otps(user_id, expires_at, used_at)'
    );
  } catch (err) {
    if (!isIgnorable(err)) throw err;
  }
  console.log('Password reset OTP migration completed.');
}

if (require.main === module) {
  runPasswordResetMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { runPasswordResetMigration };
