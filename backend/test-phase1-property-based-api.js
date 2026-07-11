/**
 * Phase 1 property-based inventory API tests.
 * Run: node test-phase1-property-based-api.js
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
  let assetIds = [];
  let itemCode;

  await run('API omits quantity fields from inventory responses', async () => {
    const res = await request('POST', '/inventory', {
      item_name: `Phase1 ${stamp}`,
      department_id: deptId,
      quantity: 2,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    });
    assetIds = res.data?.created_ids || [];
    itemCode = res.data?.item_code;
    const item = (await request('GET', `/inventory/${assetIds[0]}`)).data;
    if ('quantity' in item) throw new Error('quantity should not be in API response');
    if ('available_quantity' in item) throw new Error('available_quantity should not be in API response');
    if ('unit' in item) throw new Error('unit should not be in API response');
    if ('low_stock_threshold' in item) throw new Error('low_stock_threshold should not be in API response');
    if ('acquisition_cost' in item) throw new Error('acquisition_cost should not be in API response');
    assertEq(item.status, 'Available', 'new asset status');
    if (!item.property_tag) throw new Error('property_tag required');
  });

  await run('Borrow catalog uses available_count by status', async () => {
    const models = (await request('GET', '/borrow/borrowable-items')).data || [];
    const model = models.find((m) => m.item_code === itemCode);
    if (!model) throw new Error('model not in borrow catalog');
    assertEq(model.available_count, 2, 'available_count');
    if ('available_quantity' in model && model.available_quantity != null) {
      throw new Error('borrow catalog should not expose available_quantity');
    }
  });

  await run('Borrow/return driven by status only', async () => {
    const borrowRes = await request('POST', '/borrow', {
      borrower_department: 'Test',
      purpose: 'Phase 1 status test',
      borrow_date: new Date().toISOString().split('T')[0],
      expected_return_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      items: [{ item_code: itemCode, quantity: 1 }]
    });
    const borrowId = borrowRes.data.id;
    await asUser('pm_test', 'pm123456', () => request('PUT', `/borrow/${borrowId}/approve`));
    const borrowed = (await request('GET', `/inventory/${assetIds[0]}`)).data;
    assertEq(borrowed.status, 'Borrowed', 'borrowed status');

    await asUser('pm_test', 'pm123456', () => request('POST', `/borrow/${borrowId}/return`, {
      return_date: new Date().toISOString().split('T')[0],
      condition: 'Good'
    }));
    const returned = (await request('GET', `/inventory/${assetIds[0]}`)).data;
    assertEq(returned.status, 'Available', 'returned status');
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
