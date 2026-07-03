const pool = require('../config/database');
const { archiveRecord } = require('../utils/archiveService');

const SupplierModel = {
  async getAll() {
    const [rows] = await pool.query('SELECT * FROM suppliers WHERE is_archived = 0 ORDER BY name');
    return rows;
  },

  async search(term, limit = 10) {
    const like = `%${term}%`;
    const [rows] = await pool.query(
      `SELECT * FROM suppliers
       WHERE is_archived = 0 AND (name LIKE ? OR contact_person LIKE ? OR email LIKE ?)
       ORDER BY name LIMIT ?`,
      [like, like, like, limit]
    );
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM suppliers WHERE id = ? AND is_archived = 0', [id]);
    return rows[0] || null;
  },

  async create(data) {
    const [result] = await pool.query(
      'INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?)',
      [data.name, data.contact_person || null, data.phone || null, data.email || null, data.address || null]
    );
    return result.insertId;
  },

  async update(id, data) {
    const [result] = await pool.query(
      'UPDATE suppliers SET name = ?, contact_person = ?, phone = ?, email = ?, address = ? WHERE id = ? AND is_archived = 0',
      [data.name, data.contact_person || null, data.phone || null, data.email || null, data.address || null, id]
    );
    return result.affectedRows > 0;
  },

  async archive(id, userId) {
    return archiveRecord('suppliers', id, userId);
  },

  async delete(id, userId) {
    return this.archive(id, userId);
  },

  async count() {
    const [rows] = await pool.query('SELECT COUNT(*) AS count FROM suppliers WHERE is_archived = 0');
    return rows[0].count;
  }
};

module.exports = SupplierModel;
