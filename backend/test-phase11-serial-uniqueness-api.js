/**
 * Phase 11: serial number uniqueness when provided.
 * Run: node test-phase11-serial-uniqueness-api.js
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
  if (!res.ok) {
    if (expectError) return { status: res.status, ...json };
    throw new Error(json.message || `HTTP ${res.status} ${path}`);
  }
  if (expectError) throw new Error(`Expected error for ${path}`);
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
  const dept = depts[0];
  const users = (await request('GET', '/users')).data || [];
  const custodianId = users.find((u) => u.username === 'ict_custodian')?.id
    || users.find((u) => u.role === 'Custodian')?.id;
  const stamp = Date.now();
  const serial = `SN-P11-${stamp}`;
  let assetA;
  let assetB;

  await run('Create asset with serial number', async () => {
    const res = await request('POST', '/inventory', {
      item_name: `Phase11 Serial A ${stamp}`,
      department_id: dept.id,
      asset_count: 1,
      serial_number: serial,
      custodian_id: custodianId,
      asset_classification: 'Non-Consumable (Fixed Asset)'
    });
    assetA = res.data?.created_ids?.[0] || res.data?.id;
    if (!assetA) throw new Error('asset A not created');
    if (res.data?.serial_number !== serial) {
      throw new Error(`expected serial ${serial}, got ${res.data?.serial_number}`);
    }
  });

  await run('Reject duplicate serial on create', async () => {
    const res = await request('POST', '/inventory', {
      item_name: `Phase11 Serial Dup ${stamp}`,
      department_id: dept.id,
      asset_count: 1,
      serial_number: serial,
      custodian_id: custodianId,
      asset_classification: 'Non-Consumable (Fixed Asset)'
    }, true);
    if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
    if (!/serial number already exists/i.test(res.message || '')) {
      throw new Error(`unexpected message: ${res.message}`);
    }
  });

  await run('Allow multiple assets without serial number', async () => {
    const resA = await request('POST', '/inventory', {
      item_name: `Phase11 No Serial A ${stamp}`,
      department_id: dept.id,
      asset_count: 1,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    });
    const resB = await request('POST', '/inventory', {
      item_name: `Phase11 No Serial B ${stamp}`,
      department_id: dept.id,
      asset_count: 1,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    });
    if (!resA.data?.id && !resA.data?.created_ids?.[0]) throw new Error('first null-serial asset failed');
    if (!resB.data?.id && !resB.data?.created_ids?.[0]) throw new Error('second null-serial asset failed');
  });

  await run('Reject duplicate serial on update', async () => {
    const created = await request('POST', '/inventory', {
      item_name: `Phase11 Serial B ${stamp}`,
      department_id: dept.id,
      asset_count: 1,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    });
    assetB = created.data?.created_ids?.[0] || created.data?.id;
    if (!assetB) throw new Error('asset B not created');

    const res = await request('PUT', `/inventory/${assetB}`, {
      serial_number: serial
    }, true);
    if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
    if (!/serial number already exists/i.test(res.message || '')) {
      throw new Error(`unexpected message: ${res.message}`);
    }
  });

  await run('Allow updating same asset with unchanged serial', async () => {
    const res = await request('PUT', `/inventory/${assetA}`, {
      serial_number: serial,
      item_name: `Phase11 Serial A Updated ${stamp}`
    });
    if (res.data?.serial_number !== serial) {
      throw new Error(`serial should remain ${serial}`);
    }
  });

  await run('Bulk create ignores serial when asset_count > 1', async () => {
    const bulkSerial = `SN-P11-BULK-${stamp}`;
    const res = await request('POST', '/inventory', {
      item_name: `Phase11 Bulk ${stamp}`,
      department_id: dept.id,
      asset_count: 2,
      serial_number: bulkSerial,
      custodian_id: custodianId,
      asset_classification: 'Non-Consumable (Fixed Asset)'
    });
    if (res.data?.created_count !== 2) throw new Error('expected 2 assets');
    const first = await request('GET', `/inventory/${res.data.created_ids[0]}`);
    const second = await request('GET', `/inventory/${res.data.created_ids[1]}`);
    if (first.data?.serial_number) throw new Error('bulk asset should not keep serial');
    if (second.data?.serial_number) throw new Error('bulk asset should not keep serial');

    await request('POST', '/inventory', {
      item_name: `Phase11 Bulk Dup ${stamp}`,
      department_id: dept.id,
      asset_count: 1,
      serial_number: bulkSerial,
      custodian_id: custodianId,
      asset_classification: 'Non-Consumable (Fixed Asset)'
    });
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
