/**
 * Verify demo test accounts seeded by seed-test-accounts.js
 * Run: npm run verify:demo-accounts
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const UserModel = require('../models/UserModel');
const {
  DEMO_ACCOUNTS,
  DEMO_USERNAMES,
  REQUIRED_DEPARTMENTS
} = require('./seed-test-accounts');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  console.log('Verifying demo test accounts...\n');

  const [adminRows] = await pool.query(
    `SELECT u.id FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.username = 'admin' AND r.name = 'admin' AND u.is_active = 1`
  );
  assert(adminRows.length === 1, 'Administrator account must remain active');

  const placeholders = DEMO_USERNAMES.map(() => '?').join(', ');
  const [users] = await pool.query(
    `SELECT u.id, u.username, u.email, u.full_name, u.is_active,
            u.assigned_department_id, u.assigned_location_id,
            r.name AS role_name, d.name AS department_name, d.code AS department_code
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN departments d ON d.id = u.assigned_department_id
     WHERE u.username IN (${placeholders})
     ORDER BY u.username`,
    DEMO_USERNAMES
  );

  assert(users.length === DEMO_ACCOUNTS.length, `Expected ${DEMO_ACCOUNTS.length} demo accounts, found ${users.length}`);

  for (const expected of DEMO_ACCOUNTS) {
    const user = users.find((row) => row.username === expected.username);
    assert(user, `Missing account: ${expected.username}`);
    assert(user.is_active === 1, `${expected.username} must be active`);
    assert(user.role_name === expected.roleName, `${expected.username} role mismatch`);
    assert(user.email.toLowerCase() === expected.email.toLowerCase(), `${expected.username} email mismatch`);
    assert(user.full_name === expected.full_name, `${expected.username} full name mismatch`);
    assert(user.assigned_location_id == null, `${expected.username} must not have laboratory assignment`);

    if (!expected.departmentCode) {
      assert(user.assigned_department_id == null, `${expected.username} must not have department assignment`);
    } else {
      assert(user.assigned_department_id != null, `${expected.username} must have department assignment`);
      assert(user.department_code === expected.departmentCode, `${expected.username} department code mismatch`);
    }

    const loginUser = await UserModel.findByLogin(expected.username);
    const passwordOk = loginUser && await bcrypt.compare(expected.password, loginUser.password_hash);
    assert(passwordOk, `${expected.username} password verification failed`);

    console.log(`  OK: ${expected.username} (${expected.roleName}${expected.departmentCode ? ` → ${expected.departmentCode}` : ''})`);
  }

  for (const dept of REQUIRED_DEPARTMENTS) {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS c FROM departments
       WHERE code = ? AND (is_archived = 0 OR is_archived IS NULL)`,
      [dept.code]
    );
    assert(Number(rows[0].c) === 1, `Expected exactly one active department for code ${dept.code}`);
    console.log(`  OK: department ${dept.name} (${dept.code})`);
  }

  const [dupUsernames] = await pool.query(
    `SELECT username, COUNT(*) AS c FROM users GROUP BY username HAVING c > 1`
  );
  assert(dupUsernames.length === 0, 'Duplicate usernames detected');

  const [dupEmails] = await pool.query(
    `SELECT LOWER(email) AS email_key, COUNT(*) AS c FROM users
     GROUP BY email_key HAVING c > 1`
  );
  assert(dupEmails.length === 0, 'Duplicate emails detected');

  const [dupDeptCodes] = await pool.query(
    `SELECT code, COUNT(*) AS c FROM departments
     WHERE is_archived = 0 OR is_archived IS NULL
     GROUP BY code HAVING c > 1`
  );
  assert(dupDeptCodes.length === 0, 'Duplicate active department codes detected');

  console.log('\nAll demo account verification checks passed.');
  process.exit(0);
})().catch((err) => {
  console.error('Demo account verification failed:', err.message);
  process.exit(1);
});
