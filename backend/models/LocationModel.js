const pool = require('../config/database');
const { archiveRecord } = require('../utils/archiveService');

const LocationModel = {
  async getAll() {
    const [rows] = await pool.query('SELECT * FROM locations WHERE is_archived = 0 ORDER BY name');
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM locations WHERE id = ? AND is_archived = 0', [id]);
    return rows[0] || null;
  },

  async create(data) {
    const [result] = await pool.query(
      'INSERT INTO locations (name, description) VALUES (?, ?)',
      [data.name, data.description || null]
    );
    return result.insertId;
  },

  async update(id, data) {
    const [result] = await pool.query(
      'UPDATE locations SET name = ?, description = ? WHERE id = ? AND is_archived = 0',
      [data.name, data.description || null, id]
    );
    return result.affectedRows > 0;
  },

  async archive(id, userId) {
    return archiveRecord('locations', id, userId);
  }
};

module.exports = LocationModel;
