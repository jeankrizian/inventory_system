const pool = require('../config/database');
const { generateCode } = require('../utils/helpers');
const { appendTransferRequestScopeSql } = require('../utils/roleHelpers');
const { appendDateRangeSql } = require('../utils/reportFilters');
const { appendInventoryItemFieldFilters, inventoryFieldFilters } = require('../utils/inventoryReportFilterSql');

const TransferModel = {
  async getAll(filters = {}) {
    let sql = `
      SELECT t.*, i.item_code, i.item_name, i.property_tag,
             u.full_name AS requested_by_name, a.full_name AS approved_by_name,
             fl.name AS from_location_name, tl.name AS to_location_name,
             fd.name AS from_department_name, td.name AS to_department_name
      FROM transfer_requests t
      JOIN inventory_items i ON t.inventory_item_id = i.id
      JOIN users u ON t.requested_by = u.id
      LEFT JOIN users a ON t.approved_by = a.id
      LEFT JOIN locations fl ON t.from_location_id = fl.id
      LEFT JOIN locations tl ON t.to_location_id = tl.id
      LEFT JOIN departments fd ON t.from_department_id = fd.id
      LEFT JOIN departments td ON t.to_department_id = td.id
      LEFT JOIN departments idpt ON i.department_id = idpt.id
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      WHERE 1=1`;
    const params = [];
    if (filters.status) { sql += ' AND t.status = ?'; params.push(filters.status); }
    sql += appendInventoryItemFieldFilters(inventoryFieldFilters(filters), 'i', params, { supplierAlias: 's', departmentAlias: 'idpt' });
    if (filters.transaction_code) { sql += ' AND t.transaction_code LIKE ?'; params.push(`%${filters.transaction_code}%`); }
    if (filters.from_department_name) { sql += ' AND fd.name LIKE ?'; params.push(`%${filters.from_department_name}%`); }
    if (filters.to_department_name) { sql += ' AND td.name LIKE ?'; params.push(`%${filters.to_department_name}%`); }
    if (filters.requested_by_name) { sql += ' AND u.full_name LIKE ?'; params.push(`%${filters.requested_by_name}%`); }
    if (filters.request_date) {
      sql += ' AND DATE(COALESCE(t.request_date, t.created_at)) = ?';
      params.push(filters.request_date);
    }
    if (filters.inventory_item_id) { sql += ' AND t.inventory_item_id = ?'; params.push(filters.inventory_item_id); }
    if (filters.search) {
      sql += ' AND (t.transaction_code LIKE ? OR i.item_name LIKE ? OR i.property_tag LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }
    sql += appendDateRangeSql(filters, 'COALESCE(t.request_date, DATE(t.created_at))', params);
    const scopeFilter = appendTransferRequestScopeSql(filters.scope, 'i', 't');
    if (scopeFilter.denied) {
      return [];
    }
    sql += scopeFilter.clause;
    params.push(...scopeFilter.params);
    sql += ' ORDER BY t.created_at DESC';
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT t.*, i.item_code, i.item_name, i.property_tag,
              u.full_name AS requested_by_name, a.full_name AS approved_by_name,
              fl.name AS from_location_name, tl.name AS to_location_name,
              fd.name AS from_department_name, td.name AS to_department_name
       FROM transfer_requests t
       JOIN inventory_items i ON t.inventory_item_id = i.id
       JOIN users u ON t.requested_by = u.id
       LEFT JOIN users a ON t.approved_by = a.id
       LEFT JOIN locations fl ON t.from_location_id = fl.id
       LEFT JOIN locations tl ON t.to_location_id = tl.id
       LEFT JOIN departments fd ON t.from_department_id = fd.id
       LEFT JOIN departments td ON t.to_department_id = td.id
       WHERE t.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  async findPendingByInventoryItem(inventoryItemId) {
    const [rows] = await pool.query(
      `SELECT id, transaction_code FROM transfer_requests
       WHERE inventory_item_id = ? AND status = 'Pending'
       ORDER BY id DESC
       LIMIT 1`,
      [inventoryItemId]
    );
    return rows[0] || null;
  },

  async create(data) {
    const code = generateCode('TRF');
    const requestDate = data.request_date || new Date().toISOString().split('T')[0];
    const [result] = await pool.query(
      `INSERT INTO transfer_requests
       (transaction_code, inventory_item_id, quantity, from_location_id, to_location_id,
        from_department_id, to_department_id, reason, status, requested_by, notes, request_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?)`,
      [
        code, data.inventory_item_id, data.quantity || 1,
        data.from_location_id || null, data.to_location_id || null,
        data.from_department_id || null, data.to_department_id || null,
        data.reason, data.requested_by, data.notes || null, requestDate
      ]
    );
    return { id: result.insertId, transaction_code: code };
  },

  async updateStatus(id, status, approvedBy, extra = {}, conn = pool) {
    await conn.query(
      `UPDATE transfer_requests SET status = ?, approved_by = ?, approved_at = NOW(),
        rejection_reason = COALESCE(?, rejection_reason), notes = COALESCE(?, notes) WHERE id = ?`,
      [status, approvedBy, extra.rejection_reason, extra.notes, id]
    );
  },

  async recordHistory(transfer, approvedBy, conn = pool) {
    await conn.query(
      `INSERT INTO transfer_history
       (transfer_request_id, inventory_item_id, from_department_id, to_department_id,
        from_location_id, to_location_id, reason, approved_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        transfer.id, transfer.inventory_item_id,
        transfer.from_department_id, transfer.to_department_id,
        transfer.from_location_id, transfer.to_location_id,
        transfer.reason, approvedBy
      ]
    );
  },

  async getHistoryByAsset(inventoryItemId) {
    const [rows] = await pool.query(
      `SELECT th.*, fd.name AS from_department_name, td.name AS to_department_name,
              fl.name AS from_location_name, tl.name AS to_location_name,
              u.full_name AS approved_by_name, t.transaction_code
       FROM transfer_history th
       JOIN transfer_requests t ON th.transfer_request_id = t.id
       LEFT JOIN departments fd ON th.from_department_id = fd.id
       LEFT JOIN departments td ON th.to_department_id = td.id
       LEFT JOIN locations fl ON th.from_location_id = fl.id
       LEFT JOIN locations tl ON th.to_location_id = tl.id
       LEFT JOIN users u ON th.approved_by = u.id
       WHERE th.inventory_item_id = ?
       ORDER BY th.transfer_date DESC`,
      [inventoryItemId]
    );
    return rows;
  },

  async countPending(scope) {
    const scopeFilter = appendTransferRequestScopeSql(scope, 'i', 't');
    if (scopeFilter.denied) {
      return 0;
    }
    let sql = `SELECT COUNT(*) AS count FROM transfer_requests t
      JOIN inventory_items i ON t.inventory_item_id = i.id
      WHERE t.status = 'Pending'`;
    const params = [];
    sql += scopeFilter.clause;
    params.push(...scopeFilter.params);
    const [rows] = await pool.query(sql, params);
    return Number(rows[0]?.count ?? 0);
  }
};

module.exports = TransferModel;
