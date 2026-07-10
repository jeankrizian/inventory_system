const pool = require('../config/database');
const { generateCode } = require('../utils/helpers');
const { appendInventoryScopeSql } = require('../utils/roleHelpers');
const { appendDateRangeSql } = require('../utils/reportFilters');
const { appendInventoryItemFieldFilters } = require('../utils/inventoryReportFilterSql');

const DisposalModel = {
  async getAll(filters = {}) {
    let sql = `
      SELECT d.*, i.item_code, i.item_name, u.full_name AS requested_by_name,
             ins.full_name AS inspected_by_name, app.full_name AS approved_by_name
      FROM disposal_requests d
      JOIN inventory_items i ON d.inventory_item_id = i.id
      LEFT JOIN departments dept ON i.department_id = dept.id
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      JOIN users u ON d.requested_by = u.id
      LEFT JOIN users ins ON d.inspected_by = ins.id
      LEFT JOIN users app ON d.approved_by = app.id
      WHERE 1=1`;
    const params = [];
    if (filters.status) { sql += ' AND d.status LIKE ?'; params.push(`%${filters.status}%`); }
    sql += appendInventoryItemFieldFilters(filters, 'i', params, { supplierAlias: 's', departmentAlias: 'dept' });
    if (filters.transaction_code) { sql += ' AND d.transaction_code LIKE ?'; params.push(`%${filters.transaction_code}%`); }
    if (filters.disposal_method) { sql += ' AND d.disposal_method LIKE ?'; params.push(`%${filters.disposal_method}%`); }
    if (filters.requested_by_name) { sql += ' AND u.full_name LIKE ?'; params.push(`%${filters.requested_by_name}%`); }
    if (filters.reason) { sql += ' AND d.reason LIKE ?'; params.push(`%${filters.reason}%`); }
    if (filters.search) {
      sql += ' AND (d.transaction_code LIKE ? OR i.item_name LIKE ? OR i.item_code LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }
    sql += appendDateRangeSql(filters, 'DATE(d.created_at)', params);
    const scopeFilter = appendInventoryScopeSql(filters.scope, 'i');
    if (scopeFilter.denied) return [];
    sql += scopeFilter.clause;
    params.push(...scopeFilter.params);
    sql += ' ORDER BY d.created_at DESC';
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT d.*, i.item_code, i.item_name, i.property_tag, i.unit, i.brand, i.model,
              i.department_id, dept.name AS department_name,
              u.full_name AS requested_by_name,
              ins.full_name AS inspected_by_name,
              app.full_name AS approved_by_name
       FROM disposal_requests d
       JOIN inventory_items i ON d.inventory_item_id = i.id
       JOIN users u ON d.requested_by = u.id
       LEFT JOIN departments dept ON i.department_id = dept.id
       LEFT JOIN users ins ON d.inspected_by = ins.id
       LEFT JOIN users app ON d.approved_by = app.id
       WHERE d.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  async create(data) {
    const code = generateCode('DSP');
    const [result] = await pool.query(
      `INSERT INTO disposal_requests
       (transaction_code, inventory_item_id, quantity, reason, status, requested_by, notes)
       VALUES (?, ?, ?, ?, 'Pending', ?, ?)`,
      [code, data.inventory_item_id, data.quantity || 1, data.reason, data.requested_by, data.notes || null]
    );
    return { id: result.insertId, transaction_code: code };
  },

  async inspect(id, userId, inspectionNotes) {
    await pool.query(
      `UPDATE disposal_requests SET status = 'Inspected', inspected_by = ?, inspection_notes = ? WHERE id = ?`,
      [userId, inspectionNotes, id]
    );
  },

  async updateStatus(id, status, approvedBy, extra = {}) {
    await pool.query(
      `UPDATE disposal_requests SET status = ?, approved_by = ?,
        disposal_method = COALESCE(?, disposal_method), disposal_date = COALESCE(?, disposal_date),
        notes = COALESCE(?, notes) WHERE id = ?`,
      [status, approvedBy, extra.disposal_method, extra.disposal_date, extra.notes, id]
    );
  },

  async countPending(scope) {
    let sql = `SELECT COUNT(*) AS count FROM disposal_requests d
      JOIN inventory_items i ON d.inventory_item_id = i.id
      WHERE d.status IN ('Pending', 'Inspected')`;
    const params = [];
    const scopeFilter = appendInventoryScopeSql(scope, 'i');
    if (scopeFilter.denied) return 0;
    sql += scopeFilter.clause;
    params.push(...scopeFilter.params);
    const [rows] = await pool.query(sql, params);
    return rows[0].count;
  }
};

module.exports = DisposalModel;
