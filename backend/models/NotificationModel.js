const pool = require('../config/database');

const NotificationModel = {
  async create({ user_id, title, message, type, reference_id = null, link_url = null }) {
    const [result] = await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, reference_id, link_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, title, message, type, reference_id, link_url]
    );
    return result.insertId;
  },

  async getByUser(userId, limit = 50) {
    const [rows] = await pool.query(
      `SELECT id, user_id, title, message, type, reference_id, link_url, is_read, created_at, updated_at
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      [userId, limit]
    );
    return rows;
  },

  async getUnreadCount(userId) {
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    return rows[0].count;
  },

  async markAsRead(id, userId) {
    const [result] = await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.affectedRows > 0;
  },

  async markAllAsRead(userId) {
    await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    return true;
  },

  async hasRecent(userId, type, referenceId, hours = 24) {
    const [rows] = await pool.query(
      `SELECT id FROM notifications
       WHERE user_id = ? AND type = ? AND reference_id <=> ?
         AND created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
       LIMIT 1`,
      [userId, type, referenceId, hours]
    );
    return rows.length > 0;
  }
};

module.exports = NotificationModel;
