/**
 * Phase 2: batch creation (BATCH-YYYYMMDD-001).
 * Run: node test-phase2-batch-api.js
 */
const BASE = 'http://localhost:3000/api';
const BATCH_REGEX = /^BATCH-\d{8}-\d{3}$/;

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

function parseBatchSeq(batchId) {
  const match = String(batchId).match(/^BATCH-\d{8}-(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
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
  let bulkBatchId = null;
  let bulkIds = [];

  await run('Bulk create assigns one shared batch ID', async () => {
    const res = await request('POST', '/inventory', {
      item_name: `Batch Bulk ${stamp}`,
      department_id: deptId,
      quantity: 4,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    });
    bulkIds = res.data?.created_ids || [];
    bulkBatchId = res.data?.batch_id;
    assert(bulkIds.length === 4, 'expected 4 assets');
    assert(BATCH_REGEX.test(bulkBatchId), `invalid batch format: ${bulkBatchId}`);

    const items = await Promise.all(bulkIds.map((id) => request('GET', `/inventory/${id}`)));
    const batchIds = items.map((r) => r.data.batch_id);
    assert(batchIds.every((id) => id === bulkBatchId), 'all assets must share the same batch_id');
  });

  await run('Second create gets a new sequential batch ID', async () => {
    const res = await request('POST', '/inventory', {
      item_name: `Batch Single ${stamp}`,
      department_id: deptId,
      quantity: 1,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    });
    const nextBatch = res.data?.batch_id;
    assert(BATCH_REGEX.test(nextBatch), `invalid batch format: ${nextBatch}`);
    assert(nextBatch !== bulkBatchId, 'batch IDs must differ between creates');
    const seq1 = parseBatchSeq(bulkBatchId);
    const seq2 = parseBatchSeq(nextBatch);
    assert(seq2 === seq1 + 1, `expected sequential batch IDs (${seq1} -> ${seq2})`);
  });

  await run('Edit cannot change batch ID via API', async () => {
    const id = bulkIds[0];
    const before = (await request('GET', `/inventory/${id}`)).data.batch_id;
    await request('PUT', `/inventory/${id}`, {
      item_name: `Batch Bulk ${stamp} Updated`,
      batch_id: 'BATCH-99999999-999'
    });
    const after = (await request('GET', `/inventory/${id}`)).data.batch_id;
    assert(after === before, 'batch_id must remain unchanged on edit');
  });

  await run('Search finds assets by batch ID', async () => {
    const list = (await request('GET', `/inventory?search=${encodeURIComponent(bulkBatchId)}`)).data || [];
    const found = list.filter((row) => bulkIds.includes(row.id));
    assert(found.length === 4, 'search should return all assets in the batch');
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
