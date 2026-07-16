const pool = require('../config/database');

const PasswordResetOtpModel = {
  async invalidateActiveForUser(userId) {
    await pool.query(
      `UPDATE password_reset_otps
       SET used_at = NOW()
       WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW()`,
      [userId]
    );
  },

  async create(userId, otpHash, expiresAt) {
    await this.invalidateActiveForUser(userId);
    const [result] = await pool.query(
      `INSERT INTO password_reset_otps (user_id, otp_hash, expires_at)
       VALUES (?, ?, ?)`,
      [userId, otpHash, expiresAt]
    );
    return result.insertId;
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM password_reset_otps WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async findLatestActive(userId) {
    const [rows] = await pool.query(
      `SELECT * FROM password_reset_otps
       WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  },

  async incrementAttempts(id) {
    await pool.query('UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?', [id]);
  },

  async markUsed(id) {
    await pool.query(
      `UPDATE password_reset_otps SET used_at = NOW(), password_reset_at = NOW() WHERE id = ?`,
      [id]
    );
  },

  async countRecentRequests(userId, minutes) {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS count FROM password_reset_otps
       WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [userId, minutes]
    );
    return rows[0].count;
  }
};

module.exports = PasswordResetOtpModel;
