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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  if (login.status !== 200) throw new Error('Admin login failed');

  const auth = { Cookie: login.cookies };
  const usersRes = await request('/users', { headers: auth });
  if (usersRes.status !== 200) throw new Error('Users list request failed');

  const users = usersRes.body?.data || [];
  assert(users.length > 0, 'Users list should not be empty');

  const first = users[0];
  assert('assigned_department_name' in first, 'assigned_department_name returned');
  assert('assigned_location_name' in first, 'assigned_location_name returned');
  assert('assigned_department_id' in first, 'assigned_department_id returned');
  assert('assigned_location_id' in first, 'assigned_location_id returned');

  const custodian = users.find((u) => (u.role_name || '') === 'Custodian' && u.assigned_department_id);
  const labCustodian = users.find((u) => (u.role_name || '') === 'Custodian' && u.assigned_location_id);

  if (custodian) {
    assert(custodian.assigned_department_id, 'Department-assigned custodian should have department assignment id');
    assert(custodian.assigned_department_name, 'Department-assigned custodian should have department assignment name');
    console.log('Department custodian assignment:', custodian.assigned_department_name);
  } else {
    console.log('No department-assigned custodian in users list; skipped assignment name check');
  }

  if (labCustodian) {
    assert(labCustodian.assigned_location_id, 'Laboratory-assigned custodian should have location assignment id');
    assert(labCustodian.assigned_location_name, 'Laboratory-assigned custodian should have location assignment name');
    console.log('Laboratory custodian assignment:', labCustodian.assigned_location_name);
  } else {
    console.log('No laboratory-assigned custodian in users list; skipped assignment name check');
  }

  const legacyRoles = users.filter((u) => ['Department Custodian', 'Laboratory Custodian'].includes(u.role_name));
  if (legacyRoles.length) {
    throw new Error('Legacy custodian roles should not appear in manage users list');
  }

  console.log('Manage users assignment column API tests OK');
})().catch((err) => {
  console.error('Manage users column API test failed:', err.message);
  process.exit(1);
});
