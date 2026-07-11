/**
 * Phase 10: report filters and filtered exports.
 * Run: node test-phase10-reports-api.js
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

async function requestBinary(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: cookie ? { Cookie: cookie } : {}
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.message || `HTTP ${res.status} ${path}`);
  }
  const buf = await res.arrayBuffer();
  return {
    size: buf.byteLength,
    contentType: res.headers.get('content-type') || ''
  };
}

function qs(params) {
  const parts = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

async function login(username, password) {
  cookie = '';
  await request('POST', '/auth/login', { username, password });
}

function includesAsset(rows, assetId) {
  return (rows || []).some((row) => row.id === assetId);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function reportRows(data) {
  if (Array.isArray(data)) return data;
  return data?.rows || [];
}

function reportSummary(data) {
  if (Array.isArray(data)) return null;
  return data?.summary || null;
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
  const engDept = depts.find((d) => /engineering|eng/i.test(d.name) && d.id !== ictDept?.id) || depts[1];
  const users = (await request('GET', '/users')).data || [];
  const ictCustodianId = users.find((u) => u.username === 'ict_custodian')?.id;
  const engCustodianId = users.find((u) => u.username === 'eng_custodian')?.id;

  const stamp = Date.now();
  let assetA;
  let assetB;
  let batchA;
  let batchB;
  let tagA;
  let tagB;

  await run('Create assets for report filter tests', async () => {
    const resA = await request('POST', '/inventory', {
      item_name: `Phase10 Report A ${stamp}`,
      department_id: ictDept.id,
      asset_count: 1,
      material: 'Metal',
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: ictCustodianId
    });
    assetA = resA.data?.created_ids?.[0];
    batchA = resA.data?.batch_id;
    tagA = resA.data?.property_tag;
    if (!assetA || !batchA || !tagA) throw new Error('Asset A not created');

    const resB = await request('POST', '/inventory', {
      item_name: `Phase10 Report B ${stamp}`,
      department_id: engDept?.id || ictDept.id,
      asset_count: 1,
      material: 'Plastic',
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: engCustodianId || ictCustodianId
    });
    assetB = resB.data?.created_ids?.[0];
    batchB = resB.data?.batch_id;
    tagB = resB.data?.property_tag;
    if (!assetB || !batchB || !tagB) throw new Error('Asset B not created');
  });

  await run('Filter options include custodians and workflow statuses', async () => {
    const data = (await request('GET', '/reports/filter-options')).data || {};
    if (!Array.isArray(data.custodians) || !data.custodians.length) {
      throw new Error('custodians missing from filter options');
    }
    const statuses = data.statuses || [];
    if (statuses.includes('Low Stock') || statuses.includes('Out of Stock')) {
      throw new Error('legacy statuses still listed');
    }
    const required = ['Available', 'Borrowed', 'Under Maintenance', 'Disposed'];
    for (const status of required) {
      if (!statuses.includes(status)) throw new Error(`missing status ${status}`);
    }
  });

  await run('Inventory report filters by property tag', async () => {
    const rows = reportRows((await request('GET', `/reports/inventory${qs({ property_tag: tagA })}`)).data);
    if (!includesAsset(rows, assetA)) throw new Error('asset A not in filtered results');
    if (includesAsset(rows, assetB)) throw new Error('asset B should be excluded');
  });

  await run('Inventory report filters by batch ID', async () => {
    const rows = reportRows((await request('GET', `/reports/inventory${qs({ batch_id: batchB })}`)).data);
    if (!includesAsset(rows, assetB)) throw new Error('asset B not in filtered results');
    if (includesAsset(rows, assetA)) throw new Error('asset A should be excluded');
  });

  await run('Inventory report filters by department', async () => {
    const rows = reportRows((await request('GET', `/reports/inventory${qs({ department_id: ictDept.id })}`)).data);
    if (!includesAsset(rows, assetA)) throw new Error('asset A not in ICT department filter');
  });

  await run('Inventory report filters by custodian', async () => {
    if (!ictCustodianId) throw new Error('ict custodian not found');
    const rows = reportRows((await request('GET', `/reports/inventory${qs({ custodian_id: ictCustodianId })}`)).data);
    if (!includesAsset(rows, assetA)) throw new Error('asset A not in custodian filter');
  });

  await run('Inventory report filters by material', async () => {
    const rows = reportRows((await request('GET', `/reports/inventory${qs({ material: 'Plastic' })}`)).data);
    if (!includesAsset(rows, assetB)) throw new Error('asset B (Plastic) not found');
    if (includesAsset(rows, assetA)) throw new Error('asset A (Metal) should be excluded');
  });

  await run('Inventory report filters by date range (today)', async () => {
    const today = todayIso();
    const rows = reportRows((await request('GET', `/reports/inventory${qs({ date_from: today, date_to: today })}`)).data);
    if (!includesAsset(rows, assetA) || !includesAsset(rows, assetB)) {
      throw new Error('new assets should appear in today date range');
    }
  });

  await run('Asset status report respects inventory filters', async () => {
    const rows = reportRows((await request('GET', `/reports/asset-status${qs({ batch_id: batchA })}`)).data);
    if (!includesAsset(rows, assetA)) throw new Error('asset A not in asset-status filter');
    if (includesAsset(rows, assetB)) throw new Error('asset B should be excluded');
  });

  await run('Custodian report filters by custodian_id', async () => {
    if (!ictCustodianId) throw new Error('ict custodian not found');
    const rows = reportRows((await request('GET', `/reports/custodians${qs({ custodian_id: ictCustodianId })}`)).data);
    if (!rows.length) throw new Error('no custodian rows returned');
    if (rows.length > 1) throw new Error('expected single custodian row');
    if (!/ict/i.test(rows[0].custodian_name || '')) {
      throw new Error(`unexpected custodian: ${rows[0].custodian_name}`);
    }
  });

  await run('Inventory report includes summary block', async () => {
    const payload = (await request('GET', `/reports/inventory${qs({ department_id: ictDept.id })}`)).data;
    const summary = reportSummary(payload);
    if (!summary) throw new Error('summary missing');
    if (summary.total_records !== reportRows(payload).length) throw new Error('total_records mismatch');
    if (!summary.generated_at) throw new Error('generated_at missing');
    if (!summary.status_breakdown) throw new Error('status_breakdown missing');
  });

  await run('Filtered PDF export is smaller than unfiltered', async () => {
    const all = await requestBinary('/reports/export/pdf/inventory');
    const filtered = await requestBinary(`/reports/export/pdf/inventory${qs({ batch_id: batchA })}`);
    if (!all.contentType.includes('pdf')) throw new Error('unfiltered export is not PDF');
    if (!filtered.contentType.includes('pdf')) throw new Error('filtered export is not PDF');
    if (filtered.size >= all.size) throw new Error('filtered PDF should be smaller than unfiltered');
  });

  await run('Filtered Excel export is smaller than unfiltered', async () => {
    const all = await requestBinary('/reports/export/excel/inventory');
    const filtered = await requestBinary(`/reports/export/excel/inventory${qs({ property_tag: tagB })}`);
    if (!all.contentType.includes('spreadsheet')) throw new Error('unfiltered export is not Excel');
    if (!filtered.contentType.includes('spreadsheet')) throw new Error('filtered export is not Excel');
    if (filtered.size >= all.size) throw new Error('filtered Excel should be smaller than unfiltered');
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
