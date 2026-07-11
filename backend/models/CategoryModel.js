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
    let code = (data.code || '').trim() || generateCode(data.name);
    const [existing] = await pool.query(
      'SELECT id FROM departments WHERE code = ? AND is_archived = 0',
      [code]
    );
    if (existing.length) {
      // Explicit codes must be unique; only auto-generated codes may be rewritten.
      if ((data.code || '').trim()) {
        const err = new Error('Department code already exists');
        err.code = 'ER_DUP_ENTRY';
        throw err;
      }
      code = `${code}${Date.now().toString().slice(-4)}`;
    }

    const [result] = await pool.query(
      `INSERT INTO departments (name, code, description, department_head, custodian_id, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        code,
        data.description || null,
        data.department_head || null,
        data.custodian_id || null,
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
        custodian_id = ?, status = COALESCE(?, status)
       WHERE id = ? AND is_archived = 0`,
      [
        data.name ?? existing.name,
        data.code ?? existing.code,
        data.description ?? existing.description,
        data.department_head ?? existing.department_head,
        data.custodian_id !== undefined ? data.custodian_id : existing.custodian_id,
        data.status,
        id
      ]
    );
    return result.affectedRows > 0;
  },

  async archive(id, userId) {
    return archiveRecord('departments', id, userId);
  }
};

module.exports = CategoryModel;
