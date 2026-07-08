/**
 * RBAC assignment migration — adds user department/location assignments.
 * Safe to run multiple times.
 */
const pool = require('../config/database');

const migrations = [
  `ALTER TABLE users ADD COLUMN assigned_department_id INT NULL AFTER role_id`,
  `ALTER TABLE users ADD COLUMN assigned_location_id INT NULL AFTER assigned_department_id`,
  `ALTER TABLE users ADD CONSTRAINT fk_users_assigned_department
     FOREIGN KEY (assigned_department_id) REFERENCES departments(id) ON DELETE SET NULL`,
  `ALTER TABLE users ADD CONSTRAINT fk_users_assigned_location
     FOREIGN KEY (assigned_location_id) REFERENCES locations(id) ON DELETE SET NULL`
];

function isIgnorable(err) {
  return ['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME', 'ER_CANT_CREATE_TABLE', 'ER_FK_DUP_NAME'].includes(err.code)
    || err.message.includes('Duplicate');
}

async function assignSampleCustodians() {
  const [deptCustodians] = await pool.query(
    `SELECT u.id FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE r.name = 'Custodian'
       AND u.assigned_department_id IS NULL
       AND u.assigned_location_id IS NULL
     LIMIT 1`
  );
  if (deptCustodians.length) {
    await pool.query(
      'UPDATE users SET assigned_department_id = 1 WHERE id = ?',
      [deptCustodians[0].id]
    );
  }

  const [labCustodians] = await pool.query(
    `SELECT u.id FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE r.name = 'Custodian'
       AND u.assigned_location_id IS NULL
       AND u.assigned_department_id IS NULL
     LIMIT 1`
  );
  if (labCustodians.length) {
    await pool.query(
      'UPDATE users SET assigned_location_id = 3 WHERE id = ?',
      [labCustodians[0].id]
    );
  }
}

async function runRbacAssignmentMigration() {
  console.log('Running RBAC assignment migration...');
  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch (err) {
      if (!isIgnorable(err)) {
        console.error('RBAC assignment migration error:', err.message);
        throw err;
      }
    }
  }
  await assignSampleCustodians();
  console.log('RBAC assignment migration completed.');
}

if (require.main === module) {
  runRbacAssignmentMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { runRbacAssignmentMigration };
