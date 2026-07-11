/**
 * Borrow UX: auto department, FIFO-only submit, property tags hidden until approved.
 * Run: node test-borrow-ux-api.js
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

function sortTags(tags) {
  return [...tags].sort((a, b) => {
    const pa = parseInt(String(a).split('-')[1], 10);
    const pb = parseInt(String(b).split('-')[1], 10);
    return pa - pb;
  });
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
  const ictDept = depts.find((d) => /information technology|ict/i.test(d.name));
  const users = (await request('GET', '/users')).json.data || [];
  const custodian = users.find((u) => u.username === 'ict_custodian');
  const custodianId = custodian?.id;

  const stamp = Date.now();
  let itemCode;
  let assetIds = [];
  let assetTags = [];
  let borrowId;

  await run('Setup borrowable model with 5 assets', async () => {
    const { json } = await request('POST', '/inventory', {
      item_name: `Borrow UX ${stamp}`,
      department_id: ictDept?.id || depts[0]?.id,
      asset_count: 5,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    });
    itemCode = json.data.item_code;
    assetIds = json.data.created_ids || [];
    const items = await Promise.all(assetIds.map((id) => request('GET', `/inventory/${id}`).then((r) => r.json.data)));
    assetTags = sortTags(items.map((item) => item.property_tag));
  });

  await run('Create borrow without department uses authenticated user context', async () => {
    const created = await asUser('ict_custodian', 'cust123456', () => request('POST', '/borrow', {
      purpose: 'Borrow UX auto department test',
      borrow_date: new Date().toISOString().split('T')[0],
      expected_return_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      items: [{ item_code: itemCode, quantity: 2 }]
    }));

    borrowId = created.json.data?.id;
    if (!borrowId) throw new Error('No borrow id returned');

    const detail = created.json.data;
    assertEq(detail.borrower_id, custodian.id, 'borrower_id');
    assertEq(detail.requested_by, custodian.id, 'requested_by');
    if (ictDept?.id) {
      assertEq(detail.borrower_department_id, ictDept.id, 'borrower_department_id');
    }
    if (!detail.borrower_department) throw new Error('borrower_department missing');
  });

  await run('Pending borrow hides property tags from client', async () => {
    const detail = (await asUser('ict_custodian', 'cust123456', () => request('GET', `/borrow/${borrowId}`))).json.data;
    assertEq(detail.status, 'Pending', 'status');
    assertEq(detail.show_assigned_assets, false, 'show_assigned_assets');
    for (const line of detail.items || []) {
      if (line.property_tag) throw new Error('property_tag should be hidden while pending');
      if (!line.inventory_item_id) throw new Error('inventory_item_id should still be stored');
    }
  });

  await run('Manual inventory_item_ids are ignored (FIFO only)', async () => {
    const manualPicks = assetIds.slice(3, 5);
    const preview = (await request('POST', '/borrow/preview-allocation', {
      items: [{ item_code: itemCode, quantity: 2, inventory_item_ids: manualPicks }]
    })).json.data;
    assertEq(preview.assignment_mode, 'fifo', 'assignment mode');
    const previewIds = preview.assets.map((a) => a.inventory_item_id).sort((a, b) => a - b);
    const expectedFifo = assetIds.slice(0, 2).sort((a, b) => a - b);
    assertEq(previewIds.join(','), expectedFifo.join(','), 'FIFO ids used instead of manual picks');
  });

  await run('Approved borrow shows assigned property tags', async () => {
    await asUser('pm_test', 'pm123456', () => request('PUT', `/borrow/${borrowId}/approve`));
    const detail = (await asUser('ict_custodian', 'cust123456', () => request('GET', `/borrow/${borrowId}`))).json.data;
    assertEq(detail.show_assigned_assets, true, 'show_assigned_assets');
    const tags = sortTags((detail.items || []).map((line) => line.property_tag).filter(Boolean));
    const expected = assetTags.slice(0, 2);
    assertEq(tags.join(','), expected.join(','), 'assigned property tags');
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
