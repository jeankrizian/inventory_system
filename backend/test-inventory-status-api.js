/**
 * API integration tests for automated inventory status (improvement #11).
 * Run: node test-inventory-status-api.js
 */
const BASE = 'http://localhost:3000/api';

let cookie = '';

async function request(method, path, body, expectError = false) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const json = await res.json().catch(() => ({}));
  if (!res.ok && !expectError) {
    throw new Error(json.message || `HTTP ${res.status} ${path}`);
  }
  return { res, json, status: res.status, message: json.message, data: json.data };
}

function assertEq(actual, expected, label) {
  if (String(actual) !== String(expected)) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

async function login(username, password) {
  cookie = '';
  await request('POST', '/auth/login', { username, password });
}

async function asUser(username, password, fn) {
  const saved = cookie;
  await login(username, password);
  try {
    return await fn();
  } finally {
    cookie = saved;
  }
}

async function getItem(id) {
  return (await request('GET', `/inventory/${id}`)).data;
}

async function main() {
  const results = [];
  const run = async (name, fn) => {
    try {
      await fn();
      results.push({ name, ok: true });
      console.log(`✓ ${name}`);
    } catch (err) {
      results.push({ name, ok: false, error: err.message });
      console.error(`✗ ${name}: ${err.message}`);
    }
  };

  await login('admin', 'admin123');
  const depts = (await request('GET', '/departments')).data || [];
  const deptId = depts.find((d) => /information technology|ict/i.test(d.name))?.id || depts[0]?.id;
  const users = (await request('GET', '/users')).data || [];
  const custodianId = users.find((u) => u.username === 'ict_custodian')?.id
    || users.find((u) => u.role === 'Custodian')?.id;

  const stamp = Date.now();
  let assetId;
  let borrowId;

  await run('New assets always start as Available', async () => {
    const { data } = await request('POST', '/inventory', {
      item_name: `Status Auto ${stamp}`,
      department_id: deptId,
      asset_count: 1,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    });
    assetId = data?.id || data?.created_ids?.[0] || data?.first_id;
    if (!assetId) throw new Error('Create did not return asset id');
    const item = await getItem(assetId);
    assertEq(item.status, 'Available', 'create status');
    if ('available_quantity' in item) {
      throw new Error('available_quantity should not be exposed');
    }
  });

  await run('Manual status on create is rejected', async () => {
    const { status, message } = await request('POST', '/inventory', {
      item_name: `Reject Status ${stamp}`,
      department_id: deptId,
      asset_count: 1,
      status: 'Disposed',
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    }, true);
    assertEq(status, 400, 'HTTP status');
    if (!/workflow-managed/i.test(message || '')) {
      throw new Error(`unexpected message: ${message}`);
    }
  });

  await run('Borrow workflow sets Borrowed', async () => {
    const item = await getItem(assetId);
    const created = await asUser('ict_custodian', 'cust123456', () => request('POST', '/borrow', {
      purpose: 'Status automation borrow test',
      borrow_date: new Date().toISOString().split('T')[0],
      expected_return_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      items: [{ item_code: item.item_code, quantity: 1 }]
    }));
    borrowId = created.data?.id;
    if (!borrowId) throw new Error('No borrow id');
    await asUser('pm_test', 'pm123456', () => request('PUT', `/borrow/${borrowId}/approve`));
    assertEq((await getItem(assetId)).status, 'Borrowed', 'status after borrow approve');
  });

  await run('Manual status on update is rejected', async () => {
    const { status, message } = await request('PUT', `/inventory/${assetId}`, {
      item_name: `Status Auto ${stamp}`,
      status: 'Available'
    }, true);
    assertEq(status, 400, 'HTTP status');
    if (!/workflow-managed/i.test(message || '')) {
      throw new Error(`unexpected message: ${message}`);
    }
    assertEq((await getItem(assetId)).status, 'Borrowed', 'borrowed status preserved');
  });

  await run('Return workflow sets Available', async () => {
    await asUser('pm_test', 'pm123456', () => request('POST', `/borrow/${borrowId}/return`, {
      return_date: new Date().toISOString().split('T')[0],
      condition: 'Good'
    }));
    assertEq((await getItem(assetId)).status, 'Available', 'status after return');
  });

  let maintItemId;
  await run('Maintenance approve sets Under Maintenance', async () => {
    const { data } = await request('POST', '/inventory', {
      item_name: `Maint Status ${stamp}`,
      department_id: deptId,
      asset_count: 1,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    });
    maintItemId = data?.id || data?.created_ids?.[0];

    const maintRes = await asUser('ict_custodian', 'cust123456', () => request('POST', '/maintenance', {
      inventory_item_id: maintItemId,
      maintenance_type: 'Preventive',
      priority: 'Medium',
      scheduled_date: new Date().toISOString().split('T')[0],
      reported_problem: 'Status automation maintenance test'
    }));
    await asUser('pm_test', 'pm123456', () => request('PUT', `/maintenance/${maintRes.data.id}/approve`, {
      scheduled_date: new Date().toISOString().split('T')[0]
    }));
    assertEq((await getItem(maintItemId)).status, 'Under Maintenance', 'maintenance approved');
  });

  await run('Maintenance complete sets Available', async () => {
    const records = (await request('GET', `/maintenance?inventory_item_id=${maintItemId}`)).data || [];
    const record = records.find((r) => ['Approved', 'Scheduled'].includes(r.status)) || records[0];
    if (!record) throw new Error('Maintenance record not found');
    await asUser('pm_test', 'pm123456', () => request('PUT', `/maintenance/${record.id}/complete`, {
      completed_date: new Date().toISOString().split('T')[0],
      completion_remarks: 'Done'
    }));
    assertEq((await getItem(maintItemId)).status, 'Available', 'after maintenance complete');
  });

  await run('Disposal approve sets Disposed', async () => {
    const { data } = await request('POST', '/inventory', {
      item_name: `Disposal Status ${stamp}`,
      department_id: deptId,
      asset_count: 1,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    });
    const dispItemId = data?.id || data?.created_ids?.[0];

    const dispRes = await asUser('ict_custodian', 'cust123456', () => request('POST', '/disposals', {
      inventory_item_id: dispItemId,
      reason: 'Status test disposal'
    }));
    await asUser('pm_test', 'pm123456', async () => {
      await request('PUT', `/disposals/${dispRes.data.id}/inspect`, { inspection_notes: 'OK' });
      await request('PUT', `/disposals/${dispRes.data.id}/approve`, {
        disposal_method: 'Destruction',
        disposal_date: new Date().toISOString().split('T')[0]
      });
    });
    assertEq((await getItem(dispItemId)).status, 'Disposed', 'disposed');
  });

  await run('Dashboard stats use workflow status counts', async () => {
    const stats = (await request('GET', '/dashboard/stats')).data || {};
    const inv = stats.inventory || stats;
    const required = ['available_items', 'borrowed_items', 'under_maintenance', 'disposed'];
    for (const key of required) {
      if (inv[key] === undefined && stats[key] === undefined) {
        throw new Error(`Dashboard missing ${key} count`);
      }
    }
    if (inv.low_stock !== undefined || stats.low_stock !== undefined) {
      throw new Error('Dashboard should not expose low_stock counts');
    }
  });

  let archivedId;
  await run('Archived assets excluded from active lists', async () => {
    const { data } = await request('POST', '/inventory', {
      item_name: `Archive Status ${stamp}`,
      department_id: deptId,
      asset_count: 1,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    });
    archivedId = data?.id || data?.created_ids?.[0];
    const item = await getItem(archivedId);
    const tag = item.property_tag;
    const code = item.item_code;

    await request('DELETE', `/inventory/${archivedId}`);

    const listErr = await request('GET', `/inventory/${archivedId}`, null, true);
    if (listErr.status !== 404) {
      throw new Error(`archived asset should 404 on getById, got ${listErr.status}`);
    }

    const list = (await request('GET', '/inventory')).data || [];
    if (list.some((row) => Number(row.id) === Number(archivedId))) {
      throw new Error('archived asset still in inventory list');
    }

    const search = (await request('GET', `/search?q=${encodeURIComponent(tag || code)}`)).data || {};
    const hits = search.inventory || [];
    if (hits.some((row) => Number(row.id) === Number(archivedId))) {
      throw new Error('archived asset still in global search');
    }

    const models = (await asUser('ict_custodian', 'cust123456', () => request('GET', '/borrow/borrowable-items'))).data || [];
    const model = models.find((m) => m.item_code === code);
    if (model && Number(model.available_count) > 0) {
      const assets = (await asUser('ict_custodian', 'cust123456', () => request(
        'GET',
        `/borrow/borrowable-models/${encodeURIComponent(code)}/assets`
      ))).data || [];
      if (assets.some((row) => Number(row.id) === Number(archivedId))) {
        throw new Error('archived asset still in borrowable assets');
      }
    }
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
