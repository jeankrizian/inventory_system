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
  const pm = await login('pm_test', 'pm123456');
  const custodian = await login('deptcust_test', 'dept123456');
  const meRes = await request('/auth/me', { headers: custodian });
  const custodianUserId = meRes.body?.data?.id;
  const assignedDeptId = meRes.body?.data?.assigned_department_id;
  if (!custodianUserId || !assignedDeptId) {
    throw new Error('Custodian profile missing user id or assigned department');
  }

  const reportsRes = await request('/reports/inventory', { headers: custodian });
  if (reportsRes.status !== 200) {
    throw new Error(`Custodian reports access failed (${reportsRes.status})`);
  }

  const transfersRes = await request('/transfers', { headers: custodian });
  if (transfersRes.status !== 200) {
    throw new Error(`Custodian transfer list access failed (${transfersRes.status})`);
  }

  const maintenanceRes = await request('/maintenance', { headers: custodian });
  if (maintenanceRes.status !== 200) {
    throw new Error(`Custodian maintenance list access failed (${maintenanceRes.status})`);
  }

  const disposalRes = await request('/disposals', { headers: custodian });
  if (disposalRes.status !== 200) {
    throw new Error(`Custodian disposal list access failed (${disposalRes.status})`);
  }

  const borrowsRes = await request('/borrow', { headers: custodian });
  if (borrowsRes.status !== 200) {
    throw new Error(`Custodian borrow list access failed (${borrowsRes.status})`);
  }

  const pmTransfersRes = await request('/transfers', { headers: pm });
  const pmMaintenanceRes = await request('/maintenance', { headers: pm });
  const pmBorrowsRes = await request('/borrow', { headers: pm });
  if (pmTransfersRes.status !== 200 || pmMaintenanceRes.status !== 200 || pmBorrowsRes.status !== 200) {
    throw new Error('Property Manager transaction list request failed');
  }
  if ((transfersRes.body?.data || []).length > (pmTransfersRes.body?.data || []).length) {
    throw new Error('Custodian should not see more transfers than property manager');
  }
  if ((maintenanceRes.body?.data || []).length > (pmMaintenanceRes.body?.data || []).length) {
    throw new Error('Custodian should not see more maintenance records than property manager');
  }
  if ((borrowsRes.body?.data || []).length > (pmBorrowsRes.body?.data || []).length) {
    throw new Error('Custodian should not see more borrow records than property manager');
  }
  if ((borrowsRes.body?.data || []).some((row) => row.borrower_id !== custodianUserId)) {
    throw new Error('Custodian borrow list should only include their own requests');
  }

  const inventoryRes = await request('/inventory', { headers: custodian });
  if (inventoryRes.status !== 200) {
    throw new Error(`Custodian inventory access failed (${inventoryRes.status})`);
  }

  const scopedItemIds = new Set((inventoryRes.body?.data || []).map((item) => item.id));
  if ((maintenanceRes.body?.data || []).some((row) => !scopedItemIds.has(row.inventory_item_id))) {
    throw new Error('Custodian maintenance list should only include assigned assets');
  }

  const transferInScope = (row) =>
    row.from_department_id === assignedDeptId
    || row.to_department_id === assignedDeptId
    || scopedItemIds.has(row.inventory_item_id);
  if ((transfersRes.body?.data || []).some((row) => !transferInScope(row))) {
    throw new Error('Custodian transfer list should only include assigned department transactions');
  }

  const scopedItem = (inventoryRes.body?.data || []).find((item) =>
    item.status !== 'Disposed' && item.asset_classification !== 'Consumable'
  );
  if (scopedItem) {
    const locRes = await request('/locations', { headers: custodian });
    const deptRes = await request('/departments', { headers: custodian });
    const locationId = locRes.body?.data?.[0]?.id;
    const departmentId = deptRes.body?.data?.[0]?.id;
    if (!locationId || !departmentId) throw new Error('Missing location or department for transfer submit test');

    const createRes = await request('/transfers', {
      method: 'POST',
      headers: custodian,
      body: JSON.stringify({
        inventory_item_id: scopedItem.id,
        to_location_id: locationId,
        to_department_id: departmentId,
        reason: 'Custodian transfer submit test'
      })
    });
    if (createRes.status !== 201) {
      throw new Error(`Custodian transfer submit failed (${createRes.status}: ${createRes.body?.message})`);
    }
  }

  const pendingTransfer = (transfersRes.body?.data || []).find((t) => t.status === 'Pending');
  if (pendingTransfer) {
    const approveRes = await request(`/transfers/${pendingTransfer.id}/approve`, {
      method: 'PUT',
      headers: custodian,
      body: JSON.stringify({ notes: 'custodian test' })
    });
    if (approveRes.status !== 403) {
      throw new Error('Custodian should not approve transfers');
    }
  } else {
    const approveRes = await request('/transfers/1/approve', {
      method: 'PUT',
      headers: custodian,
      body: JSON.stringify({ notes: 'custodian test' })
    });
    if (approveRes.status !== 403 && approveRes.status !== 404) {
      throw new Error(`Custodian transfer approve should be forbidden (got ${approveRes.status})`);
    }
  }

  const pendingMaintenance = (maintenanceRes.body?.data || []).find((m) => m.status === 'Pending');
  if (pendingMaintenance) {
    const approveRes = await request(`/maintenance/${pendingMaintenance.id}/approve`, {
      method: 'PUT',
      headers: custodian,
      body: JSON.stringify({ notes: 'custodian test' })
    });
    if (approveRes.status !== 403) {
      throw new Error('Custodian should not approve maintenance');
    }
  }

  const archiveRes = await request('/archive', { headers: custodian });
  if (archiveRes.status !== 403) {
    throw new Error('Custodian should not access archive');
  }

  console.log('Custodian modules API tests OK');
})().catch((err) => {
  console.error('Custodian modules API test failed:', err.message);
  process.exit(1);
});
