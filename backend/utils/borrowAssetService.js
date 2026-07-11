const pool = require('../config/database');

const ENABLE_ADVANCED_BORROW_SELECTION = false;

const BORROWABLE_ASSET_STATUS = 'Available';
const MANUAL_BORROW_SELECTION_MAX = 10;
const NON_BORROWABLE_ASSET_STATUSES = new Set([
  'Borrowed',
  'Under Maintenance',
  'Disposed'
]);

const FIXED_ASSET_CLASSIFICATIONS = ['Non-Consumable (Fixed Asset)', 'Fixed Asset'];

function isAssetBorrowable(item) {
  if (!item || item.is_archived) return false;
  if (!FIXED_ASSET_CLASSIFICATIONS.includes(item.asset_classification)) return false;
  if (item.status !== BORROWABLE_ASSET_STATUS) return false;
  return true;
}

function fifoOrderSql(alias = 'i') {
  return `ORDER BY
    COALESCE(${alias}.acquisition_date, '9999-12-31') ASC,
    ${alias}.created_at ASC,
    ${alias}.property_tag ASC`;
}

async function getAvailableAssetsByItemCode(itemCode, conn = pool, limit = null) {
  let sql = `
    SELECT id, item_code, item_name, property_tag, status, acquisition_date, created_at
    FROM inventory_items
    WHERE is_archived = 0
      AND item_code = ?
      AND status = ?
      AND asset_classification IN (?, ?)`;
  const params = [itemCode, BORROWABLE_ASSET_STATUS, ...FIXED_ASSET_CLASSIFICATIONS];

  sql += ` ${fifoOrderSql('inventory_items')}`;
  if (limit) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  const [rows] = await conn.query(sql, params);
  return rows;
}

async function getAvailableAssetById(id, conn = pool) {
  const [rows] = await conn.query(
    `SELECT id, item_code, item_name, property_tag, status, asset_classification
     FROM inventory_items
     WHERE id = ? AND is_archived = 0`,
    [id]
  );
  const item = rows[0];
  return isAssetBorrowable(item) ? item : null;
}

async function allocateAssets({ itemCode, quantity, inventoryItemIds = [], conn = pool }) {
  const count = Math.max(1, Number(quantity) || 1);

  if (inventoryItemIds.length) {
    if (count > MANUAL_BORROW_SELECTION_MAX) {
      throw new Error(`Manual asset selection is only available for quantities up to ${MANUAL_BORROW_SELECTION_MAX}`);
    }
    if (inventoryItemIds.length !== count) {
      throw new Error('Number of selected assets must match requested quantity');
    }

    const placeholders = inventoryItemIds.map(() => '?').join(', ');
    const [rows] = await conn.query(
      `SELECT id, item_code, item_name, property_tag, status
       FROM inventory_items
       WHERE is_archived = 0
         AND item_code = ?
         AND id IN (${placeholders})
         AND status = ?`,
      [itemCode, ...inventoryItemIds, BORROWABLE_ASSET_STATUS]
    );

    if (rows.length !== count) {
      throw new Error('One or more selected assets are unavailable for borrowing');
    }

    const byId = new Map(rows.map((row) => [row.id, row]));
    return inventoryItemIds.map((id) => byId.get(Number(id)));
  }

  const available = await getAvailableAssetsByItemCode(itemCode, conn, count);
  if (available.length < count) {
    throw new Error(`Insufficient available assets for ${itemCode}. Requested ${count}, found ${available.length}.`);
  }

  return available.slice(0, count);
}

async function expandBorrowRequestItems(items, conn = pool) {
  const expanded = [];

  for (const line of items || []) {
    if (line.item_code) {
      const manualIds = ENABLE_ADVANCED_BORROW_SELECTION ? (line.inventory_item_ids || []) : [];
      const assets = await allocateAssets({
        itemCode: line.item_code,
        quantity: line.quantity,
        inventoryItemIds: manualIds,
        conn
      });
      const manualSelection = manualIds.length > 0;

      assets.forEach((asset) => {
        expanded.push({
          inventory_item_id: asset.id,
          quantity: 1,
          property_tag: asset.property_tag,
          item_code: asset.item_code,
          item_name: asset.item_name,
          manual_selection: manualSelection
        });
      });
      continue;
    }

    if (line.inventory_item_id) {
      const asset = await getAvailableAssetById(line.inventory_item_id, conn);
      if (!asset) {
        throw new Error(`Asset ID ${line.inventory_item_id} is unavailable for borrowing`);
      }

      const qty = Math.max(1, Number(line.quantity) || 1);
      if (qty !== 1) {
        const manualIds = ENABLE_ADVANCED_BORROW_SELECTION ? (line.inventory_item_ids || []) : [];
        const assets = await allocateAssets({
          itemCode: asset.item_code,
          quantity: qty,
          inventoryItemIds: manualIds,
          conn
        });
        assets.forEach((row) => {
          expanded.push({
            inventory_item_id: row.id,
            quantity: 1,
            property_tag: row.property_tag,
            item_code: row.item_code,
            item_name: row.item_name
          });
        });
      } else {
        expanded.push({
          inventory_item_id: asset.id,
          quantity: 1,
          property_tag: asset.property_tag,
          item_code: asset.item_code,
          item_name: asset.item_name
        });
      }
    }
  }

  if (!expanded.length) {
    throw new Error('At least one borrowable asset is required');
  }

  return expanded;
}

async function previewBorrowAllocation(items, conn = pool) {
  const lines = await expandBorrowRequestItems(items, conn);
  const grouped = new Map();

  lines.forEach((line) => {
    const key = line.item_code;
    if (!grouped.has(key)) {
      grouped.set(key, {
        item_code: line.item_code,
        item_name: line.item_name,
        quantity: 0,
        property_tags: []
      });
    }
    const entry = grouped.get(key);
    entry.quantity += 1;
    if (line.property_tag) entry.property_tags.push(line.property_tag);
  });

  return {
    total_assets: lines.length,
    assignment_mode: lines.some((line) => line.manual_selection) ? 'manual' : 'fifo',
    items: Array.from(grouped.values()),
    assets: lines
  };
}

module.exports = {
  ENABLE_ADVANCED_BORROW_SELECTION,
  BORROWABLE_ASSET_STATUS,
  MANUAL_BORROW_SELECTION_MAX,
  NON_BORROWABLE_ASSET_STATUSES,
  isAssetBorrowable,
  getAvailableAssetsByItemCode,
  getAvailableAssetById,
  allocateAssets,
  expandBorrowRequestItems,
  previewBorrowAllocation
};
