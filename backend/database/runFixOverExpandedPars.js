/**
 * Correct PARs that were over-expanded to full batch tags when multiple
 * historical PARs exist for the same batch (one PAR per asset era).
 */
const pool = require('../config/database');
const DocumentModel = require('../models/DocumentModel');
const { isFixedAsset, normalizeClassification } = require('../utils/assetClassification');

function toParClassification(classification) {
  const normalized = normalizeClassification(classification);
  if (normalized === 'Semi-Durable') return 'Semi-Durable';
  if (isFixedAsset(classification)) return 'Durable';
  return normalized || '';
}

function parsePayload(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return { ...raw };
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function run() {
  const [docs] = await pool.query(
    `SELECT id, document_number, related_transaction_id, payload
     FROM document_history
     WHERE document_type = 'PAR' AND related_module = 'inventory'
     ORDER BY id ASC`
  );

  let fixed = 0;
  for (const doc of docs) {
    const [items] = await pool.query(
      `SELECT id, property_tag, batch_id, asset_classification, item_name, brand, model
       FROM inventory_items WHERE id = ?`,
      [doc.related_transaction_id]
    );
    const item = items[0];
    if (!item?.batch_id || !item.property_tag) continue;

    const [siblings] = await pool.query(
      'SELECT id FROM inventory_items WHERE batch_id = ?',
      [item.batch_id]
    );
    if (siblings.length <= 1) continue;

    const siblingIds = siblings.map((s) => s.id);
    const placeholders = siblingIds.map(() => '?').join(',');
    const [parRows] = await pool.query(
      `SELECT COUNT(*) AS c FROM document_history
       WHERE document_type = 'PAR'
         AND related_module = 'inventory'
         AND related_transaction_id IN (${placeholders})`,
      siblingIds
    );
    const parCount = Number(parRows[0].c) || 0;
    const payload = parsePayload(doc.payload);
    const existing = Array.isArray(payload.propertyTags) && payload.propertyTags.length
      ? payload.propertyTags
      : (payload.items?.[0]?.propertyTags || []);

    if (parCount <= 1 || existing.length <= 1) continue;

    const tags = [item.property_tag];
    const classification = toParClassification(item.asset_classification);
    const description = [item.item_name, item.brand, item.model].filter(Boolean).join(' / ');
    const baseItems = Array.isArray(payload.items) && payload.items.length ? payload.items : [{}];
    const nextItems = baseItems.map((row, idx) => {
      if (idx !== 0) return row;
      return {
        ...row,
        propertyTag: item.property_tag,
        propertyTags: tags,
        quantity: 1,
        classification,
        description: row.description || description
      };
    });

    await DocumentModel.updatePayload(doc.id, {
      ...payload,
      classification,
      propertyTags: tags,
      attachPropertyTagList: false,
      propertyTagNote: '',
      items: nextItems
    }, 'Updated');

    fixed += 1;
    console.log(`Fixed ${doc.document_number} -> ${item.property_tag}`);
  }

  console.log(`Done. Fixed ${fixed} PAR(s).`);
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
