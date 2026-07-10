const pool = require('../config/database');

const BackupModel = {
  async getAll() {
    const [rows] = await pool.query(
      `SELECT b.id, b.file_name, b.file_size, b.created_at,
              u.full_name AS created_by_name
       FROM database_backups b
       JOIN users u ON b.created_by = u.id
       ORDER BY b.created_at DESC`
    );
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT b.*, u.full_name AS created_by_name
       FROM database_backups b
       JOIN users u ON b.created_by = u.id
       WHERE b.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  async create({ fileName, fileSize, createdBy }) {
    const [result] = await pool.query(
      `INSERT INTO database_backups (file_name, file_size, created_by)
       VALUES (?, ?, ?)`,
      [fileName, fileSize, createdBy]
    );
    return this.findById(result.insertId);
  },

  async delete(id) {
    const [result] = await pool.query('DELETE FROM database_backups WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
};

module.exports = BackupModel;
