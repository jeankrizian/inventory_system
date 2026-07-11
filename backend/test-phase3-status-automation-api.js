/**
 * Phase 3: workflow-driven status only (no manual status on create/update).
 * Run: node test-phase3-status-automation-api.js
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

  const stamp = Date.now();
  let assetIds = [];

  await run('New assets always start as Available', async () => {
    const { json } = await request('POST', '/inventory', {
      item_name: `Status Auto ${stamp}`,
      department_id: deptId,
      quantity: 2,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    });
    assetIds = json.data?.created_ids || [];
    assertEq(assetIds.length, 2, 'created count');
    for (const id of assetIds) {
      const item = await getItem(id);
      assertEq(item.status, 'Available', `asset ${id} status`);
    }
  });

  await run('Manual status on create is rejected', async () => {
    const { res, json } = await request('POST', '/inventory', {
      item_name: `Reject Status ${stamp}`,
      department_id: deptId,
      quantity: 1,
      status: 'Disposed',
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    }, true);
    if (res.status !== 400) {
      throw new Error(`expected 400, got ${res.status}`);
    }
    if (!/workflow-managed/i.test(json.message || '')) {
      throw new Error(`unexpected message: ${json.message}`);
    }
  });

  let borrowId;
  const borrowAssetId = assetIds[0];

  await run('Borrow workflow sets Borrowed', async () => {
    const item = await getItem(borrowAssetId);

    const created = await asUser('ict_custodian', 'cust123456', () => request('POST', '/borrow', {
      purpose: 'Phase 3 status test',
      borrow_date: new Date().toISOString().split('T')[0],
      expected_return_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      items: [{ item_code: item.item_code, quantity: 1 }]
    }));
    borrowId = created.json.data?.id;
    if (!borrowId) throw new Error('No borrow id');

    await asUser('pm_test', 'pm123456', () => request('PUT', `/borrow/${borrowId}/approve`));
    const borrowed = await getItem(borrowAssetId);
    assertEq(borrowed.status, 'Borrowed', 'status after borrow approve');
  });

  await run('Manual status on update is rejected', async () => {
    const { res, json } = await request('PUT', `/inventory/${borrowAssetId}`, {
      item_name: `Status Auto ${stamp}`,
      status: 'Available'
    }, true);
    if (res.status !== 400) {
      throw new Error(`expected 400, got ${res.status}`);
    }
    if (!/workflow-managed/i.test(json.message || '')) {
      throw new Error(`unexpected message: ${json.message}`);
    }
    const item = await getItem(borrowAssetId);
    assertEq(item.status, 'Borrowed', 'borrowed status preserved');
  });

  await run('Return workflow sets Available', async () => {
    await asUser('pm_test', 'pm123456', () => request('POST', `/borrow/${borrowId}/return`, {
      return_date: new Date().toISOString().split('T')[0],
      condition: 'Good'
    }));
    const item = await getItem(borrowAssetId);
    assertEq(item.status, 'Available', 'status after return');
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
