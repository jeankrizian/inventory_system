/**
 * Seed demo/test accounts for QA and defense presentations.
 * Idempotent — creates or updates the 4 demo accounts and required departments.
 * Preserves the Administrator account and system roles.
 *
 * Run: npm run seed:test-accounts
 * Verify: npm run verify:demo-accounts
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

const ROLES = [
  ['admin', 'Full system access'],
  ['Property Manager', 'Property management office access'],
  ['Custodian', 'Asset custodian access scoped by department assignment']
];

const REQUIRED_DEPARTMENTS = [
  { name: 'Information Technology', code: 'ICT' },
  { name: 'Engineering', code: 'ENG' },
  { name: 'Senior High School', code: 'SHS' }
];

const DEMO_ACCOUNTS = [
  {
    username: 'pm_test',
    password: 'pm123456',
    email: 'pm_test@caviteinstitute.edu.ph',
    full_name: 'Test Property Manager',
    roleName: 'Property Manager',
    departmentCode: null
  },
  {
    username: 'ict_custodian',
    password: 'cust123456',
    email: 'ict_custodian@caviteinstitute.edu.ph',
    full_name: 'ICT Custodian',
    roleName: 'Custodian',
    departmentCode: 'ICT'
  },
  {
    username: 'eng_custodian',
    password: 'cust123456',
    email: 'eng_custodian@caviteinstitute.edu.ph',
    full_name: 'Engineering Custodian',
    roleName: 'Custodian',
    departmentCode: 'ENG'
  },
  {
    username: 'shs_custodian',
    password: 'cust123456',
    email: 'shs_custodian@caviteinstitute.edu.ph',
    full_name: 'Senior High School Custodian',
    roleName: 'Custodian',
    departmentCode: 'SHS'
  }
];

const DEMO_USERNAMES = DEMO_ACCOUNTS.map((account) => account.username);

async function ensureRoles(connection) {
  for (const [name, description] of ROLES) {
    await connection.query(
      'INSERT IGNORE INTO roles (name, description) VALUES (?, ?)',
      [name, description]
    );
  }
}

async function getRoleId(connection, roleName) {
  const [rows] = await connection.query('SELECT id FROM roles WHERE name = ?', [roleName]);
  if (!rows.length) {
    throw new Error(`Role not found: ${roleName}`);
  }
  return rows[0].id;
}

async function findDepartment(connection, { name, code }) {
  const [byCode] = await connection.query(
    `SELECT id, name, code FROM departments
     WHERE code = ? AND (is_archived = 0 OR is_archived IS NULL)
     LIMIT 1`,
    [code]
  );
  if (byCode.length) return byCode[0];

  const [byName] = await connection.query(
    `SELECT id, name, code FROM departments
     WHERE name = ? AND (is_archived = 0 OR is_archived IS NULL)
     LIMIT 1`,
    [name]
  );
  return byName[0] || null;
}

async function ensureDepartments(connection) {
  const departmentIds = {};

  for (const dept of REQUIRED_DEPARTMENTS) {
    const existing = await findDepartment(connection, dept);
    if (existing) {
      departmentIds[dept.code] = existing.id;
      console.log(`  Department reused: ${existing.name} (${existing.code})`);
      continue;
    }

    const [result] = await connection.query(
      `INSERT INTO departments (name, code, description, status)
       VALUES (?, ?, ?, 'Active')`,
      [dept.name, dept.code, `${dept.name} department`]
    );
    departmentIds[dept.code] = result.insertId;
    console.log(`  Department created: ${dept.name} (${dept.code})`);
  }

  return departmentIds;
}

async function findUserByUsername(connection, username) {
  const [rows] = await connection.query(
    'SELECT id, username, email FROM users WHERE username = ? LIMIT 1',
    [username]
  );
  return rows[0] || null;
}

async function emailUsedByOtherUser(connection, email, excludeUserId = null) {
  const [rows] = await connection.query(
    excludeUserId
      ? 'SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id <> ? LIMIT 1'
      : 'SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
    excludeUserId ? [email, excludeUserId] : [email]
  );
  return rows.length > 0;
}

async function upsertDemoAccount(connection, account, departmentIds) {
  const roleId = await getRoleId(connection, account.roleName);
  const assignedDepartmentId = account.departmentCode
    ? departmentIds[account.departmentCode]
    : null;

  if (account.departmentCode && !assignedDepartmentId) {
    throw new Error(`Department not found for code: ${account.departmentCode}`);
  }

  const passwordHash = await bcrypt.hash(account.password, 10);
  const existing = await findUserByUsername(connection, account.username);

  if (existing) {
    if (await emailUsedByOtherUser(connection, account.email, existing.id)) {
      throw new Error(`Email ${account.email} is already used by another account`);
    }

    await connection.query(
      `UPDATE users
       SET role_id = ?,
           email = ?,
           password_hash = ?,
           full_name = ?,
           assigned_department_id = ?,
           assigned_location_id = NULL,
           is_active = 1,
           is_archived = 0,
           archived_at = NULL,
           archived_by = NULL
       WHERE id = ?`,
      [
        roleId,
        account.email,
        passwordHash,
        account.full_name,
        assignedDepartmentId,
        existing.id
      ]
    );
    console.log(`  Updated: ${account.username}`);
    return 'updated';
  }

  if (await emailUsedByOtherUser(connection, account.email)) {
    throw new Error(`Email ${account.email} is already used by another account`);
  }

  await connection.query(
    `INSERT INTO users
      (role_id, assigned_department_id, assigned_location_id, username, email, password_hash, full_name, is_active)
     VALUES (?, ?, NULL, ?, ?, ?, ?, 1)`,
    [
      roleId,
      assignedDepartmentId,
      account.username,
      account.email,
      passwordHash,
      account.full_name
    ]
  );
  console.log(`  Created: ${account.username}`);
  return 'created';
}

function printCredentialsSummary(departmentIds) {
  console.log('\n--- Demo test account credentials ---\n');
  for (const account of DEMO_ACCOUNTS) {
    const deptLabel = account.departmentCode
      ? `${REQUIRED_DEPARTMENTS.find((d) => d.code === account.departmentCode)?.name} (${account.departmentCode})`
      : '— (no department assignment)';
    console.log(`Role: ${account.roleName}`);
    console.log(`Username: ${account.username}`);
    console.log(`Password: ${account.password}`);
    console.log(`Email: ${account.email}`);
    console.log(`Assigned Department: ${deptLabel}`);
    console.log('');
  }
  console.log('Departments:', Object.entries(departmentIds).map(([code, id]) => `${code}=#${id}`).join(', '));
  console.log('\nAdministrator account is preserved separately (admin / admin123).');
  console.log('Verify with: npm run verify:demo-accounts');
}

async function seedTestAccounts() {
  const connection = await pool.getConnection();
  try {
    console.log('Seeding demo test accounts...\n');
    await connection.beginTransaction();

    await ensureRoles(connection);

    console.log('Departments:');
    const departmentIds = await ensureDepartments(connection);

    console.log('\nAccounts:');
    let created = 0;
    let updated = 0;

    for (const account of DEMO_ACCOUNTS) {
      const result = await upsertDemoAccount(connection, account, departmentIds);
      if (result === 'created') created += 1;
      else updated += 1;
    }

    await connection.commit();
    console.log(`\nDone. Created ${created}, updated ${updated}.`);
    printCredentialsSummary(departmentIds);
  } catch (error) {
    await connection.rollback();
    console.error('Seed test accounts failed:', error.message);
    process.exit(1);
  } finally {
    connection.release();
    process.exit(0);
  }
}

if (require.main === module) {
  seedTestAccounts();
}

module.exports = {
  DEMO_ACCOUNTS,
  DEMO_USERNAMES,
  REQUIRED_DEPARTMENTS,
  seedTestAccounts
};
