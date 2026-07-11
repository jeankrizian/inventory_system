/**
 * Phase 12: performance indexes for property-based inventory queries.
 * Run: node test-phase12-performance-indexes-api.js
 */
const BASE = 'http://localhost:3000/api';
const pool = require('./config/database');

let cookie = '';

const REQUIRED_INDEXES = {
  inventory_items: [
    'idx_inventory_borrow_lookup',
    'idx_inventory_scope_list',
    'idx_inventory_updated_at',
    'idx_inventory_material',
    'idx_inventory_fifo_order'
  ],
  borrow_transactions: [
    'idx_borrow_status',
    'idx_borrow_date',
    'idx_borrow_tx_borrower_status'
  ],
  borrow_items: [
    'idx_borrow_items_asset_tx'
  ]
};

const INDEXED_COLUMNS = {
  inventory_items: [
    'property_tag',
    'batch_id',
    'item_code',
    'status',
    'department_id',
    'location_id',
    'custodian_id',
    'serial_number'
  ],
  disposal_requests: ['inventory_item_id'],
  transfer_requests: ['inventory_item_id'],
  maintenance_records: ['inventory_item_id']
};

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

async function columnIsIndexed(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function getTableIndexes(table) {
  const [rows] = await pool.query(
    `SELECT DISTINCT INDEX_NAME
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     ORDER BY INDEX_NAME`,
    [table]
  );
  return new Set(rows.map((row) => row.INDEX_NAME));
}

function reportRows(data) {
  if (Array.isArray(data)) return data;
  return data?.rows || [];
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

  for (const [table, indexes] of Object.entries(REQUIRED_INDEXES)) {
    await run(`Indexes present on ${table}`, async () => {
      const existing = await getTableIndexes(table);
      const missing = indexes.filter((name) => !existing.has(name));
      if (missing.length) {
        throw new Error(`missing: ${missing.join(', ')}`);
      }
    });
  }

  for (const [table, columns] of Object.entries(INDEXED_COLUMNS)) {
    for (const column of columns) {
      await run(`${table}.${column} is indexed`, async () => {
        if (!(await columnIsIndexed(table, column))) {
          throw new Error(`${table}.${column} has no index`);
        }
      });
    }
  }

  await login('admin', 'admin123');
  const depts = (await request('GET', '/departments')).data || [];
  const dept = depts[0];
  const users = (await request('GET', '/users')).data || [];
  const custodianId = users.find((u) => u.username === 'ict_custodian')?.id
    || users.find((u) => u.role === 'Custodian')?.id;

  await run('Inventory list responds after index migration', async () => {
    const rows = (await request('GET', '/inventory')).data || [];
    if (!Array.isArray(rows)) throw new Error('inventory list not an array');
  });

  await run('Global search responds after index migration', async () => {
    const data = (await request('GET', '/search?q=Phase')).data || {};
    if (!Array.isArray(data.inventory)) throw new Error('search inventory missing');
  });

  await run('Borrow catalog responds after index migration', async () => {
    const rows = (await request('GET', '/borrow/borrowable-items')).data || [];
    if (!Array.isArray(rows)) throw new Error('borrow catalog not an array');
  });

  await run('Scoped inventory report still works', async () => {
    const rows = reportRows((await request('GET', `/reports/inventory?department_id=${dept.id}&status=Available`)).data);
    if (!Array.isArray(rows)) throw new Error('report rows missing');
  });

  await run('Create and filter asset by material index path', async () => {
    const stamp = Date.now();
    const created = await request('POST', '/inventory', {
      item_name: `Phase12 Index ${stamp}`,
      department_id: dept.id,
      asset_count: 1,
      material: 'Metal',
      custodian_id: custodianId,
      asset_classification: 'Non-Consumable (Fixed Asset)'
    });
    const assetId = created.data?.created_ids?.[0] || created.data?.id;
    const filtered = reportRows((await request('GET', '/reports/inventory?material=Metal')).data);
    if (!filtered.some((row) => row.id === assetId)) {
      throw new Error('material-filtered report missing new asset');
    }
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;

  await pool.end().catch(() => {});
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => {});
  process.exitCode = 1;
});
