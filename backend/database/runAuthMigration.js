const pool = require('../config/database');

const registrationRoles = [
  ['Property Manager', 'Property management office access'],
  ['Custodian', 'Asset custodian access scoped by department assignment']
];

async function runAuthMigration() {
  console.log('Running auth migration...');
  for (const [name, description] of registrationRoles) {
    await pool.query(
      'INSERT IGNORE INTO roles (name, description) VALUES (?, ?)',
      [name, description]
    );
  }
  console.log('Auth migration completed.');
}

if (require.main === module) {
  runAuthMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { runAuthMigration };
