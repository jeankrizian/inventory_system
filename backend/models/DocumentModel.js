const pool = require('../config/database');

const DocumentModel = {
  async create(data) {
    const [result] = await pool.query(
      `INSERT INTO document_history
       (document_type, document_number, related_module, related_transaction_id, generated_by, payload, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.document_type,
        data.document_number,
        data.related_module || null,
        data.related_transaction_id || null,
        data.generated_by || null,
        JSON.stringify(data.payload),
        data.status || 'Generated'
      ]
    );
    return result.insertId;
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT d.*, u.full_name AS generated_by_name
       FROM document_history d
       LEFT JOIN users u ON d.generated_by = u.id
       WHERE d.id = ?`,
      [id]
    );
    const row = rows[0];
    if (!row) return null;
    if (typeof row.payload === 'string') row.payload = JSON.parse(row.payload);
    return row;
  },

  async findByTransaction(documentType, relatedModule, relatedTransactionId) {
    const [rows] = await pool.query(
      `SELECT d.*, u.full_name AS generated_by_name
       FROM document_history d
       LEFT JOIN users u ON d.generated_by = u.id
       WHERE d.document_type = ? AND d.related_module = ? AND d.related_transaction_id = ?
       ORDER BY d.generated_at DESC LIMIT 1`,
      [documentType, relatedModule, relatedTransactionId]
    );
    const row = rows[0];
    if (!row) return null;
    if (typeof row.payload === 'string') row.payload = JSON.parse(row.payload);
    return row;
  },

  async updatePayload(id, payload, status = 'Updated') {
    await pool.query(
      `UPDATE document_history SET payload = ?, status = ? WHERE id = ?`,
      [JSON.stringify(payload), status, id]
    );
  },

  async getAll(filters = {}) {
    let sql = `
      SELECT d.*, u.full_name AS generated_by_name
      FROM document_history d
      LEFT JOIN users u ON d.generated_by = u.id
      WHERE 1=1`;
    const params = [];

    if (filters.document_type) {
      sql += ' AND d.document_type = ?';
      params.push(filters.document_type);
    }
    if (filters.search) {
      sql += ' AND (d.document_number LIKE ? OR d.related_module LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term);
    }

    sql += ' ORDER BY d.generated_at DESC';
    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(filters.limit, 10));
    }

    const [rows] = await pool.query(sql, params);
    return rows.map(row => {
      if (typeof row.payload === 'string') {
        try { row.payload = JSON.parse(row.payload); } catch { row.payload = {}; }
      }
      return row;
    });
  }
};

module.exports = DocumentModel;
