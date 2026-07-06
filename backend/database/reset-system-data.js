/**
 * Full system data reset for fresh production deployment.
 * Removes all operational and master data except the five QA test accounts
 * and the roles required for those accounts to function.
 *
 * Run: npm run reset:system-data
 */
require('dotenv').config();
const pool = require('../config/database');

const TEST_USERNAMES = [
  'admin',
  'staff',
  'pm_test',
  'deptcust_test',
  'labcust_test'
];

const REQUIRED_ROLES = [
  'admin',
  'staff',
  'Property Manager',
  'Department Custodian',
  'Laboratory Custodian'
];

const ROLE_BY_USERNAME = {
  admin: 'admin',
  staff: 'staff',
  pm_test: 'Property Manager',
  deptcust_test: 'Department Custodian',
  labcust_test: 'Laboratory Custodian'
};

const TABLES_TO_RESET_AUTO_INCREMENT = [
  'activity_logs',
  'borrow_items',
  'borrow_transactions',
  'component_replacements',
  'departments',
  'disposal_requests',
  'document_history',
  'inventory_items',
  'locations',
  'maintenance_records',
  'notifications',
  'return_transactions',
  'suppliers',
  'transfer_history',
  'transfer_requests'
];

async function tableExists(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS c
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName]
  );
  return rows[0].c > 0;
}

async function deleteAll(connection, tableName) {
  if (!(await tableExists(connection, tableName))) return 0;
  const [result] = await connection.query(`DELETE FROM \`${tableName}\``);
  return result.affectedRows;
}

async function resetAutoIncrement(connection, tableName) {
  if (!(await tableExists(connection, tableName))) return;
  await connection.query(`ALTER TABLE \`${tableName}\` AUTO_INCREMENT = 1`);
}

async function relinkTestUserRoles(connection) {
  for (const username of TEST_USERNAMES) {
    const roleName = ROLE_BY_USERNAME[username];
    await connection.query(
      `UPDATE users u
       JOIN roles r ON r.name = ?
       SET u.role_id = r.id,
           u.assigned_department_id = NULL,
           u.assigned_location_id = NULL
       WHERE u.username = ?`,
      [roleName, username]
    );
  }
}

