const pool = require('../config/database');
const { generateCode } = require('../utils/helpers');
const { appendInventoryScopeSql } = require('../utils/roleHelpers');
const { appendDateRangeSql } = require('../utils/reportFilters');

const MaintenanceModel = {
  _baseSelect() {
    return `
      SELECT m.*, i.item_code, i.item_name, i.property_tag, i.location_id,
             d.name AS department_name, l.name AS location_name,
             ru.full_name AS requested_by_name, au.full_name AS approved_by_name,
             pu.full_name AS performed_by_name
      FROM maintenance_records m
      JOIN inventory_items i ON m.inventory_item_id = i.id
      LEFT JOIN departments d ON i.department_id = d.id
      LEFT JOIN locations l ON i.location_id = l.id
      LEFT JOIN users ru ON m.requested_by = ru.id
      LEFT JOIN users au ON m.approved_by = au.id
      LEFT JOIN users pu ON m.performed_by = pu.id`;
  },

  async getAll(filters = {}) {
    let sql = `${this._baseSelect()} WHERE 1=1`;
    const params = [];
    if (filters.inventory_item_id) { sql += ' AND m.inventory_item_id = ?'; params.push(filters.inventory_item_id); }
    if (filters.status) { sql += ' AND m.status = ?'; params.push(filters.status); }
    if (filters.search) {
      sql += ' AND (m.transaction_code LIKE ? OR i.item_name LIKE ? OR i.item_code LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }
    if (filters.department_id) {
      sql += ' AND i.department_id = ?';
      params.push(filters.department_id);
    }
    sql += appendDateRangeSql(filters, 'm.scheduled_date', params);
    const scopeFilter = appendInventoryScopeSql(filters.scope, 'i');
    if (scopeFilter.denied) {
      return [];
    }
    sql += scopeFilter.clause;
    params.push(...scopeFilter.params);
    sql += ' ORDER BY m.created_at DESC';
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.query(`${this._baseSelect()} WHERE m.id = ?`, [id]);
    return rows[0] || null;
  },

  async getByAsset(inventoryItemId) {
    return this.getAll({ inventory_item_id: inventoryItemId });
  },

  async create(data) {
    const code = generateCode('MNT');
    const [result] = await pool.query(
      `INSERT INTO maintenance_records
       (transaction_code, inventory_item_id, requested_by, requested_date, reported_problem,
        maintenance_type, priority, scheduled_date, service_provider, status, description,
        next_maintenance_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?)`,
      [
        code,
        data.inventory_item_id,
        data.requested_by,
        data.requested_date || new Date().toISOString().split('T')[0],
        data.reported_problem || data.description || null,
        data.maintenance_type || 'Preventive',
        data.priority || 'Medium',
        data.scheduled_date,
        data.service_provider || data.technician || null,
        data.description || null,
        data.next_maintenance_date || null,
        data.notes || data.description || null
      ]
    );
    return { id: result.insertId, transaction_code: code };
  },

  async approve(id, userId, remarks) {
    await pool.query(
      `UPDATE maintenance_records SET status = 'Approved', approved_by = ?, approved_at = NOW(),
        admin_remarks = COALESCE(?, admin_remarks) WHERE id = ? AND status = 'Pending'`,
      [userId, remarks, id]
    );
  },

  async reject(id, userId, reason) {
    await pool.query(
      `UPDATE maintenance_records SET status = 'Cancelled', approved_by = ?, approved_at = NOW(),
        rejection_reason = ? WHERE id = ? AND status = 'Pending'`,
      [userId, reason, id]
    );
  },

  async reschedule(id, data) {
    await pool.query(
      `UPDATE maintenance_records SET status = 'Scheduled', scheduled_date = ?,
        technician = COALESCE(?, technician), service_provider = COALESCE(?, service_provider),
        admin_remarks = COALESCE(?, admin_remarks) WHERE id = ?`,
      [data.scheduled_date, data.technician, data.technician, data.admin_remarks, id]
    );
  },

  async start(id, data) {
    await pool.query(
      `UPDATE maintenance_records SET status = 'Ongoing', technician = COALESCE(?, technician),
        service_provider = COALESCE(?, service_provider) WHERE id = ?`,
      [data.technician, data.technician, id]
    );
    const record = await this.findById(id);
    if (record) {
      await pool.query(
        `UPDATE inventory_items SET status = 'Under Maintenance', maintenance_status = 'In Progress' WHERE id = ?`,
        [record.inventory_item_id]
      );
    }
  },

  async complete(id, data) {
    await pool.query(
      `UPDATE maintenance_records SET status = 'Completed', completed_date = ?,
        performed_by = ?, completion_remarks = COALESCE(?, completion_remarks),
        service_provider = COALESCE(?, service_provider), cost = ?,
        next_maintenance_date = COALESCE(?, next_maintenance_date) WHERE id = ?`,
      [
        data.completed_date,
        data.performed_by,
        data.completion_remarks,
        data.service_provider,
        data.cost || null,
        data.next_maintenance_date,
        id
      ]
    );
    const record = await this.findById(id);
    if (record) {
      await pool.query(
        `UPDATE inventory_items SET maintenance_status = 'Completed',
         next_maintenance_date = COALESCE(?, next_maintenance_date),
         status = CASE WHEN available_quantity > 0 THEN 'Available' ELSE status END
         WHERE id = ?`,
        [data.next_maintenance_date, record.inventory_item_id]
      );
    }
  },

  async countByStatus(status, scope) {
    const scopeFilter = appendInventoryScopeSql(scope, 'i');
    if (scopeFilter.denied) {
      return 0;
    }
    let sql = `SELECT COUNT(*) AS count FROM maintenance_records m
      JOIN inventory_items i ON m.inventory_item_id = i.id
      WHERE m.status = ?`;
    const params = [status];
    sql += scopeFilter.clause;
    params.push(...scopeFilter.params);
    const [rows] = await pool.query(sql, params);
    return Number(rows[0]?.count ?? 0);
  },

  async countPending(scope) {
    return this.countByStatus('Pending', scope);
  },

  async countOngoing(scope) {
    const scopeFilter = appendInventoryScopeSql(scope, 'i');
    if (scopeFilter.denied) {
      return 0;
    }
    let sql = `SELECT COUNT(*) AS count FROM maintenance_records m
      JOIN inventory_items i ON m.inventory_item_id = i.id
      WHERE m.status IN ('Ongoing', 'In Progress')`;
    const params = [];
    sql += scopeFilter.clause;
    params.push(...scopeFilter.params);
    const [rows] = await pool.query(sql, params);
    return Number(rows[0]?.count ?? 0);
  },

  async countScheduled(scope) {
    return this.countByStatus('Scheduled', scope);
  },

  async getUpcomingOnItems() {
    const [rows] = await pool.query(
      `SELECT id, item_code, item_name, next_maintenance_date, maintenance_schedule, custodian_id
       FROM inventory_items
       WHERE next_maintenance_date IS NOT NULL
         AND next_maintenance_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
         AND status != 'Disposed' AND is_archived = 0`
    );
    return rows;
  },

  async countDue(scope) {
    const scopeFilter = appendInventoryScopeSql(scope, 'i');
    if (scopeFilter.denied) {
      return 0;
    }
    let sql = `SELECT COUNT(*) AS count FROM maintenance_records m
      JOIN inventory_items i ON m.inventory_item_id = i.id
      WHERE m.status IN ('Pending', 'Scheduled', 'Ongoing', 'In Progress')`;
    const params = [];
    sql += scopeFilter.clause;
    params.push(...scopeFilter.params);
    const [rows] = await pool.query(sql, params);
    return Number(rows[0]?.count ?? 0);
  }
};

module.exports = MaintenanceModel;
