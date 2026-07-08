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

function hasNotificationType(notifications, type) {
  return (notifications || []).some((n) => n.type === type);
}

(async () => {
  const employee = await login('staff', 'staff123');
  const pm = await login('pm_test', 'pm123456');
  const admin = await login('admin', 'admin123');

  const deptCustRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'deptcust_test', password: 'dept123456' })
  });
  if (deptCustRes.status !== 200) {
    throw new Error('deptcust_test login failed');
  }
  const deptCust = { Cookie: deptCustRes.cookies };
  const deptCustSession = await request('/auth/me', { headers: deptCust });
  const assignedDeptId = deptCustSession.body?.data?.assigned_department_id;

  const borrowableRes = await request('/borrow/borrowable-items', { headers: employee });
  const borrowable = (borrowableRes.body?.data || []).filter((item) => item.is_borrowable !== false);
  if (!borrowable.length) {
    throw new Error('No borrowable items available for notification API test');
  }

  const deptItem =
    borrowable.find((item) => item.department_id === assignedDeptId) ||
    borrowable.find((item) => item.department_id) ||
    borrowable[0];

  const create = await request('/borrow', {
    method: 'POST',
    headers: employee,
    body: JSON.stringify({
      borrow_date: new Date().toISOString().split('T')[0],
      purpose: 'Notification routing API test',
      items: [{ inventory_item_id: deptItem.id, quantity: 1 }]
    })
  });

  if (create.status !== 201) {
    throw new Error(`Borrow create failed: ${create.status} ${create.body?.message || create.body?.error}`);
  }

  const borrowId = create.body?.data?.id;

  const employeeNotes = await request('/notifications', { headers: employee });
  const pmNotes = await request('/notifications', { headers: pm });
  const deptCustNotes = await request('/notifications', { headers: deptCust });

  if (employeeNotes.status !== 200 || pmNotes.status !== 200 || deptCustNotes.status !== 200) {
    throw new Error('Notifications endpoint failed');
  }

  const employeeList = employeeNotes.body?.data?.notifications || [];
  const pmList = pmNotes.body?.data?.notifications || [];
  const custList = deptCustNotes.body?.data?.notifications || [];

  if (!hasNotificationType(employeeList, 'borrow_submitted')) {
    throw new Error('Employee should receive borrow_submitted notification');
  }
  if (!hasNotificationType(pmList, 'borrow_request')) {
    throw new Error('Property Manager should receive borrow_request notification');
  }

  if (
    assignedDeptId &&
    deptItem.department_id === assignedDeptId &&
    !hasNotificationType(custList, 'assigned_asset_borrow_requested')
  ) {
    throw new Error('Department custodian should receive assigned_asset_borrow_requested for assigned dept item');
  }

  const supplierName = `NotifTest Supplier ${Date.now()}`;
  const supplierCreate = await request('/suppliers', {
    method: 'POST',
    headers: admin,
    body: JSON.stringify({
      name: supplierName,
      contact_person: 'QA',
      email: 'qa@test.local',
      phone: '000',
      address: 'Test'
    })
  });

  if (supplierCreate.status !== 201) {
    throw new Error(`Supplier create failed: ${supplierCreate.status}`);
  }

  const adminNotes = await request('/notifications', { headers: admin });
  const adminList = adminNotes.body?.data?.notifications || [];
  if (!hasNotificationType(adminList, 'supplier_added')) {
    throw new Error('Administrator should receive supplier_added notification');
  }

  const pmAfterSupplier = await request('/notifications', { headers: pm });
  const pmSupplierList = pmAfterSupplier.body?.data?.notifications || [];
  if (hasNotificationType(pmSupplierList, 'supplier_added')) {
    throw new Error('Property Manager should not receive supplier_added (admin-only event)');
  }

  console.log('Borrow notification id:', borrowId);
  console.log('Supplier notification routing OK');
  console.log('Role-based notification API tests OK');
})().catch((err) => {
  console.error('Notification API test failed:', err.message);
  process.exit(1);
});
