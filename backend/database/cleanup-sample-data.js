/**
 * Remove all sample/demo transactional data while preserving test accounts
 * and required configuration (roles, departments, locations, suppliers).
 *
 * Run: npm run cleanup:sample-data
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

const TABLES_TO_RESET_AUTO_INCREMENT = [
  'activity_logs',
  'borrow_items',
  'borrow_transactions',
  'component_replacements',
  'disposal_requests',
  'document_history',
  'inventory_items',
  'maintenance_records',
  'notifications',
  'return_transactions',
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

async function cleanupSampleData() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    console.log('Cleaning sample/demo data...\n');

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    const steps = [
      ['document_history', () => deleteAll(connection, 'document_history')],
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
      ['inventory_items', () => deleteAll(connection, 'inventory_items')],
      ['document_sequences', () => deleteAll(connection, 'document_sequences')],
      ['departments.custodian_id', async () => {
        const [result] = await connection.query('UPDATE departments SET custodian_id = NULL');
        return result.affectedRows;
      }],
      ['non-test users', async () => {
        const placeholders = TEST_USERNAMES.map(() => '?').join(', ');
        const [result] = await connection.query(
          `DELETE FROM users WHERE username NOT IN (${placeholders})`,
          TEST_USERNAMES
        );
        return result.affectedRows;
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
      `SELECT u.username, r.name AS role, u.is_active
       FROM users u JOIN roles r ON u.role_id = r.id
       ORDER BY u.id`
    );
    console.table(users);

    const [counts] = await pool.query(`
      SELECT 'inventory_items' AS tbl, COUNT(*) AS c FROM inventory_items
      UNION ALL SELECT 'borrow_transactions', COUNT(*) FROM borrow_transactions
      UNION ALL SELECT 'transfer_requests', COUNT(*) FROM transfer_requests
      UNION ALL SELECT 'maintenance_records', COUNT(*) FROM maintenance_records
      UNION ALL SELECT 'disposal_requests', COUNT(*) FROM disposal_requests
      UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
      UNION ALL SELECT 'activity_logs', COUNT(*) FROM activity_logs
      UNION ALL SELECT 'document_history', COUNT(*) FROM document_history
      UNION ALL SELECT 'roles', COUNT(*) FROM roles
      UNION ALL SELECT 'departments', COUNT(*) FROM departments
      UNION ALL SELECT 'locations', COUNT(*) FROM locations
      UNION ALL SELECT 'suppliers', COUNT(*) FROM suppliers
      UNION ALL SELECT 'users', COUNT(*) FROM users
    `);
    console.log('\nPost-cleanup counts:');
    console.table(counts);

    console.log('\nCleanup completed successfully.');
    console.log('Retained users:', TEST_USERNAMES.join(', '));
  } catch (error) {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.rollback();
    console.error('Cleanup failed:', error.message);
    process.exit(1);
  } finally {
    connection.release();
    process.exit(0);
  }
}

cleanupSampleData();
