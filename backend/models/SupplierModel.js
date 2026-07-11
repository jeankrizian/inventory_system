const pool = require('../config/database');
const { archiveRecord } = require('../utils/archiveService');

const SupplierModel = {
  async getAll(filters = {}) {
    let sql = 'SELECT * FROM suppliers WHERE is_archived = 0';
    const params = [];
    if (filters.name) { sql += ' AND name LIKE ?'; params.push(`%${filters.name}%`); }
    if (filters.contact_person) { sql += ' AND contact_person LIKE ?'; params.push(`%${filters.contact_person}%`); }
    if (filters.phone) { sql += ' AND phone LIKE ?'; params.push(`%${filters.phone}%`); }
    if (filters.email) { sql += ' AND email LIKE ?'; params.push(`%${filters.email}%`); }
    if (filters.address) { sql += ' AND address LIKE ?'; params.push(`%${filters.address}%`); }
    sql += ' ORDER BY name';
    const [rows] = await pool.query(sql, params);
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

  async count() {
    const [rows] = await pool.query('SELECT COUNT(*) AS count FROM suppliers WHERE is_archived = 0');
    return rows[0].count;
  }
};

module.exports = SupplierModel;
