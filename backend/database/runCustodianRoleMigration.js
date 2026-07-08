const pool = require('../config/database');

async function runCustodianRoleMigration() {
  console.log('Running custodian role migration...');

  await pool.query(
    `INSERT IGNORE INTO roles (name, description) VALUES (?, ?)`,
    ['Custodian', 'Asset custodian access scoped by department assignment']
  );

  const [custodianRoleRows] = await pool.query(
    `SELECT id FROM roles WHERE name = 'Custodian' LIMIT 1`
  );
  const custodianRoleId = custodianRoleRows[0]?.id;
  if (!custodianRoleId) {
    throw new Error('Custodian role could not be created');
  }

  const [legacyRoles] = await pool.query(
    `SELECT id, name FROM roles WHERE name IN ('Department Custodian', 'Laboratory Custodian')`
  );

  for (const legacyRole of legacyRoles) {
    const [result] = await pool.query(
      `UPDATE users SET role_id = ? WHERE role_id = ?`,
      [custodianRoleId, legacyRole.id]
    );
    if (result.affectedRows) {
      console.log(`Migrated ${result.affectedRows} user(s) from ${legacyRole.name} to Custodian`);
    }

    const [remaining] = await pool.query(
      `SELECT COUNT(*) AS count FROM users WHERE role_id = ?`,
      [legacyRole.id]
    );
    if (Number(remaining[0]?.count ?? 0) === 0) {
      await pool.query(`DELETE FROM roles WHERE id = ?`, [legacyRole.id]);
      console.log(`Removed legacy role: ${legacyRole.name}`);
    }
  }

  console.log('Custodian role migration completed.');
}

if (require.main === module) {
  runCustodianRoleMigration().then(() => process.exit(0)).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { runCustodianRoleMigration };
