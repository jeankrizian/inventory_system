/**
 * Phase 9: global and inventory search across asset identifiers and locations.
 * Run: node test-phase9-search-api.js
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

async function login(username, password) {
  cookie = '';
  await request('POST', '/auth/login', { username, password });
}

function includesAsset(rows, assetId) {
  return (rows || []).some((row) => row.id === assetId);
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
  const ictDept = depts.find((d) => /information technology|ict/i.test(d.name)) || depts[0];
  const locations = (await request('GET', '/locations')).data || [];
  const location = locations[0];
  const users = (await request('GET', '/users')).data || [];
  const custodianId = users.find((u) => u.username === 'ict_custodian')?.id
    || users.find((u) => u.role === 'Custodian')?.id;

  const stamp = Date.now();
  const serial = `SN-P9-${stamp}`;
  let assetId;
  let propertyTag;
  let batchId;
  let itemCode;

  await run('Create searchable asset', async () => {
    const res = await request('POST', '/inventory', {
      item_name: `Phase9 Search ${stamp}`,
      department_id: ictDept.id,
      location_id: location?.id,
      asset_count: 1,
      serial_number: serial,
      brand: `BrandP9${stamp}`,
      model: `ModelP9${stamp}`,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    });
    assetId = res.data?.created_ids?.[0] || res.data?.id;
    propertyTag = res.data?.property_tag;
    batchId = res.data?.batch_id;
    itemCode = res.data?.item_code;
    if (!assetId) throw new Error('No asset id');
  });

  const searchCases = [
    ['property tag', propertyTag],
    ['batch ID', batchId],
    ['item code', itemCode],
    ['item name', `Phase9 Search ${stamp}`],
    ['brand', `BrandP9${stamp}`],
    ['model', `ModelP9${stamp}`],
    ['serial number', serial],
    ['department', ictDept.name],
    ['location', location?.name]
  ].filter(([, value]) => value);

  for (const [label, term] of searchCases) {
    await run(`Inventory list search by ${label}`, async () => {
      const rows = (await request('GET', `/inventory?search=${encodeURIComponent(term)}`)).data || [];
      if (!includesAsset(rows, assetId)) {
        throw new Error(`asset not found when searching by ${label}: ${term}`);
      }
    });

    await run(`Global search by ${label}`, async () => {
      const rows = (await request('GET', `/search?q=${encodeURIComponent(term)}`)).data?.inventory || [];
      if (!includesAsset(rows, assetId)) {
        throw new Error(`asset not found in global search by ${label}: ${term}`);
      }
    });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
