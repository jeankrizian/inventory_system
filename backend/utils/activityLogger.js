const pool = require('../config/database');

/**
 * Log user activity to activity_logs table
 */
async function logActivity(userId, action, module, description, ipAddress = null) {
  try {
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, module, description, ip_address) VALUES (?, ?, ?, ?, ?)',
      [userId, action, module, description, ipAddress]
    );
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
}

module.exports = { logActivity };
