/**
 * Phase 7: borrow by model with FIFO bulk allocation and manual pick (qty <= 10).
 * Run: node test-phase7-borrow-improvements-api.js
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

function sortTags(tags) {
  return [...tags].sort((a, b) => {
    const pa = parseInt(a.split('-')[1], 10);
    const pb = parseInt(b.split('-')[1], 10);
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
  const deptId = depts.find((d) => /information technology|ict/i.test(d.name))?.id || depts[0]?.id;
  const users = (await request('GET', '/users')).json.data || [];
  const custodianId = users.find((u) => u.username === 'ict_custodian')?.id
    || users.find((u) => u.role === 'Custodian')?.id;

  const stamp = Date.now();
  let itemCode;
  let assetIds = [];
  let assetTags = [];

  await run('Create model with 15 available assets', async () => {
    const { json } = await request('POST', '/inventory', {
      item_name: `Phase7 Bulk ${stamp}`,
      department_id: deptId,
      asset_count: 15,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    });
    itemCode = json.data.item_code;
    assetIds = json.data.created_ids || [];
    assertEq(assetIds.length, 15, 'created assets');
    const items = await Promise.all(assetIds.map((id) => getItem(id)));
    assetTags = sortTags(items.map((item) => item.property_tag));
  });

  await run('Borrow catalog shows model with available count', async () => {
    const models = (await request('GET', '/borrow/borrowable-items')).json.data || [];
    const model = models.find((m) => m.item_code === itemCode);
    if (!model) throw new Error('model missing from borrow catalog');
    assertEq(model.available_count, 15, 'available_count');
  });

  await run('FIFO preview selects 12 oldest assets by property tag', async () => {
    const preview = (await request('POST', '/borrow/preview-allocation', {
      items: [{ item_code: itemCode, quantity: 12 }]
    })).json.data;

    assertEq(preview.total_assets, 12, 'preview total');
    assertEq(preview.assignment_mode, 'fifo', 'assignment mode');
    const previewTags = sortTags(preview.assets.map((a) => a.property_tag));
    const expected = assetTags.slice(0, 12);
    assertEq(previewTags.join(','), expected.join(','), 'FIFO tag order');
  });

  await run('Manual selection is ignored when advanced selection is disabled', async () => {
    const picks = assetIds.slice(10, 13);
    const preview = (await request('POST', '/borrow/preview-allocation', {
      items: [{ item_code: itemCode, quantity: 3, inventory_item_ids: picks }]
    })).json.data;
    assertEq(preview.assignment_mode, 'fifo', 'assignment mode');
    const ids = preview.assets.map((a) => a.inventory_item_id).sort((a, b) => a - b);
    const expected = assetIds.slice(0, 3).sort((a, b) => a - b);
    assertEq(ids.join(','), expected.join(','), 'FIFO ids used');
  });

  await run('FIFO allocation works for quantity over 10 without manual selection', async () => {
    const preview = (await request('POST', '/borrow/preview-allocation', {
      items: [{ item_code: itemCode, quantity: 11, inventory_item_ids: assetIds.slice(0, 11) }]
    })).json.data;
    assertEq(preview.assignment_mode, 'fifo', 'assignment mode');
    assertEq(preview.total_assets, 11, 'preview total');
  });

  await run('Insufficient available assets returns clear error', async () => {
    const targetId = assetIds[14];
    const item = await getItem(targetId);
    await request('PUT', `/inventory/${targetId}`, {
      item_name: item.item_name,
      department_id: item.department_id,
      asset_classification: item.asset_classification,
      acquisition_date: '2019-01-01',
      custodian_id: custodianId
    });

    const preview = (await request('POST', '/borrow/preview-allocation', {
      items: [{ item_code: itemCode, quantity: 1 }]
    })).json.data;
    assertEq(preview.assets[0].inventory_item_id, targetId, 'oldest acquisition date first');
  });

  await run('Insufficient available assets returns clear error', async () => {
    const { res, json } = await request('POST', '/borrow/preview-allocation', {
      items: [{ item_code: itemCode, quantity: 50 }]
    }, true);
    if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
    if (!/insufficient available assets/i.test(json.message || '')) {
      throw new Error(`unexpected message: ${json.message}`);
    }
  });

  let borrowId;
  await run('Bulk borrow request stores per-asset lines', async () => {
    const created = await asUser('ict_custodian', 'cust123456', () => request('POST', '/borrow', {
      purpose: 'Phase 7 bulk FIFO borrow',
      borrow_date: new Date().toISOString().split('T')[0],
      expected_return_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      items: [{ item_code: itemCode, quantity: 5 }]
    }));
    borrowId = created.json.data?.id;
    if (!borrowId) throw new Error('No borrow id');

    const detail = created.json.data;
    assertEq((detail.items || []).length, 5, 'borrow line count');
    assertEq(detail.show_assigned_assets, false, 'tags hidden while pending');
    for (const line of detail.items || []) {
      if (!line.inventory_item_id) throw new Error('borrow line missing inventory_item_id');
      if (line.property_tag) throw new Error('property_tag should be hidden while pending');
    }
  });

  await run('Approve bulk borrow marks assets Borrowed', async () => {
    await asUser('pm_test', 'pm123456', () => request('PUT', `/borrow/${borrowId}/approve`));
    const detail = (await request('GET', `/borrow/${borrowId}`)).json.data;
    for (const line of detail.items || []) {
      if (!line.property_tag) throw new Error('property_tag should appear after approval');
      const item = await getItem(line.inventory_item_id);
      assertEq(item.status, 'Borrowed', `asset ${line.inventory_item_id} status`);
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
