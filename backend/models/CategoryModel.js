const pool = require('../config/database');
const { archiveRecord } = require('../utils/archiveService');

function generateCode(name) {
  const base = (name || 'DEPT').replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase();
  return base || 'DEPT';
}

function mapRow(row) {
  if (!row) return null;
  return {
    ...row,
    category_id: row.id,
    category_name: row.name
  };
}

const CategoryModel = {
  async getAll() {
    const [rows] = await pool.query(
      `SELECT d.*, u.full_name AS custodian_name
       FROM departments d
       LEFT JOIN users u ON d.custodian_id = u.id
       WHERE d.is_archived = 0
       ORDER BY d.name`
    );
    return rows.map(mapRow);
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT d.*, u.full_name AS custodian_name
       FROM departments d
       LEFT JOIN users u ON d.custodian_id = u.id
       WHERE d.id = ? AND d.is_archived = 0`,
      [id]
    );
    return mapRow(rows[0]);
  },

  async create(data) {
    let code = data.code || generateCode(data.name);
    const [existing] = await pool.query('SELECT id FROM departments WHERE code = ? AND is_archived = 0', [code]);
    if (existing.length) code = `${code}${Date.now().toString().slice(-4)}`;

    const [result] = await pool.query(
      `INSERT INTO departments (name, code, description, department_head, custodian_id, custodian_type, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        code,
        data.description || null,
        data.department_head || null,
        data.custodian_id || null,
        data.custodian_type || null,
        data.status || 'Active'
      ]
    );
    return result.insertId;
  },

  async update(id, data) {
    const existing = await this.findById(id);
    if (!existing) return false;

    const [result] = await pool.query(
      `UPDATE departments SET name = ?, code = ?, description = ?, department_head = ?,
        custodian_id = ?, custodian_type = ?, status = COALESCE(?, status)
       WHERE id = ? AND is_archived = 0`,
      [
        data.name ?? existing.name,
        data.code ?? existing.code,
        data.description ?? existing.description,
        data.department_head ?? existing.department_head,
        data.custodian_id !== undefined ? data.custodian_id : existing.custodian_id,
        data.custodian_type ?? existing.custodian_type,
        data.status,
        id
      ]
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

module.exports = CategoryModel;
