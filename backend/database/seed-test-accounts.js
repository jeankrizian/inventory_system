/**
 * Seed QA/defense test accounts for all 5 RBAC roles.
 * Idempotent — skips users that already exist by username.
 * Run: npm run seed:test-accounts
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

const ROLES = [
  ['admin', 'Full system access'],
  ['staff', 'Limited access for inventory operations'],
  ['Property Manager', 'Property management office access'],
  ['Custodian', 'Asset custodian access scoped by department or laboratory assignment']
];

/** Department: Information Technology Department (IT) from main seed */
const DEPT_ASSIGNMENT = { id: 1, label: 'Information Technology Department (IT)' };

/** Location: ICT Laboratory from main seed */
const LOCATION_ASSIGNMENT = { id: 1, label: 'ICT Laboratory' };

const TEST_ACCOUNTS = [
  {
    username: 'admin',
    password: 'admin123',
    email: 'admin@caviteinstitute.edu',
    full_name: 'System Administrator',
    roleName: 'admin',
    assigned_department_id: null,
    assigned_location_id: null,
    assignedLabel: '— (full system access)'
  },
  {
    username: 'pm_test',
    password: 'pm123456',
    email: 'pm_test@caviteinstitute.edu',
    full_name: 'Test Property Manager',
    roleName: 'Property Manager',
    assigned_department_id: null,
    assigned_location_id: null,
    assignedLabel: '— (all departments & locations)'
  },
  {
    username: 'deptcust_test',
    password: 'dept123456',
    email: 'deptcust_test@caviteinstitute.edu',
    full_name: 'Test Custodian (Department)',
    roleName: 'Custodian',
    assigned_department_id: DEPT_ASSIGNMENT.id,
    assigned_location_id: null,
    assignedLabel: DEPT_ASSIGNMENT.label
  },
  {
    username: 'labcust_test',
    password: 'lab123456',
    email: 'labcust_test@caviteinstitute.edu',
    full_name: 'Test Custodian (Laboratory)',
    roleName: 'Custodian',
    assigned_department_id: null,
    assigned_location_id: LOCATION_ASSIGNMENT.id,
    assignedLabel: LOCATION_ASSIGNMENT.label
  },
  {
    username: 'staff',
    password: 'staff123',
    email: 'staff@caviteinstitute.edu',
    full_name: 'Inventory Staff',
    roleName: 'staff',
    assigned_department_id: null,
    assigned_location_id: null,
    assignedLabel: '— (employee / own borrow requests only)'
  }
];

const ROLE_DISPLAY = {
  admin: 'Administrator',
  staff: 'Employee (Staff)',
  'Property Manager': 'Property Manager',
  Custodian: 'Custodian'
};

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

async function userExists(connection, username) {
  const [rows] = await connection.query(
    'SELECT id FROM users WHERE username = ?',
    [username]
  );
  return rows.length > 0;
}

async function ensureUser(connection, account) {
  if (await userExists(connection, account.username)) {
    console.log(`  Skipped (exists): ${account.username}`);
    return 'skipped';
  }

  const roleId = await getRoleId(connection, account.roleName);
  const passwordHash = await bcrypt.hash(account.password, 10);

  await connection.query(
    `INSERT INTO users
      (role_id, assigned_department_id, assigned_location_id, username, email, password_hash, full_name, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      roleId,
      account.assigned_department_id,
      account.assigned_location_id,
      account.username,
      account.email,
      passwordHash,
      account.full_name
    ]
  );

  console.log(`  Created: ${account.username}`);
  return 'created';
}

async function verifyReferences(connection) {
  const [dept] = await connection.query('SELECT id, name FROM departments WHERE id = ?', [DEPT_ASSIGNMENT.id]);
  if (!dept.length) {
    throw new Error(
      `Department id ${DEPT_ASSIGNMENT.id} not found. Run "npm run seed" first.`
    );
  }

  const [loc] = await connection.query('SELECT id, name FROM locations WHERE id = ?', [LOCATION_ASSIGNMENT.id]);
  if (!loc.length) {
    throw new Error(
      `Location id ${LOCATION_ASSIGNMENT.id} not found. Run "npm run seed" first.`
    );
  }
}

function printCredentialsSummary() {
  console.log('\n--- Test account credentials ---\n');
  for (const account of TEST_ACCOUNTS) {
    console.log(`Role: ${ROLE_DISPLAY[account.roleName] || account.roleName}`);
    console.log(`Username: ${account.username}`);
    console.log(`Password: ${account.password}`);
    console.log(`Email: ${account.email}`);
    console.log(`Assigned: ${account.assignedLabel}`);
    console.log('');
  }
  console.log('See TEST_ACCOUNTS.md in the project root for copy-paste reference.');
}

async function seedTestAccounts() {
  const connection = await pool.getConnection();
  try {
    console.log('Seeding test accounts...');
    await connection.beginTransaction();

    await ensureRoles(connection);
    await verifyReferences(connection);

    let created = 0;
    let skipped = 0;

    for (const account of TEST_ACCOUNTS) {
      const result = await ensureUser(connection, account);
      if (result === 'created') created += 1;
      else skipped += 1;
    }

    await connection.commit();
    console.log(`\nDone. Created ${created}, skipped ${skipped}.`);
    printCredentialsSummary();
  } catch (error) {
    await connection.rollback();
    console.error('Seed test accounts failed:', error.message);
    process.exit(1);
  } finally {
    connection.release();
    process.exit(0);
  }
}

seedTestAccounts();
