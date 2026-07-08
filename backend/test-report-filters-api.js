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

  const allRes = await request('/reports/inventory', { headers: admin });
  const deptRes = await request('/departments', { headers: admin });
  if (allRes.status !== 200 || deptRes.status !== 200) {
    throw new Error('Report or departments request failed');
  }

  const allCount = (allRes.body?.data || []).length;
  const deptId = deptRes.body?.data?.[0]?.id;
  if (!deptId) throw new Error('No departments available');

  const filteredRes = await request(`/reports/inventory?department_id=${deptId}`, { headers: admin });
  if (filteredRes.status !== 200) throw new Error('Filtered inventory report failed');

  const filtered = filteredRes.body?.data || [];
  if (filtered.length > allCount) {
    throw new Error('Filtered report should not exceed unfiltered count');
  }
  if (filtered.some((item) => item.department_id !== deptId)) {
    throw new Error('Filtered inventory report contains wrong department');
  }

  const borrowAll = await request('/reports/borrow', { headers: admin });
  const borrowFiltered = await request(`/reports/borrow?department_id=${deptId}`, { headers: admin });
  if (borrowAll.status !== 200 || borrowFiltered.status !== 200) {
    throw new Error('Borrow report filter request failed');
  }
  if ((borrowFiltered.body?.data || []).length > (borrowAll.body?.data || []).length) {
    throw new Error('Filtered borrow report should not exceed unfiltered count');
  }

  console.log('Inventory filtered:', filtered.length, '/', allCount);
  console.log('Borrow filtered:', (borrowFiltered.body?.data || []).length, '/', (borrowAll.body?.data || []).length);
  console.log('Report filter API tests OK');
})().catch((err) => {
  console.error('Report filter API test failed:', err.message);
  process.exit(1);
});
