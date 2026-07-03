const pool = require('../config/database');

const registrationRoles = [
  ['Property Manager', 'Property management office access'],
  ['Department Custodian', 'Department asset custodian access'],
  ['Laboratory Custodian', 'Laboratory asset custodian access']
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
