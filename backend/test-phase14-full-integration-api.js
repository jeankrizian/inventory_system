/**
 * Phase 14: full integration checklist across property-based inventory system.
 * Run: node test-phase14-full-integration-api.js
 */
const BASE = 'http://localhost:3000/api';
const pool = require('./config/database');
const { verifyInventoryTransactionIntegrity } = require('./database/runLegacyDataMigration');
const { isAutoPropertyTagFormat } = require('./utils/propertyTagGenerator');
const { isValidBatchIdFormat } = require('./utils/batchIdGenerator');

const TAG_REGEX = /^\d{8}-\d{6}$/;

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
  return { res, json, ok: res.ok, status: res.status, data: json.data, message: json.message, success: json.success };
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

function reportRows(data) {
  if (Array.isArray(data)) return data;
  return data?.rows || [];
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

  await run('API health check', async () => {
    const { ok, success, message } = await request('GET', '/health');
    if (!ok || success !== true || !message) throw new Error('health check failed');
  });

  await run('Database transaction integrity', async () => {
    const issues = await verifyInventoryTransactionIntegrity();
    if (issues.length) {
      throw new Error(`${issues.length} orphaned transaction reference(s)`);
    }
  });

  await login('admin', 'admin123');
  const depts = (await request('GET', '/departments')).data || [];
  const deptId = depts.find((d) => /information technology|ict/i.test(d.name))?.id || depts[0]?.id;
  const users = (await request('GET', '/users')).data || [];
  const custodianId = users.find((u) => u.username === 'ict_custodian')?.id
    || users.find((u) => u.role === 'Custodian')?.id;

  const stamp = Date.now();
  let itemCode;
  let assetIds = [];
  let batchA;
  let batchB;

  await run('Property tags are unique system-wide', async () => {
    const [dupes] = await pool.query(
      `SELECT property_tag, COUNT(*) AS cnt
       FROM inventory_items
       WHERE is_archived = 0 AND property_tag IS NOT NULL AND TRIM(property_tag) != ''
       GROUP BY property_tag
       HAVING cnt > 1`
    );
    if (dupes.length) {
      throw new Error(`duplicate property tags found: ${dupes.map((d) => d.property_tag).join(', ')}`);
    }
  });

  await run('Bulk create assigns unique property tags and shared batch ID', async () => {
    const { data } = await request('POST', '/inventory', {
      item_name: `P14 Bulk ${stamp}`,
      department_id: deptId,
      asset_count: 3,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    });
    itemCode = data.item_code;
    assetIds = data.created_ids || [];
    batchA = data.batch_id;
    if (assetIds.length !== 3) throw new Error('expected 3 assets');
    if (!isValidBatchIdFormat(batchA)) throw new Error(`invalid batch: ${batchA}`);

    const items = await Promise.all(assetIds.map((id) => getItem(id)));
    const tags = items.map((i) => i.property_tag);
    if (new Set(tags).size !== tags.length) throw new Error('property tags must be unique');
    tags.forEach((tag) => {
      if (!TAG_REGEX.test(tag) && !isAutoPropertyTagFormat(tag)) {
        throw new Error(`unexpected tag format: ${tag}`);
      }
    });
    if (!items.every((i) => i.batch_id === batchA)) {
      throw new Error('bulk assets must share batch_id');
    }
  });

  await run('Separate bulk create gets a different batch ID', async () => {
    const { data } = await request('POST', '/inventory', {
      item_name: `P14 Bulk B ${stamp}`,
      department_id: deptId,
      asset_count: 1,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    });
    batchB = data.batch_id;
    if (!batchB || batchB === batchA) {
      throw new Error('separate bulk create should receive a new batch_id');
    }
  });

  await run('Status automation rejects manual status input', async () => {
    const { status, message } = await request('POST', '/inventory', {
      item_name: `P14 Status ${stamp}`,
      department_id: deptId,
      asset_count: 1,
      status: 'Borrowed',
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    }, true);
    if (status !== 400) throw new Error(`expected 400, got ${status}`);
    if (!/workflow-managed/i.test(message || '')) throw new Error(message);
  });

  await run('FIFO borrow preview selects oldest property tags', async () => {
    const items = await Promise.all(assetIds.map((id) => getItem(id)));
    const sortedTags = items.map((i) => i.property_tag).sort();
    const preview = (await request('POST', '/borrow/preview-allocation', {
      items: [{ item_code: itemCode, quantity: 2 }]
    })).data;
    const previewTags = preview.assets.map((a) => a.property_tag).sort();
    assertEq(previewTags.join(','), sortedTags.slice(0, 2).sort().join(','), 'FIFO tags');
    assertEq(preview.assignment_mode, 'fifo', 'assignment mode');
  });

  await run('Manual inventory_item_ids are ignored in favor of FIFO', async () => {
    const pick = assetIds[2];
    const preview = (await request('POST', '/borrow/preview-allocation', {
      items: [{ item_code: itemCode, quantity: 1, inventory_item_ids: [pick] }]
    })).data;
    assertEq(preview.assignment_mode, 'fifo', 'assignment mode');
    assertEq(preview.assets[0].inventory_item_id, assetIds[0], 'FIFO asset id');
  });

  let borrowId;
  await run('Borrow and return update asset status', async () => {
    const created = await asUser('ict_custodian', 'cust123456', () => request('POST', '/borrow', {
      purpose: `P14 integration ${stamp}`,
      borrow_date: new Date().toISOString().split('T')[0],
      expected_return_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      items: [{ item_code: itemCode, quantity: 1 }]
    }));
    borrowId = created.data?.id;
    if (!borrowId) throw new Error('borrow not created');

    await asUser('pm_test', 'pm123456', () => request('PUT', `/borrow/${borrowId}/approve`));
    assertEq((await getItem(assetIds[0])).status, 'Borrowed', 'borrowed status');

    await asUser('pm_test', 'pm123456', () => request('POST', `/borrow/${borrowId}/return`, {
      return_date: new Date().toISOString().split('T')[0],
      condition: 'Good'
    }));
    assertEq((await getItem(assetIds[0])).status, 'Available', 'returned status');
  });

  const locations = (await request('GET', '/locations')).data || [];
  const locationId = locations[0]?.id;

  await run('Transfer references correct inventory_item_id', async () => {
    const assetId = assetIds[1];
    const created = await asUser('ict_custodian', 'cust123456', () => request('POST', '/transfers', {
      inventory_item_id: assetId,
      to_department_id: deptId,
      to_location_id: locationId,
      reason: `P14 transfer ${stamp}`
    }));
    const transferId = created.data?.id;
    if (!transferId) throw new Error('transfer not created');
    await asUser('pm_test', 'pm123456', async () => {
      const detail = (await request('GET', `/transfers/${transferId}`)).data;
      assertEq(detail.inventory_item_id, assetId, 'transfer asset id');
    });
  });

  await run('Maintenance updates correct asset status', async () => {
    const assetId = assetIds[1];
    const created = await asUser('ict_custodian', 'cust123456', () => request('POST', '/maintenance', {
      inventory_item_id: assetId,
      reported_problem: `P14 maintenance ${stamp}`,
      maintenance_type: 'Corrective',
      scheduled_date: new Date().toISOString().split('T')[0]
    }));
    const maintenanceId = created.data?.id;
    if (!maintenanceId) throw new Error('maintenance not created');

    await asUser('pm_test', 'pm123456', () => request('PUT', `/maintenance/${maintenanceId}/approve`, {
      scheduled_date: new Date().toISOString().split('T')[0]
    }));
    assertEq((await getItem(assetId)).status, 'Under Maintenance', 'maintenance status');

    await asUser('pm_test', 'pm123456', () => request('PUT', `/maintenance/${maintenanceId}/complete`, {
      completed_date: new Date().toISOString().split('T')[0],
      condition: 'Good'
    }));
    const item = await getItem(assetId);
    if (item.status === 'Under Maintenance') {
      throw new Error('asset still under maintenance after complete');
    }
  });

  await run('Disposal updates correct asset to Disposed', async () => {
    const { data } = await request('POST', '/inventory', {
      item_name: `P14 Dispose ${stamp}`,
      department_id: deptId,
      asset_count: 1,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    });
    const assetId = data.created_ids?.[0] || data.id;

    const created = await asUser('ict_custodian', 'cust123456', () => request('POST', '/disposals', {
      inventory_item_id: assetId,
      reason: `P14 disposal ${stamp}`
    }));
    const disposalId = created.data?.id;
    if (!disposalId) throw new Error('disposal not created');

    await asUser('pm_test', 'pm123456', async () => {
      await request('PUT', `/disposals/${disposalId}/inspect`, { inspection_notes: 'OK' });
      await request('PUT', `/disposals/${disposalId}/approve`, {
        disposal_method: 'Destruction',
        disposal_date: new Date().toISOString().split('T')[0]
      });
    });
    assertEq((await getItem(assetId)).status, 'Disposed', 'disposed status');
  });

  await run('Reports and search work', async () => {
    const report = reportRows((await request('GET', `/reports/inventory?item_code=${encodeURIComponent(itemCode)}`)).data);
    if (!report.some((row) => row.item_code === itemCode)) {
      throw new Error('inventory report missing item_code filter result');
    }
    const search = (await request('GET', `/search?q=${encodeURIComponent(itemCode)}`)).data || {};
    if (!Array.isArray(search.inventory) || !search.inventory.length) {
      throw new Error('global search missing inventory results');
    }
  });

  await run('Notifications endpoint responds for roles', async () => {
    const adminNotes = (await request('GET', '/notifications')).data?.notifications;
    if (!Array.isArray(adminNotes)) throw new Error('admin notifications not array');
    await asUser('pm_test', 'pm123456', async () => {
      const pmNotes = (await request('GET', '/notifications')).data?.notifications;
      if (!Array.isArray(pmNotes)) throw new Error('PM notifications not array');
    });
  });

  await run('Dashboard returns property-based stats', async () => {
    const stats = (await request('GET', '/dashboard/stats')).data || {};
    if (!('total_items' in stats)) throw new Error('total_items missing from dashboard');
    if ('low_stock' in stats) throw new Error('low_stock should not be in dashboard stats');
    if ('quantity' in stats) throw new Error('quantity should not be in dashboard stats');
  });

  await run('RBAC scopes access by role', async () => {
    await asUser('ict_custodian', 'cust123456', async () => {
      const denied = await request('GET', '/users', null, true);
      if (denied.status !== 403) throw new Error(`custodian users access expected 403, got ${denied.status}`);
      const inventory = await request('GET', '/inventory');
      if (!inventory.ok) throw new Error('custodian should access inventory');
    });
    const adminUsers = await request('GET', '/users');
    if (!adminUsers.ok) throw new Error('admin should access users');
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\nPhase 14 integration: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;

  await pool.end().catch(() => {});
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => {});
  process.exitCode = 1;
});
