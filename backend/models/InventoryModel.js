const pool = require('../config/database');
const { computeInventoryStatus, recalculateInventoryStatus, preserveStatusOnEdit } = require('../utils/inventoryStatusService');
const { appendInventoryScopeSql, isInventoryScopeDenied } = require('../utils/roleHelpers');
const { generateNextItemCode } = require('../utils/itemCodeGenerator');
const {
  generateAutoPropertyTags,
  validatePropertyTagsUnique
} = require('../utils/propertyTagGenerator');
const { validateSerialNumberUnique } = require('../utils/serialNumberValidator');
const { generateNextBatchId } = require('../utils/batchIdGenerator');
const { requiresPropertyTag, normalizeClassification } = require('../utils/assetClassification');
const { isItemAvailableForBorrow, getItemUnavailableReason } = require('../utils/itemAvailability');
const { appendDateRangeSql } = require('../utils/reportFilters');
const {
  CONSUMABLE_TEMPORARILY_DISABLED,
  DEFAULT_CLASSIFICATION_WHEN_CONSUMABLE_DISABLED,
  shouldExcludeConsumableFromLists
} = require('../utils/assetClassification');

const EMPTY_INVENTORY_STATS = {
  total_items: 0,
  available_items: 0,
  borrowed_items: 0,
  under_maintenance: 0,
  disposed: 0
};

function normalizeInventoryStats(row = {}) {
  return {
    total_items: Number(row.total_items ?? 0),
    available_items: Number(row.available_items ?? 0),
    borrowed_items: Number(row.borrowed_items ?? 0),
    under_maintenance: Number(row.under_maintenance ?? 0),
    disposed: Number(row.disposed ?? 0)
  };
}

const REMOVED_INVENTORY_FIELDS = [
  'quantity',
  'available_quantity',
  'unit',
  'low_stock_threshold',
  'acquisition_cost'
];

function mapItem(row) {

  if (!row) return null;

  const mapped = {
    ...row,
    category_id: row.department_id,
    category_name: row.department_name
  };

  for (const field of REMOVED_INVENTORY_FIELDS) {
    delete mapped[field];
  }

  return mapped;

}



