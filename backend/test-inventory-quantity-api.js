/**
 * API integration tests for automatic available quantity (individual asset model).
 * Run: node test-inventory-quantity-api.js
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
  if (!res.ok) {
    const err = new Error(json.message || `HTTP ${res.status} ${path}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

function assertEq(actual, expected, label) {
  const a = Number.isFinite(Number(actual)) && String(actual).trim() !== '' ? Number(actual) : actual;
  const e = Number.isFinite(Number(expected)) && String(expected).trim() !== '' ? Number(expected) : expected;
  if (a !== e) {
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
  let itemId;
  let borrowId;

  const fixedAssetPayload = (name, tag, qty = 1) => ({
    item_name: name,
    department_id: deptId,
    quantity: qty,
    starting_property_tag: tag,
    property_tag: tag,
    low_stock_threshold: 5,
    asset_classification: 'Non-Consumable (Fixed Asset)',
    custodian_id: custodianId
  });

  await run('Each new asset row has quantity=1 and available=1', async () => {
    const tag = `QTY-${stamp}-0001`;
    const res = await request('POST', '/inventory', fixedAssetPayload(`Qty Asset ${stamp}`, tag, 1));
    itemId = res.data?.id || res.data?.created_ids?.[0];
    const item = await getItem(itemId);
    assertEq(item.quantity, 1, 'quantity');
    assertEq(item.available_quantity, 1, 'available');
    assertEq(item.status, 'Available', 'status');
  });

  await run('Borrow decreases available on individual asset', async () => {
    const borrowRes = await request('POST', '/borrow', {
      borrower_department: 'Test',
      purpose: 'Individual asset borrow',
      borrow_date: new Date().toISOString().split('T')[0],
      expected_return_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      items: [{ item_code: (await getItem(itemId)).item_code, quantity: 1, inventory_item_ids: [itemId] }]
    });
    borrowId = borrowRes.data.id;
    await asUser('pm_test', 'pm123456', () => request('PUT', `/borrow/${borrowId}/approve`));
    const item = await getItem(itemId);
    assertEq(item.status, 'Borrowed', 'status after borrow');
    assertEq(item.available_quantity, 0, 'available after borrow');
  });

  await run('Return increases available (capped at quantity 1)', async () => {
    await asUser('pm_test', 'pm123456', () => request('POST', `/borrow/${borrowId}/return`, {
      return_date: new Date().toISOString().split('T')[0],
      condition: 'Good'
    }));
    const item = await getItem(itemId);
    assertEq(item.status, 'Available', 'status after return');
    assertEq(item.available_quantity, 1, 'available after return');
    assertEq(item.quantity, 1, 'quantity unchanged');
  });

  await run('Edit cannot change per-asset quantity', async () => {
    const item = await getItem(itemId);
    await request('PUT', `/inventory/${itemId}`, { ...item, quantity: 25, available_quantity: 10 });
    const updated = await getItem(itemId);
    assertEq(updated.quantity, 1, 'quantity locked');
    assertEq(updated.available_quantity, 1, 'available preserved');
  });

  await run('Dashboard stats still load', async () => {
    const stats = await request('GET', '/dashboard/stats');
    if (!stats.data) throw new Error('Dashboard stats missing');
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} API quantity scenarios passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
