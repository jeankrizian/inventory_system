/**
 * Backfill missing PAR property tags / classification from linked inventory
 * without changing PAR document numbers or creating new documents.
 *
 * Preserves historical single-tag PARs (does not expand them to full batch).
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

function looksLikeRange(value) {
  const text = String(value || '');
  return text.includes(' - ') || text.includes('–') || /see attached/i.test(text);
}

function formatDisplay(tags) {
  if (!tags.length) return '';
  if (tags.length === 1) return tags[0];
  if (tags.length <= 5) return tags.join(', ');
  return `${tags[0]} - ${tags[tags.length - 1]} (See Attached Property Tag List)`;
}

async function resolveTagsForInventory(inventoryId) {
  const [itemRows] = await pool.query(
    'SELECT id, property_tag, batch_id, asset_classification, item_name, brand, model FROM inventory_items WHERE id = ?',
    [inventoryId]
  );
  const item = itemRows[0];
  if (!item) return { batchTags: [], item: null };

  let batchTags = [];
  if (item.batch_id) {
    const [batchRows] = await pool.query(
      'SELECT property_tag FROM inventory_items WHERE batch_id = ? ORDER BY id ASC',
      [item.batch_id]
    );
    batchTags = batchRows.map((r) => r.property_tag).filter(Boolean);
  } else if (item.property_tag) {
    batchTags = [item.property_tag];
  }

  return { batchTags, item };
}

function resolveTagsToUse(payload, item, batchTags) {
  const currentTag = String(payload?.items?.[0]?.propertyTag || '').trim();
  const currentTags = (
    Array.isArray(payload?.propertyTags) && payload.propertyTags.length
      ? payload.propertyTags
      : (payload?.items?.[0]?.propertyTags || [])
  ).map((t) => String(t || '').trim()).filter(Boolean);
  const quantity = Math.max(1, parseInt(payload?.items?.[0]?.quantity, 10) || 1);

  if (currentTags.length) {
    // Prefer existing list, but if it is a single tag while quantity implies a batch issuance, use batch
    if (currentTags.length === 1 && quantity > 1 && batchTags.length > 1) {
      return batchTags;
    }
    return currentTags;
  }

  if (currentTag && !looksLikeRange(currentTag) && quantity <= 1) {
    // Historical one-PAR-per-asset: keep that single tag
    return [currentTag];
  }

  if (looksLikeRange(currentTag) || quantity > 1) {
    return batchTags.length ? batchTags : (item.property_tag ? [item.property_tag] : []);
  }

  if (item.property_tag) return [item.property_tag];
  return batchTags;
}

async function runRepairParPropertyTags() {
  console.log('Repairing PAR payloads (property tags + classification)...');
  const [docs] = await pool.query(
    `SELECT id, document_number, related_transaction_id, payload
     FROM document_history
     WHERE document_type = 'PAR' AND related_module = 'inventory'
     ORDER BY id ASC`
  );

  let repaired = 0;
  for (const doc of docs) {
    const inventoryId = doc.related_transaction_id;
    if (!inventoryId) continue;

    const { batchTags, item } = await resolveTagsForInventory(inventoryId);
    if (!item) continue;

    const payload = parsePayload(doc.payload);
    const classification = toParClassification(item.asset_classification);
    const tags = resolveTagsToUse(payload, item, batchTags);
    const attach = tags.length > 5;
    const display = formatDisplay(tags);
    const description = [item.item_name, item.brand, item.model].filter(Boolean).join(' / ');

    const nextItems = Array.isArray(payload.items) && payload.items.length
      ? payload.items.map((row, idx) => {
        if (idx !== 0) return row;
        return {
          ...row,
          propertyTag: display || row.propertyTag || item.property_tag || '',
          propertyTags: tags,
          classification: classification || row.classification || '',
          description: row.description || description,
          quantity: Math.max(parseInt(row.quantity, 10) || 1, tags.length > 1 ? tags.length : 1)
        };
      })
      : [{
        propertyTag: display || item.property_tag || '',
        propertyTags: tags,
        description,
        quantity: tags.length || 1,
        unit: 'pcs',
        amount: '',
        classification
      }];

    // Avoid changing quantity for historical single-tag PARs
    if (tags.length === 1 && nextItems[0]) {
      nextItems[0].quantity = Math.max(1, parseInt(payload?.items?.[0]?.quantity, 10) || 1);
    }

    const nextPayload = {
      ...payload,
      classification: classification || payload.classification || '',
      propertyTags: tags,
      attachPropertyTagList: attach,
      propertyTagNote: attach ? 'See Attached Property Tag List' : '',
      itemDescription: payload.itemDescription || description,
      items: nextItems
    };

    await DocumentModel.updatePayload(doc.id, nextPayload, 'Updated');
    repaired += 1;
    console.log(`  Repaired ${doc.document_number} (id=${doc.id}) tags=${tags.length} class=${classification}`);
  }

  console.log(`Done. Repaired ${repaired} PAR document(s).`);
}

if (require.main === module) {
  runRepairParPropertyTags()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runRepairParPropertyTags };
