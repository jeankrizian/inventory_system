/**
 * Phase 13: legacy data migration (property tags, batch IDs, transaction integrity).
 * Run: node test-phase13-legacy-data-migration-api.js
 */
const BASE = 'http://localhost:3000/api';
const pool = require('./config/database');
const {
  runLegacyDataMigration,
  verifyInventoryTransactionIntegrity
} = require('./database/runLegacyDataMigration');
const { isAutoPropertyTagFormat } = require('./utils/propertyTagGenerator');
const { isValidBatchIdFormat } = require('./utils/batchIdGenerator');

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

async function insertLegacyAsset({
  itemCode,
  itemName,
  departmentId,
  custodianId,
  createdAt
}) {
  const [result] = await pool.query(
    `INSERT INTO inventory_items
     (item_code, item_name, department_id, asset_classification, property_tag, batch_id,
      custodian_id, status, created_at, updated_at)
     VALUES (?, ?, ?, 'Non-Consumable (Fixed Asset)', NULL, NULL, ?, 'Available', ?, ?)`,
    [itemCode, itemName, departmentId, custodianId, createdAt, createdAt]
  );
  return result.insertId;
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
  const itemCode = `LEG-P13-${stamp}`;
  const createdAt = '2026-01-15 10:00:00';
  let assetA;
  let assetB;
  let borrowId;

  await run('Insert legacy assets without property tags or batch IDs', async () => {
    assetA = await insertLegacyAsset({
      itemCode,
      itemName: `Legacy Asset A ${stamp}`,
      departmentId: dept.id,
      custodianId,
      createdAt
    });
    assetB = await insertLegacyAsset({
      itemCode,
      itemName: `Legacy Asset B ${stamp}`,
      departmentId: dept.id,
      custodianId,
      createdAt
    });
    if (!assetA || !assetB) throw new Error('legacy assets not inserted');
  });

  await run('Legacy migration assigns property tags and shared batch ID', async () => {
    const result = await runLegacyDataMigration();
    if (!result.propertyTags.assigned && !result.batchIds.assetsUpdated) {
      throw new Error('migration made no updates for legacy assets');
    }

    const [rows] = await pool.query(
      'SELECT id, property_tag, batch_id FROM inventory_items WHERE id IN (?, ?) ORDER BY id',
      [assetA, assetB]
    );
    if (rows.length !== 2) throw new Error('expected 2 migrated assets');

    for (const row of rows) {
      if (!row.property_tag || !isAutoPropertyTagFormat(row.property_tag)) {
        throw new Error(`invalid property tag for asset ${row.id}: ${row.property_tag}`);
      }
      if (!row.batch_id || !isValidBatchIdFormat(row.batch_id)) {
        throw new Error(`invalid batch id for asset ${row.id}: ${row.batch_id}`);
      }
    }

    if (rows[0].property_tag === rows[1].property_tag) {
      throw new Error('property tags must be unique');
    }
    if (rows[0].batch_id !== rows[1].batch_id) {
      throw new Error('assets created together should share batch_id');
    }
  });

  await run('Legacy migration is idempotent', async () => {
    const before = await pool.query(
      'SELECT property_tag, batch_id FROM inventory_items WHERE id IN (?, ?) ORDER BY id',
      [assetA, assetB]
    );
    const result = await runLegacyDataMigration();
    if (result.propertyTags.assigned > 0 || result.batchIds.assetsUpdated > 0) {
      throw new Error('second migration run should not reassign completed assets');
    }
    const after = await pool.query(
      'SELECT property_tag, batch_id FROM inventory_items WHERE id IN (?, ?) ORDER BY id',
      [assetA, assetB]
    );
    if (JSON.stringify(before[0]) !== JSON.stringify(after[0])) {
      throw new Error('idempotent migration changed existing values');
    }
  });

  await run('Transaction history remains linked after migration', async () => {
    const borrowRes = await request('POST', '/borrow', {
      purpose: `Phase13 legacy migration ${stamp}`,
      borrow_date: '2026-07-10',
      expected_return_date: '2026-07-17',
      items: [{ item_code: itemCode, quantity: 1 }]
    });
    borrowId = borrowRes.data?.id;
    if (!borrowId) throw new Error('borrow not created');

    const [lines] = await pool.query(
      'SELECT inventory_item_id FROM borrow_items WHERE borrow_transaction_id = ?',
      [borrowId]
    );
    if (!lines.some((line) => line.inventory_item_id === assetA)) {
      throw new Error('borrow line not linked to migrated asset');
    }

    const issues = await verifyInventoryTransactionIntegrity();
    if (issues.length) {
      throw new Error(`integrity issues found: ${JSON.stringify(issues.slice(0, 3))}`);
    }
  });

  await run('Existing legacy property tags are preserved', async () => {
    const legacyTag = `CI-LEGACY-${stamp}`;
    const [insert] = await pool.query(
      `INSERT INTO inventory_items
       (item_code, item_name, department_id, asset_classification, property_tag, batch_id,
        custodian_id, status)
       VALUES (?, ?, ?, 'Non-Consumable (Fixed Asset)', ?, NULL, ?, 'Available')`,
      [`LEG-P13-TAG-${stamp}`, `Tagged Legacy ${stamp}`, dept.id, legacyTag, custodianId]
    );
    await runLegacyDataMigration();
    const [rows] = await pool.query('SELECT property_tag FROM inventory_items WHERE id = ?', [insert.insertId]);
    if (rows[0]?.property_tag !== legacyTag) {
      throw new Error(`legacy tag overwritten: ${rows[0]?.property_tag}`);
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