async function resetSystemData() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    console.log('Resetting system data for fresh deployment...\n');

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    const steps = [
      ['document_history', () => deleteAll(connection, 'document_history')],
      ['document_sequences', () => deleteAll(connection, 'document_sequences')],
      ['notifications', () => deleteAll(connection, 'notifications')],
      ['activity_logs', () => deleteAll(connection, 'activity_logs')],
      ['return_transactions', () => deleteAll(connection, 'return_transactions')],
      ['borrow_items', () => deleteAll(connection, 'borrow_items')],
      ['borrow_transactions', () => deleteAll(connection, 'borrow_transactions')],
      ['transfer_history', () => deleteAll(connection, 'transfer_history')],
      ['transfer_requests', () => deleteAll(connection, 'transfer_requests')],
      ['disposal_requests', () => deleteAll(connection, 'disposal_requests')],
      ['component_replacements', () => deleteAll(connection, 'component_replacements')],
      ['maintenance_records', () => deleteAll(connection, 'maintenance_records')],
      ['inventory_items (clear refs)', async () => {
        if (!(await tableExists(connection, 'inventory_items'))) return 0;
        const [result] = await connection.query(
          'UPDATE inventory_items SET parent_asset_id = NULL, custodian_id = NULL'
        );
        return result.affectedRows;
      }],
      ['inventory_items (all incl. archive)', () => deleteAll(connection, 'inventory_items')],
      ['departments.custodian_id', async () => {
        if (!(await tableExists(connection, 'departments'))) return 0;
        const [result] = await connection.query('UPDATE departments SET custodian_id = NULL');
        return result.affectedRows;
      }],
      ['users (clear assignments)', async () => {
        const placeholders = TEST_USERNAMES.map(() => '?').join(', ');
        const [result] = await connection.query(
          `UPDATE users
           SET assigned_department_id = NULL, assigned_location_id = NULL
           WHERE username IN (${placeholders})`,
          TEST_USERNAMES
        );
        return result.affectedRows;
      }],
      ['non-test users', async () => {
        const placeholders = TEST_USERNAMES.map(() => '?').join(', ');
        const [result] = await connection.query(
          `DELETE FROM users WHERE username NOT IN (${placeholders})`,
          TEST_USERNAMES
        );
        return result.affectedRows;
      }],
      ['suppliers (all incl. archive)', () => deleteAll(connection, 'suppliers')],
      ['departments (all incl. archive)', () => deleteAll(connection, 'departments')],
      ['locations (all incl. archive)', () => deleteAll(connection, 'locations')],
      ['extra roles', async () => {
        const placeholders = REQUIRED_ROLES.map(() => '?').join(', ');
        const [result] = await connection.query(
          `DELETE FROM roles WHERE name NOT IN (${placeholders})`,
          REQUIRED_ROLES
        );
        return result.affectedRows;
      }],
      ['relink test user roles', async () => {
        await relinkTestUserRoles(connection);
        return TEST_USERNAMES.length;
      }]
    ];

    for (const [label, fn] of steps) {
      const count = await fn();
      console.log(`  ${label}: ${count} affected`);
    }

    for (const table of TABLES_TO_RESET_AUTO_INCREMENT) {
      await resetAutoIncrement(connection, table);
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.commit();

    console.log('\nVerifying retained test accounts...');
    const [users] = await pool.query(
      `SELECT u.username, r.name AS role, u.is_active,
              u.assigned_department_id, u.assigned_location_id
       FROM users u JOIN roles r ON u.role_id = r.id
       ORDER BY u.id`
    );
    console.table(users);

    const [roles] = await pool.query('SELECT id, name FROM roles ORDER BY id');
    console.log('\nRetained roles:');
    console.table(roles);

    const [counts] = await pool.query(`
      SELECT 'inventory_items' AS tbl, COUNT(*) AS c FROM inventory_items
      UNION ALL SELECT 'borrow_transactions', COUNT(*) FROM borrow_transactions
      UNION ALL SELECT 'transfer_requests', COUNT(*) FROM transfer_requests
      UNION ALL SELECT 'maintenance_records', COUNT(*) FROM maintenance_records
      UNION ALL SELECT 'disposal_requests', COUNT(*) FROM disposal_requests
      UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
      UNION ALL SELECT 'activity_logs', COUNT(*) FROM activity_logs
      UNION ALL SELECT 'document_history', COUNT(*) FROM document_history
      UNION ALL SELECT 'suppliers', COUNT(*) FROM suppliers
      UNION ALL SELECT 'departments', COUNT(*) FROM departments
      UNION ALL SELECT 'locations', COUNT(*) FROM locations
      UNION ALL SELECT 'roles', COUNT(*) FROM roles
      UNION ALL SELECT 'users', COUNT(*) FROM users
    `);
    console.log('\nPost-reset counts:');
    console.table(counts);

    const bcrypt = require('bcryptjs');
    const UserModel = require('../models/UserModel');
    const loginChecks = [
      ['admin', 'admin123'],
      ['staff', 'staff123'],
      ['pm_test', 'pm123456'],
      ['deptcust_test', 'dept123456'],
      ['labcust_test', 'lab123456']
    ];

    console.log('\nLogin verification:');
    for (const [username, password] of loginChecks) {
      const user = await UserModel.findByLogin(username);
      const ok = user && await bcrypt.compare(password, user.password_hash);
      console.log(`  ${username}: ${ok ? 'OK' : 'FAILED'}`);
      if (!ok) process.exit(1);
    }

    console.log('\nSystem reset completed successfully.');
    console.log('The application is ready for first-time data entry.');
  } catch (error) {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.rollback();
    console.error('System reset failed:', error.message);
    process.exit(1);
  } finally {
    connection.release();
    process.exit(0);
  }
}

resetSystemData();
