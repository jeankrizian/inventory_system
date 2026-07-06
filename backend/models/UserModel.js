const pool = require('../config/database');
const { archiveRecord } = require('../utils/archiveService');
const { resolveRoleDbName } = require('../utils/roleHelpers');

const USER_SELECT = `
  u.id, u.username, u.email, u.full_name, u.profile_image, u.is_active,
  u.last_login, u.created_at, u.role_id, u.assigned_department_id, u.assigned_location_id,
  r.name AS role_name,
  d.name AS assigned_department_name,
  l.name AS assigned_location_name`;

const USER_JOINS = `
  JOIN roles r ON u.role_id = r.id
  LEFT JOIN departments d ON u.assigned_department_id = d.id
  LEFT JOIN locations l ON u.assigned_location_id = l.id`;

const UserModel = {
  async findByUsername(username) {
    const [rows] = await pool.query(
      `SELECT u.*, r.name AS role_name,
              u.assigned_department_id, u.assigned_location_id
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE LOWER(u.username) = LOWER(?) AND u.is_active = 1
         AND (u.is_archived = 0 OR u.is_archived IS NULL)`,
      [username]
    );
    return rows[0] || null;
  },

  async findByEmail(email) {
    const [rows] = await pool.query(
      `SELECT u.*, r.name AS role_name FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE LOWER(u.email) = LOWER(?)`,
      [email]
    );
    return rows[0] || null;
  },

  async findByLogin(identifier) {
    const trimmed = (identifier || '').trim();
    if (!trimmed) return null;
    const byUsername = await this.findByUsername(trimmed);
    if (byUsername) return byUsername;
    if (trimmed.includes('@')) {
      const [rows] = await pool.query(
        `SELECT u.*, r.name AS role_name FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE LOWER(u.email) = LOWER(?) AND u.is_active = 1
           AND (u.is_archived = 0 OR u.is_archived IS NULL)`,
        [trimmed]
      );
      return rows[0] || null;
    }
    return null;
  },

  async findRoleByName(roleName) {
    const dbName = resolveRoleDbName(roleName);
    const [rows] = await pool.query('SELECT * FROM roles WHERE name = ?', [dbName]);
    return rows[0] || null;
  },

  async isUsernameTaken(username) {
    const [rows] = await pool.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER(?)',
      [username]
    );
    return rows.length > 0;
  },

  async isEmailTaken(email) {
    const [rows] = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    return rows.length > 0;
  },

  async create(data) {
    const [result] = await pool.query(
      `INSERT INTO users (role_id, username, email, password_hash, full_name, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [data.role_id, data.username, data.email, data.password_hash, data.full_name]
    );
    return result.insertId;
  },

  async generateUniqueUsername(email) {
    let base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '');
    if (!base) base = 'user';
    let candidate = base;
    let counter = 1;
    while (await this.isUsernameTaken(candidate)) {
      candidate = `${base}${counter}`;
      counter += 1;
    }
    return candidate;
  },

  async findById(id, { includeArchived = false } = {}) {
    let sql = `
      SELECT ${USER_SELECT}
      FROM users u
      ${USER_JOINS}
      WHERE u.id = ?`;
    if (!includeArchived) {
      sql += ' AND (u.is_archived = 0 OR u.is_archived IS NULL)';
    }
    const [rows] = await pool.query(sql, [id]);
    return rows[0] || null;
  },

  async updateLastLogin(id) {
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [id]);
  },

  async getAll(filters = {}) {
    let sql = `
      SELECT ${USER_SELECT}
      FROM users u
      ${USER_JOINS}
      WHERE (u.is_archived = 0 OR u.is_archived IS NULL)`;
    const params = [];

    if (filters.active_only) {
      sql += ' AND u.is_active = 1';
    }
    if (filters.status === 'Active') {
      sql += ' AND u.is_active = 1';
    } else if (filters.status === 'Inactive') {
      sql += ' AND u.is_active = 0';
    }
    if (filters.role) {
      sql += ' AND r.name = ?';
      params.push(filters.role);
    }
    if (filters.search) {
      sql += ' AND (u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY u.full_name';
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async getActiveList() {
    return this.getAll({ active_only: true });
  },

  async getAllRoles() {
    const [rows] = await pool.query('SELECT id, name, description FROM roles ORDER BY name');
    return rows;
  },

  async update(id, data) {
    const fields = [];
    const values = [];

    if (data.role_id !== undefined) {
      fields.push('role_id = ?');
      values.push(data.role_id);
    }
    if (data.username !== undefined) {
      fields.push('username = ?');
      values.push(data.username);
    }
    if (data.email !== undefined) {
      fields.push('email = ?');
      values.push(data.email);
    }
    if (data.full_name !== undefined) {
      fields.push('full_name = ?');
      values.push(data.full_name);
    }
    if (data.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(data.is_active ? 1 : 0);
    }
    if (data.password_hash) {
      fields.push('password_hash = ?');
      values.push(data.password_hash);
    }
    if (data.assigned_department_id !== undefined) {
      fields.push('assigned_department_id = ?');
      values.push(data.assigned_department_id || null);
    }
    if (data.assigned_location_id !== undefined) {
      fields.push('assigned_location_id = ?');
      values.push(data.assigned_location_id || null);
    }

    if (!fields.length) return false;

    values.push(id);
    const [result] = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ? AND (is_archived = 0 OR is_archived IS NULL)`,
      values
    );
    return result.affectedRows > 0;
  },

  async archive(id, userId) {
    if (parseInt(id, 10) === parseInt(userId, 10)) return false;
    return archiveRecord('users', id, userId);
  },

  async countActive() {
    const [rows] = await pool.query('SELECT COUNT(*) AS count FROM users WHERE is_active = 1');
    return rows[0].count;
  },

  async countTotal() {
    const [rows] = await pool.query('SELECT COUNT(*) AS count FROM users');
    return rows[0].count;
  }
};

module.exports = UserModel;
