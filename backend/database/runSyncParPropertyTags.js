/**
 * Audit + repair: PAR property tag must equal inventory_items.property_tag
 * for the linked asset (related_transaction_id).
 */
const pool = require('../config/database');
const DocumentModel = require('../models/DocumentModel');

function parsePayload(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return { ...raw };
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function run({ repair = true } = {}) {
  const [rows] = await pool.query(
    `SELECT i.id AS inventory_id,
            i.property_tag AS inv_tag,
            i.item_name,
            d.id AS document_id,
            d.document_number,
            d.payload
     FROM document_history d
     JOIN inventory_items i
       ON i.id = d.related_transaction_id
     WHERE d.document_type = 'PAR'
       AND d.related_module = 'inventory'
     ORDER BY d.id DESC`
  );

  let mismatch = 0;
  let repaired = 0;

  for (const row of rows) {
    const payload = parsePayload(row.payload);
    const invTag = String(row.inv_tag || '').trim();
    const parTag = String(payload?.items?.[0]?.propertyTag || '').trim();
    const parTags = Array.isArray(payload.propertyTags)
      ? payload.propertyTags.map((t) => String(t || '').trim()).filter(Boolean)
      : (payload?.items?.[0]?.propertyTags || []).map((t) => String(t || '').trim()).filter(Boolean);

    const tagsMatchSingle =
      invTag
      && parTag === invTag
      && (parTags.length === 0 || (parTags.length === 1 && parTags[0] === invTag));

    if (tagsMatchSingle) continue;

    mismatch += 1;
    console.log(
      `Mismatch ${row.document_number} inventory#${row.inventory_id}: inv="${invTag}" par="${parTag}" tags=[${parTags.join(', ')}]`
    );

    if (!repair || !invTag) continue;

    const nextItems = Array.isArray(payload.items) && payload.items.length
      ? payload.items.map((item, idx) => {
        if (idx !== 0) return item;
        return {
          ...item,
          propertyTag: invTag,
          propertyTags: [invTag],
          quantity: 1
        };
      })
      : [{
        propertyTag: invTag,
        propertyTags: [invTag],
        description: row.item_name || '',
        quantity: 1,
        unit: 'pcs',
        amount: ''
      }];

    const nextPayload = {
      ...payload,
      propertyTags: [invTag],
      attachPropertyTagList: false,
      propertyTagNote: '',
      items: nextItems
    };

    await DocumentModel.updatePayload(row.document_id, nextPayload, 'Updated');
    repaired += 1;
  }

  console.log(`Checked ${rows.length} PAR(s). Mismatches: ${mismatch}. Repaired: ${repaired}.`);
}

if (require.main === module) {
  const repair = !process.argv.includes('--audit-only');
  run({ repair })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { run };
