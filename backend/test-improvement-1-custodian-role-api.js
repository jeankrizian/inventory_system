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

async function login(username, password) {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  if (res.status !== 200) throw new Error(`Login failed for ${username}`);
  return { Cookie: res.cookies };
}

(async () => {
  const admin = await login('admin', 'admin123');

  const rolesRes = await request('/users/roles', { headers: admin });
  const roleNames = (rolesRes.body?.data || []).map((role) => role.name);
  if (!roleNames.includes('Custodian')) throw new Error('Custodian role missing from user roles');
  if (roleNames.includes('Department Custodian') || roleNames.includes('Laboratory Custodian')) {
    throw new Error('Legacy custodian roles should not be exposed');
  }

  const usersRes = await request('/users', { headers: admin });
  const legacyUsers = (usersRes.body?.data || []).filter((user) =>
    ['Department Custodian', 'Laboratory Custodian'].includes(user.role_name)
  );
  if (legacyUsers.length) throw new Error('Users still assigned to legacy custodian roles');

  const custodian = await login('deptcust_test', 'dept123456');
  const meRes = await request('/auth/me', { headers: custodian });
  if (meRes.body?.data?.role_name !== 'Custodian') {
    throw new Error('deptcust_test should use unified Custodian role');
  }

  console.log('Improvement 1 custodian role API tests OK');
})().catch((err) => {
  console.error('Improvement 1 custodian role API test failed:', err.message);
  process.exit(1);
});
