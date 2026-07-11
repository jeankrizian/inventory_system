/**
 * Phase 6: transactions reference inventory_item_id (not property_tag for lookups).
 * Run: node test-phase6-transaction-normalization-api.js
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
  return { res, json };
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
  return (await request('GET', `/inventory/${id}`)).json.data;
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
  const depts = (await request('GET', '/departments')).json.data || [];
  const deptId = depts.find((d) => /information technology|ict/i.test(d.name))?.id || depts[0]?.id;
  const users = (await request('GET', '/users')).json.data || [];
  const custodianId = users.find((u) => u.username === 'ict_custodian')?.id
    || users.find((u) => u.role === 'Custodian')?.id;
  const locations = (await request('GET', '/locations')).json.data || [];
  const locationId = locations[0]?.id;

  const stamp = Date.now();
  let assetIds = [];
  let itemCode;
  let borrowId;

  await run('Create assets for transaction normalization test', async () => {
    const { json } = await request('POST', '/inventory', {
      item_name: `Phase6 Txn ${stamp}`,
      department_id: deptId,
      asset_count: 3,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    });
    itemCode = json.data.item_code;
    assetIds = json.data.created_ids || [];
    assertEq(assetIds.length, 3, 'created assets');
  });

  await run('FIFO borrow stores inventory_item_id', async () => {
    const fifoId = assetIds[0];
    const preview = (await request('POST', '/borrow/preview-allocation', {
      items: [{ item_code: itemCode, quantity: 1 }]
    })).json.data;

    const allocatedId = preview.assets?.[0]?.inventory_item_id;
    assertEq(allocatedId, fifoId, 'preview inventory_item_id');

    const created = await asUser('ict_custodian', 'cust123456', () => request('POST', '/borrow', {
      purpose: 'Phase 6 ID-based borrow',
      borrow_date: new Date().toISOString().split('T')[0],
      expected_return_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      items: [{ item_code: itemCode, quantity: 1 }]
    }));
    borrowId = created.json.data?.id;
    if (!borrowId) throw new Error('No borrow id');

    const detail = (await request('GET', `/borrow/${borrowId}`)).json.data;
    const line = (detail.items || [])[0];
    assertEq(line.inventory_item_id, fifoId, 'borrow_items inventory_item_id');
  });

  await run('property_tag_ids no longer selects assets (FIFO used instead)', async () => {
    const item = await getItem(assetIds[1]);
    const preview = (await request('POST', '/borrow/preview-allocation', {
      items: [{ item_code: itemCode, quantity: 1, property_tag_ids: [item.property_tag] }]
    })).json.data;
    const allocatedId = preview.assets?.[0]?.inventory_item_id;
    if (allocatedId === assetIds[1]) {
      throw new Error('property_tag_ids should not drive allocation; got matching asset by tag');
    }
    if (!allocatedId) throw new Error('FIFO preview should still allocate an asset');
  });

  await run('Invalid manual inventory_item_ids are ignored (FIFO used)', async () => {
    const preview = (await request('POST', '/borrow/preview-allocation', {
      items: [{ item_code: itemCode, quantity: 1, inventory_item_ids: [999999999] }]
    })).json.data;
    assertEq(preview.assignment_mode, 'fifo', 'assignment mode');
    assertEq(preview.assets?.[0]?.inventory_item_id, assetIds[0], 'FIFO asset id');
  });

  await run('Transfer create and history use inventory_item_id', async () => {
    const assetId = assetIds[0];
    const created = await asUser('ict_custodian', 'cust123456', () => request('POST', '/transfers', {
      inventory_item_id: assetId,
      to_department_id: deptId,
      to_location_id: locationId,
      reason: 'Phase 6 transfer test'
    }));
    const transferId = created.json.data?.id;
    if (!transferId) throw new Error('No transfer id');

    await asUser('pm_test', 'pm123456', async () => {
      const detail = (await request('GET', `/transfers/${transferId}`)).json.data;
      assertEq(detail.inventory_item_id, assetId, 'transfer inventory_item_id');
    });
  });

  await run('Maintenance create and history use inventory_item_id', async () => {
    const assetId = assetIds[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    const scheduled = tomorrow.toISOString().split('T')[0];

    const created = await asUser('ict_custodian', 'cust123456', () => request('POST', '/maintenance', {
      inventory_item_id: assetId,
      reported_problem: 'Phase 6 maintenance test',
      maintenance_type: 'Preventive',
      scheduled_date: scheduled
    }));
    const maintenanceId = created.json.data?.id;
    if (!maintenanceId) throw new Error('No maintenance id');

    const history = (await request('GET', `/maintenance/asset/${assetId}`)).json.data || [];
    if (!history.find((row) => row.id === maintenanceId)) {
      throw new Error('maintenance history should include created request by asset id');
    }
  });

  await run('Disposal create and history use inventory_item_id', async () => {
    const assetId = assetIds[0];
    const created = await asUser('ict_custodian', 'cust123456', () => request('POST', '/disposals', {
      inventory_item_id: assetId,
      reason: 'Phase 6 disposal test'
    }));
    const disposalId = created.json.data?.id;
    if (!disposalId) throw new Error('No disposal id');

    const history = (await request('GET', `/disposals/asset/${assetId}`)).json.data || [];
    if (!history.find((row) => row.id === disposalId)) {
      throw new Error('disposal history should include created request by asset id');
    }
  });

  await run('Approve borrow updates asset status via inventory_item_id chain', async () => {
    await asUser('pm_test', 'pm123456', () => request('PUT', `/borrow/${borrowId}/approve`));
    const item = await getItem(assetIds[0]);
    assertEq(item.status, 'Borrowed', 'status after approve');
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
