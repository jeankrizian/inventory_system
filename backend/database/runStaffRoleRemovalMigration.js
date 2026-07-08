const pool = require('../config/database');

const OBSOLETE_ROLE_NAMES = ['staff', 'Staff', 'employee', 'Employee'];

async function runStaffRoleRemovalMigration() {
  console.log('Running staff role removal migration...');

  for (const roleName of OBSOLETE_ROLE_NAMES) {
    const [roles] = await pool.query('SELECT id FROM roles WHERE name = ?', [roleName]);
    if (!roles.length) continue;

    const roleId = roles[0].id;
    const [users] = await pool.query(
      'SELECT id, username FROM users WHERE role_id = ? AND (is_archived = 0 OR is_archived IS NULL)',
      [roleId]
    );

    for (const user of users) {
      await pool.query(
        'UPDATE users SET is_active = 0, is_archived = 1 WHERE id = ?',
        [user.id]
      );
      console.log(`Archived obsolete user: ${user.username} (${roleName})`);
    }

    const [remaining] = await pool.query('SELECT COUNT(*) AS count FROM users WHERE role_id = ?', [roleId]);
    if (Number(remaining[0]?.count ?? 0) === 0) {
      await pool.query('DELETE FROM roles WHERE id = ?', [roleId]);
      console.log(`Removed obsolete role: ${roleName}`);
    }
  }

  console.log('Staff role removal migration completed.');
}

if (require.main === module) {
  runStaffRoleRemovalMigration().then(() => process.exit(0)).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { runStaffRoleRemovalMigration };
