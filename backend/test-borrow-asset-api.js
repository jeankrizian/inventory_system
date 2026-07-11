/**
 * Phase 2 borrow/return API tests (status-based individual assets).
 * Run: node test-borrow-asset-api.js
 */
const BASE = 'http://localhost:3000/api';

let cookie = '';

async function request(method, path, body) {
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
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status} ${path}`);
  return json;
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
  let itemCode;
  let assetIds = [];
  let assetTags = [];
  let borrowId;

  await run('Bulk create assets for borrow test', async () => {
    const res = await request('POST', '/inventory', {
      item_name: `Borrow FIFO ${stamp}`,
      department_id: deptId,
      asset_count: 3,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    });
    itemCode = res.data.item_code;
    assetIds = res.data.created_ids || [];
    assertEq(assetIds.length, 3, 'created assets');
    const items = await Promise.all(assetIds.map((id) => request('GET', `/inventory/${id}`)));
    assetTags = items.map((r) => r.data.property_tag).sort((a, b) => {
      const sa = parseInt(a.split('-')[1], 10);
      const sb = parseInt(b.split('-')[1], 10);
      return sa - sb;
    });
  });

  await run('Borrow catalog groups by model with available count', async () => {
    const models = (await request('GET', '/borrow/borrowable-items')).data || [];
    const model = models.find((m) => m.item_code === itemCode);
    if (!model) throw new Error('Model not found in borrow catalog');
    assertEq(model.available_count, 3, 'available count');
  });

  await run('FIFO preview selects oldest property tags', async () => {
    const preview = (await request('POST', '/borrow/preview-allocation', {
      items: [{ item_code: itemCode, quantity: 2 }]
    })).data;
    const tags = preview.assets.map((a) => a.property_tag);
    assertEq(tags[0], assetTags[0], 'first tag');
    assertEq(tags[1], assetTags[1], 'second tag');
  });

  await run('Approve borrow sets status Borrowed (not quantity-based)', async () => {
    const borrowRes = await request('POST', '/borrow', {
      borrower_department: 'Test',
      purpose: 'Phase 2 borrow status test',
      borrow_date: new Date().toISOString().split('T')[0],
      expected_return_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      items: [{ item_code: itemCode, quantity: 1, inventory_item_ids: [assetIds[0]] }]
    });
    borrowId = borrowRes.data.id;
    await asUser('pm_test', 'pm123456', () => request('PUT', `/borrow/${borrowId}/approve`));

    const asset = (await request('GET', `/inventory/${assetIds[0]}`)).data;
    assertEq(asset.status, 'Borrowed', 'status');
  });

  await run('Return sets status back to Available', async () => {
    await asUser('pm_test', 'pm123456', () => request('POST', `/borrow/${borrowId}/return`, {
      return_date: new Date().toISOString().split('T')[0],
      condition: 'Good'
    }));
    const asset = (await request('GET', `/inventory/${assetIds[0]}`)).data;
    assertEq(asset.status, 'Available', 'status after return');
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} borrow asset API tests passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