const InventoryModel = {

  async getAll(filters = {}) {

    let sql = `

      SELECT i.*, d.name AS department_name, s.name AS supplier_name, l.name AS location_name,

             c.full_name AS custodian_name, p.item_name AS parent_asset_name

      FROM inventory_items i

      LEFT JOIN departments d ON i.department_id = d.id

      LEFT JOIN suppliers s ON i.supplier_id = s.id

      LEFT JOIN locations l ON i.location_id = l.id

      LEFT JOIN users c ON i.custodian_id = c.id

      LEFT JOIN inventory_items p ON i.parent_asset_id = p.id

      WHERE 1=1 AND (i.is_archived = 0)`;

    const params = [];

    if (filters.department_scope_mismatch) {
      return [];
    }

    if (filters.search) {

      sql += ` AND (i.item_code LIKE ? OR i.item_name LIKE ? OR i.brand LIKE ? OR i.model LIKE ?
        OR i.property_tag LIKE ? OR i.batch_id LIKE ? OR i.serial_number LIKE ?
        OR d.name LIKE ? OR l.name LIKE ?)`;

      const term = `%${filters.search}%`;

      params.push(term, term, term, term, term, term, term, term, term);

    }

    if (filters.item_code) {
      sql += ' AND i.item_code LIKE ?';
      params.push(`%${filters.item_code}%`);
    }

    if (filters.item_name) {
      sql += ' AND i.item_name LIKE ?';
      params.push(`%${filters.item_name}%`);
    }

    if (filters.property_tag) {
      sql += ' AND i.property_tag LIKE ?';
      params.push(`%${filters.property_tag}%`);
    }

    if (filters.batch_id) {
      sql += ' AND i.batch_id LIKE ?';
      params.push(`%${filters.batch_id}%`);
    }

    if (filters.brand) {
      sql += ' AND i.brand LIKE ?';
      params.push(`%${filters.brand}%`);
    }

    if (filters.model) {
      sql += ' AND i.model LIKE ?';
      params.push(`%${filters.model}%`);
    }

    if (filters.condition) {
      sql += ' AND i.`condition` LIKE ?';
      params.push(`%${filters.condition}%`);
    }

    if (filters.material) {
      sql += ' AND i.material = ?';
      params.push(filters.material);
    }

    if (filters.custodian_id) {
      sql += ' AND i.custodian_id = ?';
      params.push(filters.custodian_id);
    }

    if (filters.custodian_name) {
      sql += ' AND c.full_name LIKE ?';
      params.push(`%${filters.custodian_name}%`);
    }

    if (filters.supplier_id) {
      sql += ' AND i.supplier_id = ?';
      params.push(filters.supplier_id);
    }

    if (filters.supplier_name) {
      sql += ' AND s.name LIKE ?';
      params.push(`%${filters.supplier_name}%`);
    }

    if (filters.unit_cost != null && filters.unit_cost !== '') {
      const cost = parseFloat(filters.unit_cost);
      if (!Number.isNaN(cost)) {
        sql += ' AND i.unit_cost = ?';
        params.push(cost);
      }
    }

    if (filters.purchase_date) {
      sql += ' AND DATE(i.purchase_date) = ?';
      params.push(filters.purchase_date);
    }

    if (filters.department_id) {

      sql += ' AND i.department_id = ?';

      params.push(filters.department_id);

    }

    if (filters.asset_classification) {

      sql += ' AND i.asset_classification LIKE ?';

      params.push(`%${filters.asset_classification}%`);

    }

    if (filters.exclude_consumable) {
      sql += " AND i.asset_classification != 'Consumable'";
    }

    if (filters.status) {

      sql += ' AND i.status LIKE ?';

      params.push(`%${filters.status}%`);

    }

    if (filters.department_name) {
      sql += ' AND d.name LIKE ?';
      params.push(`%${filters.department_name}%`);
    }

    if (filters.location_name) {
      sql += ' AND l.name LIKE ?';
      params.push(`%${filters.location_name}%`);
    }

    if (filters.location_id) {

      sql += ' AND i.location_id = ?';

      params.push(filters.location_id);

    }

    if (filters.parent_asset_id) {

      sql += ' AND i.parent_asset_id = ?';

      params.push(filters.parent_asset_id);

    }

    sql += appendDateRangeSql(
      filters,
      filters.date_column || 'COALESCE(i.acquisition_date, i.purchase_date, DATE(i.created_at))',
      params
    );

    const scopeFilter = appendInventoryScopeSql(filters.scope, 'i');
    if (scopeFilter.denied) {
      return [];
    }
    sql += scopeFilter.clause;
    params.push(...scopeFilter.params);

    sql += filters.search
      ? ' ORDER BY i.updated_at DESC, i.item_name ASC'
      : ' ORDER BY i.item_name ASC';

    if (filters.limit) {

      sql += ' LIMIT ?';

      params.push(parseInt(filters.limit, 10));

    }

    const [rows] = await pool.query(sql, params);

    return rows.map(mapItem);

  },



  async findById(id) {

    const [rows] = await pool.query(

      `SELECT i.*, d.name AS department_name, s.name AS supplier_name, l.name AS location_name,

              c.full_name AS custodian_name, p.item_name AS parent_asset_name

       FROM inventory_items i

       LEFT JOIN departments d ON i.department_id = d.id

       LEFT JOIN suppliers s ON i.supplier_id = s.id

       LEFT JOIN locations l ON i.location_id = l.id

       LEFT JOIN users c ON i.custodian_id = c.id

       LEFT JOIN inventory_items p ON i.parent_asset_id = p.id

       WHERE i.id = ? AND (i.is_archived = 0)`,

      [id]

    );

    return mapItem(rows[0]);

  },



  async findByCode(code) {

    const [rows] = await pool.query('SELECT * FROM inventory_items WHERE item_code = ? AND (is_archived = 0)', [code]);

    return rows[0] || null;

  },

  async getNextItemCode(departmentId) {
    return generateNextItemCode(departmentId);
  },

  async insertSingleAsset(data, conn = pool) {
    const status = 'Available';

    const [result] = await conn.query(
      `INSERT INTO inventory_items
       (item_code, item_name, description, department_id, asset_classification, material, property_tag, batch_id, serial_number, custodian_id,
        parent_asset_id, brand, model,
        supplier_id, purchase_date, acquisition_date, purchase_request_number, purchase_order_number,
        invoice_number, unit_cost, \`condition\`, status, location_id,
        maintenance_schedule, next_maintenance_date, maintenance_status, service_provider)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.item_code, data.item_name,
        data.description || null,
        data.department_id,
        data.asset_classification || (CONSUMABLE_TEMPORARILY_DISABLED
          ? DEFAULT_CLASSIFICATION_WHEN_CONSUMABLE_DISABLED
          : 'Consumable'),
        data.material || null,
        data.property_tag || null,
        data.batch_id || null,
        data.serial_number || null,
        data.custodian_id || null,
        data.parent_asset_id || null,
        data.brand || null, data.model || null,
        data.supplier_id || null,
        data.purchase_date || null,
        data.acquisition_date || data.purchase_date || null,
        data.purchase_request_number || null,
        data.purchase_order_number || null,
        data.invoice_number || null,
        data.unit_cost ?? null,
        data.condition || 'Good',
        status,
        data.location_id || null,
        data.maintenance_schedule || null,
        data.next_maintenance_date || null,
        data.maintenance_status || null,
        data.service_provider || null
      ]
    );

    return result.insertId;
  },

  async createBulkAssets(data) {
    const count = Math.max(1, parseInt(data.asset_count ?? data.quantity, 10) || 1);
    if (count > 500) {
      throw new Error('Cannot create more than 500 assets at once');
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const itemCode = data.item_code || await generateNextItemCode(data.department_id, connection);
      const classification = normalizeClassification(data.asset_classification);
      let propertyTags = Array.isArray(data.property_tags) ? data.property_tags : null;

      if (!propertyTags || propertyTags.length === 0) {
        if (classification === 'Consumable') {
          propertyTags = Array(count).fill(null);
        } else {
          propertyTags = await generateAutoPropertyTags(count, connection);
        }
      }

      if (propertyTags.length !== count) {
        throw new Error('Number of property tags must match number of assets');
      }

      if (propertyTags.some(Boolean)) {
        await validatePropertyTagsUnique(propertyTags, connection);
      }

      if (requiresPropertyTag(classification) && propertyTags.some((tag) => !tag)) {
        throw new Error('Property tag is required for each fixed asset');
      }

      const batchId = data.batch_id || await generateNextBatchId(connection);

      const ids = [];
      const serialNumber = count === 1 && data.serial_number ? data.serial_number : null;
      if (serialNumber) {
        await validateSerialNumberUnique(serialNumber, connection);
      }
      for (let i = 0; i < count; i += 1) {
        const id = await this.insertSingleAsset({
          ...data,
          item_code: itemCode,
          property_tag: propertyTags[i],
          batch_id: batchId,
          serial_number: serialNumber,
          status: 'Available'
        }, connection);
        ids.push(id);
      }

      await connection.commit();
      return { item_code: itemCode, batch_id: batchId, ids, created_count: count, first_id: ids[0] };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  async create(data) {
    return this.createBulkAssets(data);
  },



  async update(id, data) {

    const existing = await this.findById(id);

    if (!existing) return false;



    const status = preserveStatusOnEdit(existing.status);

    const nextSerial = data.serial_number !== undefined
      ? (data.serial_number || null)
      : existing.serial_number;
    if (nextSerial && nextSerial !== existing.serial_number) {
      await validateSerialNumberUnique(nextSerial, pool, [id]);
    }

    const nextPurchaseDate = data.purchase_date !== undefined
      ? (data.purchase_date || null)
      : existing.purchase_date;
    const nextAcquisitionRaw = data.acquisition_date !== undefined
      ? data.acquisition_date
      : existing.acquisition_date;
    const nextAcquisitionDate = nextAcquisitionRaw || nextPurchaseDate || null;

    await pool.query(

      `UPDATE inventory_items SET

        item_code = ?, item_name = ?, description = ?, department_id = ?, asset_classification = ?, material = ?,

        property_tag = ?, serial_number = ?, custodian_id = ?, parent_asset_id = ?,

        brand = ?, model = ?, supplier_id = ?,

        purchase_date = ?, acquisition_date = ?, purchase_request_number = ?, purchase_order_number = ?,

        invoice_number = ?, unit_cost = ?, \`condition\` = ?, status = ?, location_id = ?,

        maintenance_schedule = ?, next_maintenance_date = ?,

        maintenance_status = ?, service_provider = ?

       WHERE id = ?`,

      [

        data.item_code ?? existing.item_code,

        data.item_name ?? existing.item_name,

        data.description !== undefined ? (data.description || null) : existing.description,

        data.department_id ?? existing.department_id,

        data.asset_classification ?? existing.asset_classification,

        data.material !== undefined ? (data.material || null) : existing.material,

        existing.property_tag,

        data.serial_number !== undefined ? (data.serial_number || null) : existing.serial_number,

        data.custodian_id !== undefined ? data.custodian_id : existing.custodian_id,

        data.parent_asset_id !== undefined ? data.parent_asset_id : existing.parent_asset_id,

        data.brand ?? existing.brand,

        data.model ?? existing.model,

        data.supplier_id !== undefined ? data.supplier_id : existing.supplier_id,

        nextPurchaseDate,

        nextAcquisitionDate,

        data.purchase_request_number !== undefined ? data.purchase_request_number : existing.purchase_request_number,

        data.purchase_order_number !== undefined ? data.purchase_order_number : existing.purchase_order_number,

        data.invoice_number !== undefined ? data.invoice_number : existing.invoice_number,

        data.unit_cost !== undefined ? data.unit_cost : existing.unit_cost,

        data.condition ?? existing.condition,

        status,

        data.location_id !== undefined ? data.location_id : existing.location_id,

        data.maintenance_schedule ?? existing.maintenance_schedule,

        data.next_maintenance_date ?? existing.next_maintenance_date,

        data.maintenance_status ?? existing.maintenance_status,

        data.service_provider ?? existing.service_provider,

        id

      ]

    );

    return true;

  },



  async archive(id, userId) {
    const { archiveRecord } = require('../utils/archiveService');
    return archiveRecord('inventory_items', id, userId);
  },

  async delete(id, userId) {
    return this.archive(id, userId);
  },



  async getStats(scope) {
    if (isInventoryScopeDenied(scope)) {
      return { ...EMPTY_INVENTORY_STATS };
    }
    const scopeFilter = appendInventoryScopeSql(scope, 'i');
    if (scopeFilter.denied) {
      return { ...EMPTY_INVENTORY_STATS };
    }
    // Match Inventory list: exclude consumables while that classification is disabled.
    const consumableClause = shouldExcludeConsumableFromLists()
      ? " AND i.asset_classification != 'Consumable'"
      : '';
    const [rows] = await pool.query(`
      SELECT
        COUNT(*) AS total_items,
        COALESCE(SUM(CASE WHEN i.status = 'Available' THEN 1 ELSE 0 END), 0) AS available_items,
        COALESCE(SUM(CASE WHEN i.status = 'Borrowed' THEN 1 ELSE 0 END), 0) AS borrowed_items,
        COALESCE(SUM(CASE WHEN i.status = 'Under Maintenance' THEN 1 ELSE 0 END), 0) AS under_maintenance,
        COALESCE(SUM(CASE WHEN i.status = 'Disposed' THEN 1 ELSE 0 END), 0) AS disposed
      FROM inventory_items i
      WHERE i.is_archived = 0${consumableClause}${scopeFilter.clause}
    `, scopeFilter.params);
    return normalizeInventoryStats(rows[0]);
  },

  async getDepartmentDistribution(scope) {
    if (isInventoryScopeDenied(scope)) {
      return [];
    }
    const scopeFilter = appendInventoryScopeSql(scope, 'i');
    if (scopeFilter.denied) {
      return [];
    }
    const consumableClause = shouldExcludeConsumableFromLists()
      ? " AND i.asset_classification != 'Consumable'"
      : '';
    const [rows] = await pool.query(`
      SELECT d.name AS department, d.name AS category, COUNT(i.id) AS count
      FROM departments d
      LEFT JOIN inventory_items i ON d.id = i.department_id AND i.is_archived = 0 AND i.status != 'Disposed'${consumableClause}
      WHERE 1=1${scopeFilter.clause}
      GROUP BY d.id, d.name
      ORDER BY count DESC
    `, scopeFilter.params);
    return rows || [];
  },



  async adjustQuantity(id, delta) {
    if (Number(delta) < 0) {
      return this.markAssetBorrowed(id);
    }
    if (Number(delta) > 0) {
      return this.markAssetReturned(id);
    }
    return false;
  },



  async updateLocationAndDepartment(id, { location_id, department_id, custodian_id }, conn = pool) {
    const fields = ['location_id = ?', 'department_id = ?'];
    const params = [location_id, department_id];
    if (custodian_id !== undefined) {
      fields.push('custodian_id = ?');
      params.push(custodian_id);
    }
    params.push(id);
    await conn.query(
      `UPDATE inventory_items SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
  },



  async markDisposed(id, conn = null) {
    const db = conn || pool;
    const [result] = await db.query(
      `UPDATE inventory_items SET status = 'Disposed'
       WHERE id = ? AND status = 'Available' AND is_archived = 0`,
      [id]
    );
    return result.affectedRows > 0;
  },

  async setUnderMaintenance(id, maintenanceStatus = 'In Progress', conn = null) {
    const db = conn || pool;
    const [result] = await db.query(
      `UPDATE inventory_items SET status = 'Under Maintenance', maintenance_status = ?
       WHERE id = ? AND status = 'Available' AND is_archived = 0`,
      [maintenanceStatus, id]
    );
    return result.affectedRows > 0;
  },

  async setMaintenanceInProgress(id, conn = null) {
    const db = conn || pool;
    const [result] = await db.query(
      `UPDATE inventory_items SET maintenance_status = 'In Progress'
       WHERE id = ? AND status = 'Under Maintenance' AND is_archived = 0`,
      [id]
    );
    return result.affectedRows > 0;
  },

  async recalculateStatusAfterMaintenance(id, conn = null) {
    const db = conn || pool;
    const [rows] = await db.query(
      `SELECT id, status FROM inventory_items WHERE id = ?`,
      [id]
    );
    const item = rows[0];
    if (!item) return null;

    const status = recalculateInventoryStatus(item);
    await db.query(
      `UPDATE inventory_items SET status = ?, maintenance_status = 'Completed' WHERE id = ?`,
      [status, id]
    );
    return status;
  },



  borrowCatalogBaseSql() {
    return `FROM inventory_items i
       LEFT JOIN departments d ON i.department_id = d.id
       LEFT JOIN locations l ON i.location_id = l.id
       WHERE i.is_archived = 0
         AND i.status != 'Disposed'
         AND i.asset_classification IN ('Non-Consumable (Fixed Asset)', 'Fixed Asset')`;
  },

  enrichBorrowCatalogItem(row) {
    const item = mapItem(row);
    const borrowable = isItemAvailableForBorrow(item);
    return {
      ...item,
      is_borrowable: borrowable,
      unavailable_reason: borrowable ? null : getItemUnavailableReason(item)
    };
  },

  async markAssetBorrowed(id, conn = pool) {
    const [result] = await conn.query(
      `UPDATE inventory_items
       SET status = 'Borrowed'
       WHERE id = ? AND status = 'Available' AND is_archived = 0`,
      [id]
    );
    return result.affectedRows > 0;
  },

  async markAssetReturned(id, conn = pool) {
    const [result] = await conn.query(
      `UPDATE inventory_items
       SET status = 'Available'
       WHERE id = ? AND status = 'Borrowed' AND is_archived = 0`,
      [id]
    );
    return result.affectedRows > 0;
  },

  async getBorrowableModels(search = '') {
    let sql = `
      SELECT i.item_code,
             MAX(i.item_name) AS item_name,
             MAX(d.name) AS department_name,
             COUNT(*) AS available_count
      ${this.borrowCatalogBaseSql()}
        AND i.status = 'Available'`;
    const params = [];

    if (search && search.trim()) {
      sql += ' AND (i.item_name LIKE ? OR i.item_code LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    sql += ' GROUP BY i.item_code HAVING available_count > 0 ORDER BY item_name ASC';
    const [rows] = await pool.query(sql, params);
    return rows.map((row) => ({
      item_code: row.item_code,
      item_name: row.item_name,
      department_name: row.department_name,
      available_count: Number(row.available_count),
      is_borrowable: true
    }));
  },

  async getAvailableAssetsForModel(itemCode, limit = 10) {
    const { getAvailableAssetsByItemCode } = require('../utils/borrowAssetService');
    return getAvailableAssetsByItemCode(itemCode, pool, limit);
  },

  async getBorrowableItems(search = '') {
    const models = await this.getBorrowableModels(search);
    return models.map((model) => ({
      id: model.item_code,
      item_code: model.item_code,
      item_name: model.item_name,
      department_name: model.department_name,
      available_count: model.available_count,
      status: 'Available',
      asset_classification: 'Non-Consumable (Fixed Asset)',
      is_borrowable: true,
      unavailable_reason: null,
      is_model: true
    }));
  },

  async findBorrowableById(id) {
    const [rows] = await pool.query(
      `SELECT i.id, i.item_code, i.item_name, i.property_tag, i.status, i.asset_classification,
              d.name AS department_name, l.name AS location_name
       ${this.borrowCatalogBaseSql()}
         AND i.id = ?`,
      [id]
    );

    const item = rows[0] ? this.enrichBorrowCatalogItem(rows[0]) : null;
    return item?.is_borrowable ? item : null;
  },

  async getDistinctMaterials() {
    const [rows] = await pool.query(
      `SELECT DISTINCT material FROM inventory_items
       WHERE material IS NOT NULL AND material != '' AND is_archived = 0
       ORDER BY material`
    );
    return rows.map((row) => row.material);
  }

};

module.exports = InventoryModel;

