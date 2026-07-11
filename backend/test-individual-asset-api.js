/**
 * API tests for individual asset records (Phase 1).
 * Run: node test-individual-asset-api.js
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
    throw new Error(json.message || `HTTP ${res.status} ${path}`);
  }
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
  let sharedItemCode = null;
  const createdIds = [];

  await run('Bulk create makes one row per asset with shared item code', async () => {
    const codeRes = await request('GET', `/inventory/next-code?department_id=${deptId}`);
    const res = await request('POST', '/inventory', {
      item_code: codeRes.data?.item_code,
      item_name: `Desktop Batch ${stamp}`,
      department_id: deptId,
      quantity: 3,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId,
      condition: 'Good',
      low_stock_threshold: 1
    });

    assertEq(res.data.created_count, 3, 'created_count');
    sharedItemCode = res.data.item_code;
    createdIds.push(...(res.data.created_ids || []));

    const listed = (await request('GET', `/inventory?search=Desktop Batch ${stamp}`)).data || [];
    assertEq(listed.length, 3, 'listed rows');
    listed.forEach((row) => {
      assertEq(row.item_code, sharedItemCode, 'shared model code');
      const removed = ['quantity', 'available_quantity', 'unit', 'low_stock_threshold', 'acquisition_cost'];
      removed.forEach((field) => {
        if (field in row) throw new Error(`${field} should not be in API response`);
      });
    });

    const tags = listed.map((r) => r.property_tag).sort();
    tags.forEach((tag) => {
      if (!/^\d{8}-\d{6}$/.test(tag)) throw new Error(`expected auto tag format, got ${tag}`);
    });
    const seq = tags.map((t) => parseInt(t.split('-')[1], 10));
    if (seq[1] !== seq[0] + 1 || seq[2] !== seq[1] + 1) {
      throw new Error('property tags should be sequential');
    }
  });

  await run('Property tags are unique across created assets', async () => {
    const listed = (await request('GET', `/inventory?search=Desktop Batch ${stamp}`)).data || [];
    const tags = listed.map((r) => r.property_tag);
    assertEq(new Set(tags).size, tags.length, 'unique tags');
  });

  await run('Edit does not change per-asset identity', async () => {
    const id = createdIds[0];
    const item = (await request('GET', `/inventory/${id}`)).data;
    await request('PUT', `/inventory/${id}`, {
      item_name: `Desktop Batch ${stamp} Updated`,
      department_id: item.department_id,
      asset_classification: item.asset_classification
    });
    const updated = (await request('GET', `/inventory/${id}`)).data;
    assertEq(updated.item_name, `Desktop Batch ${stamp} Updated`, 'name updated');
    assertEq(updated.property_tag, item.property_tag, 'property tag unchanged');
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} individual asset API tests passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
