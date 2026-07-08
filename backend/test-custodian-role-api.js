require('dotenv').config();
const pool = require('./config/database');

const base = 'http://localhost:3000/api';

async function request(path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, cookies: res.headers.get('set-cookie') };
}

(async () => {
  const [custodianRole] = await pool.query(`SELECT id FROM roles WHERE name = 'Custodian' LIMIT 1`);
  if (!custodianRole.length) throw new Error('Custodian role missing — run migration');

  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  if (login.status !== 200) throw new Error('Admin login failed');
  const auth = { Cookie: login.cookies };

  const rolesRes = await request('/users/roles', { headers: auth });
  const roleNames = (rolesRes.body?.data || []).map((r) => r.name);
  if (!roleNames.includes('Custodian')) throw new Error('Custodian role not exposed in user roles');
  if (roleNames.includes('Department Custodian') || roleNames.includes('Laboratory Custodian')) {
    throw new Error('Legacy custodian roles should be hidden when Custodian exists');
  }

  const [deptCustodians] = await pool.query(
    `SELECT u.username, r.name AS role_name, u.assigned_department_id, u.assigned_location_id
     FROM users u JOIN roles r ON u.role_id = r.id
     WHERE u.username = 'deptcust_test'`
  );
  const deptCust = deptCustodians[0];
  if (!deptCust || deptCust.role_name !== 'Custodian') {
    throw new Error('deptcust_test should be migrated to Custodian role');
  }
  if (!deptCust.assigned_department_id || deptCust.assigned_location_id) {
    throw new Error('deptcust_test should keep department-only assignment');
  }

  const deptLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'deptcust_test', password: 'dept123456' })
  });
  if (deptLogin.status !== 200) throw new Error('Custodian login failed');
  const deptAuth = { Cookie: deptLogin.cookies };

  const inventoryRes = await request('/inventory', { headers: deptAuth });
  if (inventoryRes.status !== 200) throw new Error('Custodian inventory access failed');
  const items = inventoryRes.body?.data || [];
  if (items.some((item) => item.department_id !== deptCust.assigned_department_id)) {
    throw new Error('Custodian inventory scope should remain department-based');
  }

  console.log('Custodian role API tests OK');
  process.exit(0);
})().catch((err) => {
  console.error('Custodian role API test failed:', err.message);
  process.exit(1);
});
