/**
 * Phase 4 API tests: per-asset borrow/disposal history + report exports.
 * Run: node test-phase4-api.js
 */
const BASE = 'http://localhost:3000/api';

let cookie = '';

async function request(method, path, body, expectBinary = false) {
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
  if (expectBinary) {
    if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
    const buf = await res.arrayBuffer();
    if (!buf.byteLength) throw new Error(`Empty export response for ${path}`);
    return { ok: true, size: buf.byteLength };
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status} ${path}`);
  return json;
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
  let propertyTag;

  await run('Create asset for history tests', async () => {
    const res = await request('POST', '/inventory', {
      item_name: `Phase4 Asset ${stamp}`,
      department_id: deptId,
      quantity: 1,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId,
      low_stock_threshold: 1
    });
    assetId = res.data?.created_ids?.[0];
    if (!assetId) throw new Error('No asset id returned');
    const created = (await request('GET', `/inventory/${assetId}`)).data;
    propertyTag = created.property_tag;
  });

  await run('Borrow history endpoint returns array', async () => {
    const res = await request('GET', `/borrow/asset/${assetId}/history`);
    if (!Array.isArray(res.data)) throw new Error('Expected array');
  });

  await run('Disposal history endpoint returns array', async () => {
    const res = await request('GET', `/disposals/asset/${assetId}`);
    if (!Array.isArray(res.data)) throw new Error('Expected array');
  });

  await run('Transfer report PDF export works', async () => {
    await request('GET', '/reports/export/pdf/transfers', null, true);
  });

  await run('Maintenance report Excel export works', async () => {
    await request('GET', '/reports/export/excel/maintenance', null, true);
  });

  await run('Asset status report PDF export works', async () => {
    await request('GET', `/reports/export/pdf/asset-status?property_tag=${encodeURIComponent(propertyTag)}`, null, true);
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
