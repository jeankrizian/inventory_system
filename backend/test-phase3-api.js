/**
 * Phase 3 API tests: disposal status, maintenance status, report property_tag filter.
 * Run: node test-phase3-api.js
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

function reportRows(data) {
  if (Array.isArray(data)) return data;
  return data?.rows || [];
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
  let propertyTag;

  await run('Create individual asset for phase 3', async () => {
    const res = await request('POST', '/inventory', {
      item_name: `Phase3 Asset ${stamp}`,
      department_id: deptId,
      quantity: 1,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId,
      low_stock_threshold: 1
    });
    assetId = res.data?.created_ids?.[0];
    if (!assetId) throw new Error('No asset id returned');
    const item = await getItem(assetId);
    if (!/^\d{8}-\d{6}$/.test(item.property_tag)) {
      throw new Error(`expected auto property tag, got ${item.property_tag}`);
    }
    assertEq(item.status, 'Available', 'initial status');
    propertyTag = item.property_tag;
  });

  let maintenanceId;
  let disposalId;

  await run('Maintenance approve sets Under Maintenance', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const scheduled = tomorrow.toISOString().split('T')[0];

    const created = await asUser('ict_custodian', 'cust123456', () => request('POST', '/maintenance', {
      inventory_item_id: assetId,
      reported_problem: 'Test maintenance issue',
      maintenance_type: 'Corrective',
      scheduled_date: scheduled
    }));
    maintenanceId = created.data?.id;
    if (!maintenanceId) throw new Error('No maintenance id');

    await asUser('pm_test', 'pm123456', () => request('PUT', `/maintenance/${maintenanceId}/approve`, {
      admin_remarks: 'Approved for test'
    }));
    const item = await getItem(assetId);
    assertEq(item.status, 'Under Maintenance', 'status after maintenance approve');
  });

  await run('Maintenance complete clears Under Maintenance', async () => {
    await asUser('pm_test', 'pm123456', () => request('PUT', `/maintenance/${maintenanceId}/complete`, {
      completed_date: new Date().toISOString().split('T')[0],
      completion_remarks: 'Fixed'
    }));
    const item = await getItem(assetId);
    if (item.status === 'Under Maintenance') {
      throw new Error('status after maintenance complete: still Under Maintenance');
    }
    assertEq(item.maintenance_status, 'Completed', 'maintenance_status after complete');
  });

  await run('Disposal approve sets Disposed', async () => {
    const created = await asUser('ict_custodian', 'cust123456', () => request('POST', '/disposals', {
      inventory_item_id: assetId,
      quantity: 1,
      reason: 'End of life test disposal'
    }));
    disposalId = created.data?.id;
    if (!disposalId) throw new Error('No disposal id');

    await asUser('pm_test', 'pm123456', async () => {
      await request('PUT', `/disposals/${disposalId}/inspect`, { inspection_notes: 'Inspected for test' });
      await request('PUT', `/disposals/${disposalId}/approve`, {
        disposal_method: 'Destruction',
        disposal_date: new Date().toISOString().split('T')[0]
      });
    });
    const item = await getItem(assetId);
    assertEq(item.status, 'Disposed', 'status after disposal approve');
  });

  await run('Report filters by property_tag', async () => {
    const res = await request('GET', `/reports/inventory?property_tag=${encodeURIComponent(propertyTag)}`);
    const rows = reportRows(res.data);
    if (!rows.length) throw new Error('Expected at least one report row');
    const match = rows.find((r) => r.property_tag === propertyTag);
    if (!match) throw new Error(`No row with property_tag ${propertyTag}`);
    assertEq(match.status, 'Disposed', 'filtered row status');
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
