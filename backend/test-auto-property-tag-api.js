/**
 * Phase 5: auto property tag generation (YYYYMMDD-000001).
 * Run: node test-auto-property-tag-api.js
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  let ids = [];

  await run('Bulk create assigns auto property tags', async () => {
    const res = await request('POST', '/inventory', {
      item_name: `Auto Tag Bulk ${stamp}`,
      department_id: deptId,
      quantity: 3,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId,
      low_stock_threshold: 1
    });
    ids = res.data?.created_ids || [];
    assert(ids.length === 3, 'expected 3 assets');

    const items = await Promise.all(ids.map((id) => request('GET', `/inventory/${id}`)));
    const tags = items.map((r) => r.data.property_tag).sort();
    tags.forEach((tag) => {
      assert(/^\d{8}-\d{6}$/.test(tag), `invalid auto tag format: ${tag}`);
    });
    assert(tags[0] !== tags[1] && tags[1] !== tags[2], 'tags must be unique');
    const seq = tags.map((t) => parseInt(t.split('-')[1], 10));
    assert(seq[1] === seq[0] + 1 && seq[2] === seq[1] + 1, 'tags must be sequential');
  });

  await run('Create without manual property tag succeeds', async () => {
    const res = await request('POST', '/inventory', {
      item_name: `Auto Tag Single ${stamp}`,
      department_id: deptId,
      quantity: 1,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    });
    const id = res.data?.created_ids?.[0] || res.data?.id;
    const item = (await request('GET', `/inventory/${id}`)).data;
    assert(/^\d{8}-\d{6}$/.test(item.property_tag), 'single asset auto tag');
  });

  await run('Edit cannot change property tag via API', async () => {
    const id = ids[0];
    const before = (await request('GET', `/inventory/${id}`)).data.property_tag;
    await request('PUT', `/inventory/${id}`, {
      item_name: `Auto Tag Bulk ${stamp} Updated`,
      property_tag: '99999999-999999'
    });
    const after = (await request('GET', `/inventory/${id}`)).data.property_tag;
    assert(after === before, 'property tag must remain unchanged on edit');
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
