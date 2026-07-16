/**
 * Backfill: ensure every Non-Consumable / Semi-Durable asset has its own PAR
 * whose property tag exactly matches inventory_items.property_tag.
 */
const pool = require('../config/database');
const DocumentService = require('../utils/documentService');
const { isFixedAsset, isSemiDurable } = require('../utils/assetClassification');

function canPar(classification) {
  return isFixedAsset(classification) || isSemiDurable(classification);
}

async function run() {
  const [adminRows] = await pool.query(
    `SELECT u.id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.name IN ('admin', 'Administrator', 'Property Manager')
       AND u.is_active = 1
     ORDER BY u.id ASC
     LIMIT 1`
  );
  const generatedBy = adminRows[0]?.id || null;

  const [items] = await pool.query(
    `SELECT i.id, i.property_tag, i.asset_classification
     FROM inventory_items i
     WHERE i.is_archived = 0
       AND i.property_tag IS NOT NULL
       AND TRIM(i.property_tag) <> ''
       AND NOT EXISTS (
         SELECT 1 FROM document_history d
         WHERE d.document_type = 'PAR'
           AND d.related_module = 'inventory'
           AND d.related_transaction_id = i.id
       )
     ORDER BY i.id ASC`
  );

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    if (!canPar(item.asset_classification)) {
      skipped += 1;
      continue;
    }
    try {
      const par = await DocumentService.generatePARForCustodianAssignment(item.id, generatedBy);
      const tag = String(par?.payload?.items?.[0]?.propertyTag || '').trim();
      if (!par || tag !== String(item.property_tag).trim()) {
        throw new Error(`tag mismatch expected ${item.property_tag} got ${tag}`);
      }
      created += 1;
      console.log(`Created ${par.document_number} for inventory #${item.id} (${item.property_tag})`);
    } catch (err) {
      failed += 1;
      console.error(`Failed inventory #${item.id}:`, err.message);
    }
  }

  console.log(`Done. created=${created} skipped=${skipped} failed=${failed} candidates=${items.length}`);
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
