const base = 'http://localhost:3000/api';

async function request(path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    redirect: 'manual'
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, cookies: res.headers.get('set-cookie') };
}

(async () => {
  const register = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      full_name: 'Blocked User',
      username: 'blocked_user_test',
      email: 'blocked@caviteinstitute.edu.ph',
      password: 'password123',
      confirm_password: 'password123'
    })
  });
  if (register.status !== 403) {
    throw new Error(`Register should return 403, got ${register.status}`);
  }

  const roles = await request('/auth/registration-roles');
  if (roles.status !== 403) {
    throw new Error(`Registration roles should return 403, got ${roles.status}`);
  }

  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  if (login.status !== 200) {
    throw new Error('Login should still work');
  }

  const auth = { Cookie: login.cookies };
  const rolesRes = await request('/users/roles', { headers: auth });
  const staffRole = (rolesRes.body?.data || []).find((r) => r.name === 'staff');
  if (!staffRole) throw new Error('Could not resolve staff role for admin create test');

  const suffix = Date.now();
  const createUser = await request('/users', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      username: `admcreated_${suffix}`,
      email: `admcreated_${suffix}@caviteinstitute.edu.ph`,
      password: 'password123',
      full_name: 'Admin Created User',
      role: staffRole.name
    })
  });
  if (createUser.status !== 201) {
    throw new Error(`Administrator user create should work: ${createUser.status} ${createUser.body?.message}`);
  }

  const pageRes = await fetch('http://localhost:3000/register.html', { redirect: 'manual' });
  if (pageRes.status !== 302 || !pageRes.headers.get('location')?.includes('/')) {
    throw new Error('register.html should redirect to login');
  }

  console.log('Public registration disabled API tests OK');
})().catch((err) => {
  console.error('Public registration API test failed:', err.message);
  process.exit(1);
});
