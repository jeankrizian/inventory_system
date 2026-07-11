/**
 * Phase 4: removed quantity-based inventory fields from schema and API.
 * Run: node test-phase4-remove-fields-api.js
 */
const BASE = 'http://localhost:3000/api';

const REMOVED_FIELDS = [
  'quantity',
  'available_quantity',
  'unit',
  'low_stock_threshold',
  'acquisition_cost'
];

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

function assertNoRemovedFields(item, label) {
  for (const field of REMOVED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(item, field)) {
      throw new Error(`${label}: ${field} should not be in API response`);
    }
  }
}

async function login(username, password) {
  cookie = '';
  await request('POST', '/auth/login', { username, password });
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

  await run('Create ignores legacy quantity-based fields', async () => {
    const res = await request('POST', '/inventory', {
      item_name: `Phase4 ${stamp}`,
      department_id: deptId,
      asset_count: 1,
      quantity: 99,
      unit: 'boxes',
      low_stock_threshold: 5,
      acquisition_cost: 5000,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId,
      unit_cost: 1200
    });
    assetId = res.data?.created_ids?.[0];
    if (!assetId) throw new Error('No asset id');
    const item = (await request('GET', `/inventory/${assetId}`)).data;
    assertNoRemovedFields(item, 'create response');
    if (Number(item.unit_cost) !== 1200) {
      throw new Error(`expected unit_cost 1200, got ${item.unit_cost}`);
    }
  });

  await run('List and detail responses omit removed fields', async () => {
    const list = (await request('GET', `/inventory?search=Phase4 ${stamp}`)).data || [];
    if (!list.length) throw new Error('expected listed asset');
    list.forEach((row) => assertNoRemovedFields(row, 'list row'));
    const item = (await request('GET', `/inventory/${assetId}`)).data;
    assertNoRemovedFields(item, 'detail');
  });

  await run('Update ignores legacy quantity-based fields', async () => {
    await request('PUT', `/inventory/${assetId}`, {
      item_name: `Phase4 ${stamp} Updated`,
      unit: 'pcs',
      low_stock_threshold: 10,
      acquisition_cost: 9999
    });
    const item = (await request('GET', `/inventory/${assetId}`)).data;
    assertNoRemovedFields(item, 'after update');
    if (item.item_name !== `Phase4 ${stamp} Updated`) {
      throw new Error('item name should update');
    }
  });

  await run('Dashboard stats omit low_stock metric', async () => {
    const stats = (await request('GET', '/dashboard/stats')).data || {};
    if ('low_stock' in stats) {
      throw new Error('dashboard stats should not include low_stock');
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
