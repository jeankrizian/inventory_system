const pool = require('../config/database');
const { computeItemStatus } = require('../utils/helpers');
const { appendInventoryScopeSql, isInventoryScopeDenied } = require('../utils/roleHelpers');
const { generateNextItemCode } = require('../utils/itemCodeGenerator');
const { isItemAvailableForBorrow, getItemUnavailableReason } = require('../utils/itemAvailability');
const { appendDateRangeSql } = require('../utils/reportFilters');

const EMPTY_INVENTORY_STATS = {
  total_items: 0,
  available_items: 0,
  borrowed_items: 0,
  low_stock: 0,
  under_maintenance: 0,
  disposed: 0
};

function normalizeInventoryStats(row = {}) {
  return {
    total_items: Number(row.total_items ?? 0),
    available_items: Number(row.available_items ?? 0),
    borrowed_items: Number(row.borrowed_items ?? 0),
    low_stock: Number(row.low_stock ?? 0),
    under_maintenance: Number(row.under_maintenance ?? 0),
    disposed: Number(row.disposed ?? 0)
  };
}

function mapItem(row) {

  if (!row) return null;

  return {

    ...row,

    category_id: row.department_id,

    category_name: row.department_name

  };

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



    if (filters.search) {

      sql += ` AND (i.item_code LIKE ? OR i.item_name LIKE ? OR i.brand LIKE ? OR i.model LIKE ? OR i.property_tag LIKE ?)`;

      const term = `%${filters.search}%`;

      params.push(term, term, term, term, term);

    }

    if (filters.department_id) {

      sql += ' AND i.department_id = ?';

      params.push(filters.department_id);

    }

    if (filters.asset_classification) {

      sql += ' AND i.asset_classification = ?';

      params.push(filters.asset_classification);

    }

    if (filters.status) {

      sql += ' AND i.status = ?';

      params.push(filters.status);

    }

    if (filters.location_id) {

      sql += ' AND i.location_id = ?';

      params.push(filters.location_id);

    }

    if (filters.parent_asset_id) {

      sql += ' AND i.parent_asset_id = ?';

      params.push(filters.parent_asset_id);

    }

    if (filters.low_stock) {

      sql += ' AND i.available_quantity <= i.low_stock_threshold AND i.status != \'Disposed\'';

    }

    sql += appendDateRangeSql(filters, 'COALESCE(i.acquisition_date, DATE(i.created_at))', params);

    const scopeFilter = appendInventoryScopeSql(filters.scope, 'i');
    if (scopeFilter.denied) {
      return [];
    }
    sql += scopeFilter.clause;
    params.push(...scopeFilter.params);

    sql += ' ORDER BY i.item_name ASC';

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



  async create(data) {

    const status = data.status || computeItemStatus(data.available_quantity, data.quantity, data.low_stock_threshold || 5);

    const [result] = await pool.query(

      `INSERT INTO inventory_items 

       (item_code, item_name, description, department_id, asset_classification, material, property_tag, custodian_id, custodian_type,

        parent_asset_id, brand, model, quantity, available_quantity, unit,

        supplier_id, purchase_date, acquisition_date, purchase_request_number, purchase_order_number,

        invoice_number, unit_cost, acquisition_cost, \`condition\`, status, location_id, low_stock_threshold,

        maintenance_schedule, next_maintenance_date, maintenance_status, service_provider)

       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

      [

        data.item_code, data.item_name,

        data.description || null,

        data.department_id,

        data.asset_classification || 'Consumable',

        data.material || null,

        data.property_tag || null,

        data.custodian_id || null,

        data.custodian_type || null,

        data.parent_asset_id || null,

        data.brand || null, data.model || null,

        data.quantity, data.available_quantity ?? data.quantity, data.unit || 'pcs',

        data.supplier_id || null,

        data.purchase_date || null,

        data.acquisition_date || data.purchase_date || null,

        data.purchase_request_number || null,

        data.purchase_order_number || null,

        data.invoice_number || null,

        data.unit_cost ?? null,

        data.acquisition_cost ?? null,

        data.condition || 'Good',

        status,

        data.location_id || null,

        data.low_stock_threshold || 5,

        data.maintenance_schedule || null,

        data.next_maintenance_date || null,

        data.maintenance_status || null,

        data.service_provider || null

      ]

    );

    return result.insertId;

  },



  async update(id, data) {

    const existing = await this.findById(id);

    if (!existing) return false;



    const qty = data.quantity ?? existing.quantity;

    const avail = data.available_quantity ?? existing.available_quantity;

    const threshold = data.low_stock_threshold ?? existing.low_stock_threshold;

    const status = data.status ?? computeItemStatus(avail, qty, threshold);



    await pool.query(

      `UPDATE inventory_items SET

        item_code = ?, item_name = ?, description = ?, department_id = ?, asset_classification = ?, material = ?,

        property_tag = ?, custodian_id = ?, custodian_type = ?, parent_asset_id = ?,

        brand = ?, model = ?, quantity = ?, available_quantity = ?, unit = ?, supplier_id = ?,

        purchase_date = ?, acquisition_date = ?, purchase_request_number = ?, purchase_order_number = ?,

        invoice_number = ?, unit_cost = ?, acquisition_cost = ?, \`condition\` = ?, status = ?, location_id = ?,

        low_stock_threshold = ?, maintenance_schedule = ?, next_maintenance_date = ?,

        maintenance_status = ?, service_provider = ?

       WHERE id = ?`,

      [

        data.item_code ?? existing.item_code,

        data.item_name ?? existing.item_name,

        data.description !== undefined ? (data.description || null) : existing.description,

        data.department_id ?? existing.department_id,

        data.asset_classification ?? existing.asset_classification,

        data.material !== undefined ? (data.material || null) : existing.material,

        data.property_tag !== undefined ? data.property_tag : existing.property_tag,

        data.custodian_id !== undefined ? data.custodian_id : existing.custodian_id,

        data.custodian_type ?? existing.custodian_type,

        data.parent_asset_id !== undefined ? data.parent_asset_id : existing.parent_asset_id,

        data.brand ?? existing.brand,

        data.model ?? existing.model,

        qty, avail,

        data.unit ?? existing.unit,

        data.supplier_id !== undefined ? data.supplier_id : existing.supplier_id,

        data.purchase_date ?? existing.purchase_date,

        data.acquisition_date ?? existing.acquisition_date,

        data.purchase_request_number !== undefined ? data.purchase_request_number : existing.purchase_request_number,

        data.purchase_order_number !== undefined ? data.purchase_order_number : existing.purchase_order_number,

        data.invoice_number !== undefined ? data.invoice_number : existing.invoice_number,

        data.unit_cost !== undefined ? data.unit_cost : existing.unit_cost,

        data.acquisition_cost !== undefined ? data.acquisition_cost : existing.acquisition_cost,

        data.condition ?? existing.condition,

        status,

        data.location_id !== undefined ? data.location_id : existing.location_id,

        threshold,

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
    const [rows] = await pool.query(`
      SELECT
        COUNT(*) AS total_items,
        COALESCE(SUM(CASE WHEN i.status != 'Disposed' THEN i.available_quantity ELSE 0 END), 0) AS available_items,
        COALESCE(SUM(CASE WHEN i.status != 'Disposed' THEN i.quantity - i.available_quantity ELSE 0 END), 0) AS borrowed_items,
        COALESCE(SUM(CASE WHEN i.status != 'Disposed' AND i.available_quantity <= i.low_stock_threshold THEN 1 ELSE 0 END), 0) AS low_stock,
        COALESCE(SUM(CASE WHEN i.status = 'Under Maintenance' THEN 1 ELSE 0 END), 0) AS under_maintenance,
        COALESCE(SUM(CASE WHEN i.status = 'Disposed' THEN 1 ELSE 0 END), 0) AS disposed
      FROM inventory_items i
      WHERE i.is_archived = 0${scopeFilter.clause}
    `, scopeFilter.params);
    return normalizeInventoryStats(rows[0]);
  },

  async getRecent(limit = 5, scope) {
    if (isInventoryScopeDenied(scope)) {
      return [];
    }
    const scopeFilter = appendInventoryScopeSql(scope, 'i');
    if (scopeFilter.denied) {
      return [];
    }
    const [rows] = await pool.query(
      `SELECT i.item_code, i.item_name, d.name AS department, d.name AS category, i.quantity, i.status
       FROM inventory_items i
       LEFT JOIN departments d ON i.department_id = d.id
       WHERE i.is_archived = 0${scopeFilter.clause}
       ORDER BY i.updated_at DESC LIMIT ?`,
      [...scopeFilter.params, limit]
    );
    return rows || [];
  },

  async getLowStock(limit = 5, scope) {
    if (isInventoryScopeDenied(scope)) {
      return [];
    }
    const scopeFilter = appendInventoryScopeSql(scope, 'i');
    if (scopeFilter.denied) {
      return [];
    }
    const [rows] = await pool.query(
      `SELECT i.id, i.item_code, i.item_name, i.available_quantity, i.low_stock_threshold,
              d.name AS department, d.name AS category
       FROM inventory_items i
       LEFT JOIN departments d ON i.department_id = d.id
       WHERE i.available_quantity <= i.low_stock_threshold AND i.status != 'Disposed' AND i.is_archived = 0${scopeFilter.clause}
       ORDER BY i.available_quantity ASC LIMIT ?`,
      [...scopeFilter.params, limit]
    );
    return rows || [];
  },

  async getDepartmentDistribution(scope) {
    if (isInventoryScopeDenied(scope)) {
      return [];
    }
    const scopeFilter = appendInventoryScopeSql(scope, 'i');
    if (scopeFilter.denied) {
      return [];
    }
    const [rows] = await pool.query(`
      SELECT d.name AS department, d.name AS category, COUNT(i.id) AS count
      FROM departments d
      LEFT JOIN inventory_items i ON d.id = i.department_id AND i.is_archived = 0 AND i.status != 'Disposed'
      WHERE 1=1${scopeFilter.clause}
      GROUP BY d.id, d.name
      ORDER BY count DESC
    `, scopeFilter.params);
    return rows || [];
  },



  async adjustQuantity(id, delta) {

    const item = await this.findById(id);

    if (!item || item.status === 'Disposed') return false;

    const newAvail = item.available_quantity + delta;

    if (newAvail < 0 || newAvail > item.quantity) return false;

    const status = computeItemStatus(newAvail, item.quantity, item.low_stock_threshold);

    await pool.query(

      'UPDATE inventory_items SET available_quantity = ?, status = ? WHERE id = ?',

      [newAvail, status, id]

    );

    return true;

  },



  async updateLocationAndDepartment(id, { location_id, department_id, custodian_id, custodian_type }) {
    const fields = ['location_id = ?', 'department_id = ?'];
    const params = [location_id, department_id];
    if (custodian_id !== undefined) {
      fields.push('custodian_id = ?');
      params.push(custodian_id);
    }
    if (custodian_type !== undefined) {
      fields.push('custodian_type = ?');
      params.push(custodian_type);
    }
    params.push(id);
    await pool.query(
      `UPDATE inventory_items SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
  },



  async markDisposed(id, quantity) {

    const item = await this.findById(id);

    if (!item) return false;

    const newQty = Math.max(0, item.quantity - quantity);

    const newAvail = Math.max(0, item.available_quantity - quantity);

    const status = newQty === 0 ? 'Disposed' : computeItemStatus(newAvail, newQty, item.low_stock_threshold);

    await pool.query(

      'UPDATE inventory_items SET quantity = ?, available_quantity = ?, status = ? WHERE id = ?',

      [newQty, newAvail, status, id]

    );

    return true;

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

  async getBorrowableItems(search = '') {
    let sql = `SELECT i.id, i.item_code, i.item_name, i.available_quantity, i.status, i.asset_classification,
              d.name AS department_name, l.name AS location_name
       ${this.borrowCatalogBaseSql()}`;

    const params = [];

    if (search && search.trim()) {
      sql += ' AND i.item_name LIKE ?';
      params.push(`%${search.trim()}%`);
    }

    sql += ` ORDER BY CASE
      WHEN i.available_quantity > 0
        AND i.status NOT IN ('Unavailable', 'Out of Stock', 'Under Maintenance', 'Disposed') THEN 0
      ELSE 1
    END ASC, i.item_name ASC`;

    const [rows] = await pool.query(sql, params);

    return rows.map((row) => this.enrichBorrowCatalogItem(row));
  },

  async findBorrowableById(id) {
    const [rows] = await pool.query(
      `SELECT i.id, i.item_code, i.item_name, i.available_quantity, i.status, i.asset_classification,
              d.name AS department_name, l.name AS location_name
       ${this.borrowCatalogBaseSql()}
         AND i.id = ?`,
      [id]
    );

    const item = rows[0] ? this.enrichBorrowCatalogItem(rows[0]) : null;
    return item?.is_borrowable ? item : null;
  }

};

module.exports = InventoryModel;

