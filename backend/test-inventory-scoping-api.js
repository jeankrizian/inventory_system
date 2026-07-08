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
  if (res.status !== 200) {
    throw new Error(`Login failed for ${username}: ${res.status}`);
  }
  return { Cookie: res.cookies };
}

(async () => {
  const admin = await login('admin', 'admin123');
  const pm = await login('pm_test', 'pm123456');
  const deptCust = await login('deptcust_test', 'dept123456');
  const employee = await login('staff', 'staff123');

  const deptMe = await request('/auth/me', { headers: deptCust });
  const assignedDepartmentId = deptMe.body?.data?.assigned_department_id;

  const adminItems = await request('/inventory', { headers: admin });
  const pmItems = await request('/inventory', { headers: pm });
  const deptItems = await request('/inventory', { headers: deptCust });
  const employeeItems = await request('/inventory', { headers: employee });

  console.log('Admin count:', adminItems.status, adminItems.body?.data?.length ?? 0);
  console.log('PM count:', pmItems.status, pmItems.body?.data?.length ?? 0);
  console.log('Dept custodian count:', deptItems.status, deptItems.body?.data?.length ?? 0, 'assigned dept:', assignedDepartmentId);
  console.log('Employee inventory:', employeeItems.status, employeeItems.body?.error || employeeItems.body?.message);

  if (adminItems.status !== 200 || pmItems.status !== 200 || deptItems.status !== 200) {
    throw new Error('Inventory list failed for privileged roles');
  }

  if (employeeItems.status !== 403) {
    throw new Error('Employee should be blocked from inventory API');
  }

  if ((pmItems.body.data || []).length < (deptItems.body.data || []).length) {
    throw new Error('Property Manager should see at least as much inventory as a scoped custodian');
  }

  if (assignedDepartmentId) {
    const deptOnly = (deptItems.body.data || []).every((item) => item.department_id === assignedDepartmentId);
    if ((deptItems.body.data || []).length > 0 && !deptOnly) {
      throw new Error('Department custodian should only see assigned department inventory');
    }
  }

  if ((adminItems.body.data || []).length < (deptItems.body.data || []).length) {
    throw new Error('Administrator should see at least as much inventory as a scoped custodian');
  }

  console.log('Inventory scoping API tests OK');
})().catch((err) => {
  console.error('Inventory scoping API test failed:', err.message);
  process.exit(1);
});
