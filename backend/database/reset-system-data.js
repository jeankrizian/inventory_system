/**
 * Full system data reset for development/testing.
 * Removes all operational and master data except:
 *   - system roles (admin, Property Manager, Custodian)
 *   - the Administrator account (admin / admin123)
 *
 * Run: npm run reset:system-data
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

const PRESERVED_USERNAME = 'admin';

const REQUIRED_ROLES = [
  'admin',
  'Property Manager',
  'Custodian'
];

const ADMIN_ACCOUNT = {
  username: 'admin',
  password: 'admin123',
  email: 'admin@caviteinstitute.edu',
  full_name: 'System Administrator',
  roleName: 'admin'
};

const APPLICATION_TABLES = [
  'document_history',
  'document_sequences',
  'notifications',
  'activity_logs',
  'return_transactions',
  'borrow_items',
  'borrow_transactions',
  'transfer_history',
  'transfer_requests',
  'disposal_requests',
  'component_replacements',
  'maintenance_records',
  'inventory_items',
  'suppliers',
  'departments',
  'locations',
  'users',
  'roles'
];

const TABLES_TO_RESET_AUTO_INCREMENT = [
  'activity_logs',
  'borrow_items',
  'borrow_transactions',
  'component_replacements',
  'departments',
  'disposal_requests',
  'document_history',
  'document_sequences',
  'inventory_items',
  'locations',
  'maintenance_records',
  'notifications',
  'return_transactions',
  'suppliers',
  'transfer_history',
  'transfer_requests',
  'users'
];

const FK_INTEGRITY_CHECKS = [
  {
    label: 'users.role_id -> roles',
    sql: `SELECT COUNT(*) AS c FROM users u
          LEFT JOIN roles r ON r.id = u.role_id
          WHERE r.id IS NULL`
  },
  {
    label: 'users.assigned_department_id -> departments',
    sql: `SELECT COUNT(*) AS c FROM users u
          LEFT JOIN departments d ON d.id = u.assigned_department_id
          WHERE u.assigned_department_id IS NOT NULL AND d.id IS NULL`
  },
  {
    label: 'users.assigned_location_id -> locations',
    sql: `SELECT COUNT(*) AS c FROM users u
          LEFT JOIN locations l ON l.id = u.assigned_location_id
          WHERE u.assigned_location_id IS NOT NULL AND l.id IS NULL`
  },
  {
    label: 'departments.custodian_id -> users',
    sql: `SELECT COUNT(*) AS c FROM departments d
          LEFT JOIN users u ON u.id = d.custodian_id
          WHERE d.custodian_id IS NOT NULL AND u.id IS NULL`
  }
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

async function getTableCounts(connection, tables) {
  const counts = {};
  for (const table of tables) {
    if (!(await tableExists(connection, table))) {
      counts[table] = null;
      continue;
    }
    const [rows] = await connection.query(`SELECT COUNT(*) AS c FROM \`${table}\``);
    counts[table] = Number(rows[0].c);
  }
  return counts;
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

async function ensureRoles(connection) {
  const roleSeeds = [
    ['admin', 'Full system access'],
    ['Property Manager', 'Property management office access'],
    ['Custodian', 'Asset custodian access scoped by department assignment']
  ];
  let affected = 0;
  for (const [name, description] of roleSeeds) {
    const [result] = await connection.query(
      'INSERT IGNORE INTO roles (name, description) VALUES (?, ?)',
      [name, description]
    );
    affected += result.affectedRows;
  }
  return affected;
}

async function ensureAdministratorAccount(connection) {
  const [roleRows] = await connection.query('SELECT id FROM roles WHERE name = ?', [ADMIN_ACCOUNT.roleName]);
  if (!roleRows.length) {
    throw new Error(`Required role not found: ${ADMIN_ACCOUNT.roleName}`);
  }
  const roleId = roleRows[0].id;

  const [existing] = await connection.query(
    'SELECT id FROM users WHERE username = ?',
    [ADMIN_ACCOUNT.username]
  );

  if (existing.length) {
    await connection.query(
      `UPDATE users
       SET role_id = ?,
           assigned_department_id = NULL,
           assigned_location_id = NULL,
           email = ?,
           full_name = ?,
           is_active = 1,
           is_archived = 0,
           archived_at = NULL,
           archived_by = NULL
       WHERE username = ?`,
      [roleId, ADMIN_ACCOUNT.email, ADMIN_ACCOUNT.full_name, ADMIN_ACCOUNT.username]
    );
    return 'updated';
  }

  const passwordHash = await bcrypt.hash(ADMIN_ACCOUNT.password, 10);
  await connection.query(
    `INSERT INTO users
      (role_id, assigned_department_id, assigned_location_id, username, email, password_hash, full_name, is_active)
     VALUES (?, NULL, NULL, ?, ?, ?, ?, 1)`,
    [roleId, ADMIN_ACCOUNT.username, ADMIN_ACCOUNT.email, passwordHash, ADMIN_ACCOUNT.full_name]
  );
  return 'created';
}

async function verifyForeignKeyIntegrity(connection) {
  const failures = [];
  for (const check of FK_INTEGRITY_CHECKS) {
    const [rows] = await connection.query(check.sql);
    const count = Number(rows[0].c);
    if (count > 0) {
      failures.push(`${check.label}: ${count} invalid reference(s)`);
    }
  }
  return failures;
}

async function verifyAdministratorAccount(connection) {
  const UserModel = require('../models/UserModel');
  const failures = [];

  const [users] = await connection.query(
    `SELECT u.id, u.username, u.is_active, r.name AS role_name,
            u.assigned_department_id, u.assigned_location_id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     ORDER BY u.id`
  );

  if (users.length !== 1) {
    failures.push(`Expected exactly 1 user, found ${users.length}`);
  }

  const admin = users.find((user) => user.username === PRESERVED_USERNAME);
  if (!admin) {
    failures.push(`Missing administrator account: ${PRESERVED_USERNAME}`);
  } else {
    if (admin.role_name !== ADMIN_ACCOUNT.roleName) {
      failures.push(`Administrator role mismatch: expected ${ADMIN_ACCOUNT.roleName}, got ${admin.role_name}`);
    }
    if (!admin.is_active) {
      failures.push('Administrator account is not active');
    }
    if (admin.assigned_department_id != null || admin.assigned_location_id != null) {
      failures.push('Administrator should not have department/location assignments');
    }
  }

  const loginUser = await UserModel.findByLogin(ADMIN_ACCOUNT.username);
  const loginOk = loginUser && await bcrypt.compare(ADMIN_ACCOUNT.password, loginUser.password_hash);
  if (!loginOk) {
    failures.push('Administrator login verification failed');
  }

  return { users, failures };
}

async function verifyStartupMigrations() {
  const { runSopMigration } = require('./runSopMigration');
  const { runArchiveMigration } = require('./runArchiveMigration');
  const { runMaintenanceTransferMigration } = require('./runMaintenanceTransferMigration');
  const { runAuthMigration } = require('./runAuthMigration');
  const { runClassificationMigration } = require('./runClassificationMigration');
  const { runUserArchiveMigration } = require('./runUserArchiveMigration');
  const { runDocumentMigration } = require('./runDocumentMigration');
  const { runPurchaseMigration } = require('./runPurchaseMigration');
  const { runExtendedDocumentMigration } = require('./runExtendedDocumentMigration');
  const { runRbacAssignmentMigration } = require('./runRbacAssignmentMigration');
  const { runItemDescriptionMigration } = require('./runItemDescriptionMigration');
  const { runMaterialMigration } = require('./runMaterialMigration');
  const { runCustodianRoleMigration } = require('./runCustodianRoleMigration');
  const { runCustodianTypeMigration } = require('./runCustodianTypeMigration');
  const { runStaffRoleRemovalMigration } = require('./runStaffRoleRemovalMigration');

  const migrations = [
    ['SOP', runSopMigration],
    ['Archive', runArchiveMigration],
    ['Maintenance/Transfer', runMaintenanceTransferMigration],
    ['Auth', runAuthMigration],
    ['Classification', runClassificationMigration],
    ['User Archive', runUserArchiveMigration],
    ['Document', runDocumentMigration],
    ['Purchase', runPurchaseMigration],
    ['Extended Document', runExtendedDocumentMigration],
    ['RBAC Assignment', runRbacAssignmentMigration],
    ['Item Description', runItemDescriptionMigration],
    ['Material', runMaterialMigration],
    ['Custodian Role', runCustodianRoleMigration],
    ['Custodian Type', runCustodianTypeMigration],
    ['Staff Role Removal', runStaffRoleRemovalMigration]
  ];

  for (const [name, run] of migrations) {
    try {
      await run();
    } catch (err) {
      throw new Error(`${name} migration failed: ${err.message}`);
    }
  }
}

async function verifyAdminLoginApi() {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: ADMIN_ACCOUNT.username,
      password: ADMIN_ACCOUNT.password
    })
  });
  if (res.status !== 200) {
    throw new Error(`Administrator API login failed with status ${res.status}`);
  }
}

async function resetSystemData() {
  const connection = await pool.getConnection();
  const deletedCounts = {};
  let preCounts = {};

  try {
    console.log('Analyzing database before reset...\n');
    preCounts = await getTableCounts(connection, APPLICATION_TABLES);
    console.table(
      Object.entries(preCounts)
        .filter(([, count]) => count != null)
        .map(([table, count]) => ({ table, records_before: count }))
    );

    await connection.beginTransaction();
    console.log('\nResetting system data...\n');

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
          'UPDATE inventory_items SET parent_asset_id = NULL, custodian_id = NULL, location_id = NULL, supplier_id = NULL'
        );
        return result.affectedRows;
      }],
      ['inventory_items', () => deleteAll(connection, 'inventory_items')],
      ['departments.custodian_id', async () => {
        if (!(await tableExists(connection, 'departments'))) return 0;
        const [result] = await connection.query('UPDATE departments SET custodian_id = NULL');
        return result.affectedRows;
      }],
      ['suppliers', () => deleteAll(connection, 'suppliers')],
      ['departments', () => deleteAll(connection, 'departments')],
      ['locations', () => deleteAll(connection, 'locations')],
      ['non-admin users', async () => {
        const [result] = await connection.query(
          'DELETE FROM users WHERE username <> ?',
          [PRESERVED_USERNAME]
        );
        return result.affectedRows;
      }],
      ['extra roles', async () => {
        const placeholders = REQUIRED_ROLES.map(() => '?').join(', ');
        const [result] = await connection.query(
          `DELETE FROM roles WHERE name NOT IN (${placeholders})`,
          REQUIRED_ROLES
        );
        return result.affectedRows;
      }],
      ['ensure system roles', () => ensureRoles(connection)],
      ['ensure administrator account', async () => {
        const result = await ensureAdministratorAccount(connection);
        return result === 'created' ? 1 : 0;
      }]
    ];

    for (const [label, fn] of steps) {
      const count = await fn();
      deletedCounts[label] = count;
      console.log(`  ${label}: ${count} affected`);
    }

    for (const table of TABLES_TO_RESET_AUTO_INCREMENT) {
      await resetAutoIncrement(connection, table);
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    const fkFailures = await verifyForeignKeyIntegrity(connection);
    if (fkFailures.length) {
      throw new Error(`Foreign key integrity check failed:\n  - ${fkFailures.join('\n  - ')}`);
    }

    await connection.commit();

    const postCounts = await getTableCounts(connection, APPLICATION_TABLES);
    const reportRows = Object.entries(preCounts)
      .filter(([, count]) => count != null)
      .map(([table]) => ({
        table,
        deleted: preCounts[table],
        remaining: postCounts[table]
      }));

    console.log('\nTables cleaned (deleted vs remaining):');
    console.table(reportRows);

    console.log('\nVerifying administrator account...');
    const { users, failures: accountFailures } = await verifyAdministratorAccount(connection);
    if (accountFailures.length) {
      throw new Error(`Administrator verification failed:\n  - ${accountFailures.join('\n  - ')}`);
    }
    console.table(users);

    const [roles] = await pool.query('SELECT id, name FROM roles ORDER BY id');
    console.log('\nRetained roles:');
    console.table(roles);

    console.log('\nForeign key integrity: OK');

    console.log('\nVerifying startup migrations...');
    await verifyStartupMigrations();
    console.log('Startup migrations: OK');

    try {
      await verifyAdminLoginApi();
      console.log('Administrator API login: OK');
    } catch (err) {
      console.log(`Administrator API login: skipped (${err.message})`);
      console.log('Start the server and log in as admin / admin123 to verify.');
    }

    console.log('\nSystem reset completed successfully.');
    console.log('Only the Administrator account remains. Schema was not modified.');
    console.log('Credentials: admin / admin123');
  } catch (error) {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
    await connection.rollback();
    console.error('System reset failed:', error.message);
    process.exit(1);
  } finally {
    connection.release();
    process.exit(0);
  }
}

resetSystemData();
