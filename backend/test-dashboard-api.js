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
  const pm = await login('pm_test', 'pm123456');
  const custodian = await login('deptcust_test', 'dept123456');
  const employee = await login('staff', 'staff123');

  const adminDash = await request('/dashboard', { headers: admin });
  const pmDash = await request('/dashboard', { headers: pm });
  const custDash = await request('/dashboard', { headers: custodian });
  const empDash = await request('/dashboard', { headers: employee });

  for (const [label, res] of [
    ['admin', adminDash],
    ['pm', pmDash],
    ['custodian', custDash],
    ['employee', empDash]
  ]) {
    if (res.status !== 200) throw new Error(`${label} dashboard request failed (${res.status})`);
  }

  const adminModules = adminDash.body?.data?.dashboardModules || {};
  const pmModules = pmDash.body?.data?.dashboardModules || {};
  const custModules = custDash.body?.data?.dashboardModules || {};
  const empModules = empDash.body?.data?.dashboardModules || {};

  if (!adminModules.usersStats || adminModules.personalBorrowStats) {
    throw new Error('Administrator dashboard modules mismatch');
  }
  if (!pmModules.pendingApprovals || !pmModules.charts) {
    throw new Error('Property Manager dashboard modules mismatch');
  }
  if (!custModules.lowStock || !custModules.activities || custModules.recentBorrows) {
    throw new Error('Custodian dashboard modules mismatch');
  }
  if (!empModules.personalBorrowStats || empModules.inventoryStats) {
    throw new Error('Employee dashboard modules mismatch');
  }

  const empStats = empDash.body?.data?.stats || {};
  if (typeof empStats.total_borrow_requests !== 'number') {
    throw new Error('Employee dashboard should include total borrow requests');
  }

  const custStats = custDash.body?.data?.stats || {};
  if (typeof custStats.total_items !== 'number' || typeof custStats.borrowed_items !== 'number') {
    throw new Error('Custodian dashboard should include assigned and borrowed asset counts');
  }

  const manifestRes = await fetch('http://localhost:3000/manifest.webmanifest');
  const swRes = await fetch('http://localhost:3000/sw.js');
  if (!manifestRes.ok || !swRes.ok) {
    throw new Error('PWA assets should be served from frontend');
  }

  console.log('Dashboard API tests OK');
})().catch((err) => {
  console.error('Dashboard API test failed:', err.message);
  process.exit(1);
});
