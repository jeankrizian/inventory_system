const pool = require('../config/database');
const { archiveRecord } = require('../utils/archiveService');
const {
  queryWithOptionalPagination
} = require('../utils/listPagination');

function buildSupplierListParts(filters = {}) {
  let whereSql = ' WHERE is_archived = 0';
  const params = [];
  if (filters.name) { whereSql += ' AND name LIKE ?'; params.push(`%${filters.name}%`); }
  if (filters.contact_person) { whereSql += ' AND contact_person LIKE ?'; params.push(`%${filters.contact_person}%`); }
  if (filters.phone) { whereSql += ' AND phone LIKE ?'; params.push(`%${filters.phone}%`); }
  if (filters.email) { whereSql += ' AND email LIKE ?'; params.push(`%${filters.email}%`); }
  if (filters.address) { whereSql += ' AND address LIKE ?'; params.push(`%${filters.address}%`); }
  const joins = ' FROM suppliers';
  return { joins, whereSql, params };
}

const SupplierModel = {
  async getAll(filters = {}) {
    const { joins, whereSql, params } = buildSupplierListParts(filters);
    const selectSql = `SELECT * ${joins}${whereSql}`;
    const countSql = `SELECT COUNT(*) AS total ${joins}${whereSql}`;
    return queryWithOptionalPagination(pool, {
      selectSql,
      countSql,
      params,
      orderBy: 'ORDER BY name',
      filters
    });
  },

  async getReportAggregates(filters = {}) {
    const { joins, whereSql, params } = buildSupplierListParts(filters);
    const [countRows] = await pool.query(`SELECT COUNT(*) AS total ${joins}${whereSql}`, params);
    return {
      total: Number(countRows[0]?.total || 0),
      status_breakdown: {},
      department_breakdown: {}
    };
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
