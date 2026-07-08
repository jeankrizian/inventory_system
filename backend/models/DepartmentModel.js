const pool = require('../config/database');
const { archiveRecord } = require('../utils/archiveService');

const DepartmentModel = {
  async getAll(filters = {}) {
    let sql = 'SELECT * FROM departments WHERE is_archived = 0';
    const params = [];

    if (filters.active_only) {
      sql += " AND status = 'Active'";
    }
    if (filters.search) {
      sql += ' AND (name LIKE ? OR code LIKE ? OR description LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY name';
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM departments WHERE id = ? AND is_archived = 0', [id]);
    return rows[0] || null;
  },

  async create(data) {
    const [result] = await pool.query(
      `INSERT INTO departments (name, code, description, department_head, custodian_id, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.name, data.code, data.description || null, data.department_head || null,
        data.custodian_id || null, data.status || 'Active']
    );
    return result.insertId;
  },

  async update(id, data) {
    const [result] = await pool.query(
      `UPDATE departments SET name = ?, code = ?, description = ?, department_head = ?,
        custodian_id = ?, status = ? WHERE id = ?`,
      [data.name, data.code, data.description || null, data.department_head || null,
        data.custodian_id || null, data.status || 'Active', id]
    );
    return result.affectedRows > 0;
  },

  async archive(id, userId) {
    return archiveRecord('departments', id, userId);
  },

  async delete(id, userId) {
    return this.archive(id, userId);
  },

  async count() {
    const [rows] = await pool.query('SELECT COUNT(*) AS count FROM departments WHERE is_archived = 0');
    return rows[0].count;
  }
};

module.exports = DepartmentModel;
