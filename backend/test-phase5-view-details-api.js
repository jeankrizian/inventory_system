/**
 * Phase 5: view details data (serial_number, asset histories).
 * Run: node test-phase5-view-details-api.js
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
  const serial = `SN-PH5-${stamp}`;
  let assetId;

  await run('Create asset exposes batch_id and serial_number fields', async () => {
    const res = await request('POST', '/inventory', {
      item_name: `Phase5 View ${stamp}`,
      department_id: deptId,
      asset_count: 1,
      serial_number: serial,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    });
    assetId = res.data?.created_ids?.[0];
    if (!assetId) throw new Error('No asset id');
    const item = (await request('GET', `/inventory/${assetId}`)).data;
    if (!item.batch_id) throw new Error('batch_id missing');
    if (!('serial_number' in item)) throw new Error('serial_number field missing from API');
    if (item.serial_number !== serial) throw new Error(`expected serial ${serial}, got ${item.serial_number}`);
  });

  await run('Update serial_number via API', async () => {
    const updatedSerial = `${serial}-EDIT`;
    await request('PUT', `/inventory/${assetId}`, {
      item_name: `Phase5 View ${stamp}`,
      department_id: deptId,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      serial_number: updatedSerial
    });
    const item = (await request('GET', `/inventory/${assetId}`)).data;
    if (item.serial_number !== updatedSerial) {
      throw new Error(`serial not updated: ${item.serial_number}`);
    }
  });

  await run('Asset history endpoints return arrays', async () => {
    const borrow = await request('GET', `/borrow/asset/${assetId}/history`);
    const transfer = await request('GET', `/transfers/asset/${assetId}/history`);
    const maintenance = await request('GET', `/maintenance/asset/${assetId}`);
    const disposal = await request('GET', `/disposals/asset/${assetId}`);
    if (!Array.isArray(borrow.data)) throw new Error('borrow history not array');
    if (!Array.isArray(transfer.data)) throw new Error('transfer history not array');
    if (!Array.isArray(maintenance.data)) throw new Error('maintenance history not array');
    if (!Array.isArray(disposal.data)) throw new Error('disposal history not array');
  });

  await run('Search finds asset by serial number', async () => {
    const list = (await request('GET', `/inventory?search=${encodeURIComponent(`${serial}-EDIT`)}`)).data || [];
    if (!list.find((row) => row.id === assetId)) {
      throw new Error('asset not found by serial search');
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
