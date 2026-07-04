const pool = require('../config/database');
const { appendBorrowTransactionScopeSql } = require('../utils/roleHelpers');

const BorrowModel = {
  async getAll(filters = {}) {
    let sql = `
      SELECT bt.*, u.full_name AS approver_name
      FROM borrow_transactions bt
      LEFT JOIN users u ON bt.approved_by = u.id
      WHERE 1=1`;
    const params = [];

    if (filters.borrower_id) {
      sql += ' AND bt.borrower_id = ?';
      params.push(filters.borrower_id);
    }

    if (filters.status) {
      sql += ' AND bt.status = ?';
      params.push(filters.status);
    }
    if (filters.search) {
      sql += ' AND (bt.transaction_code LIKE ? OR bt.borrower_name LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term);
    }

    const scopeFilter = appendBorrowTransactionScopeSql(filters.scope, 'bt');
    sql += scopeFilter.clause;
    params.push(...scopeFilter.params);

    sql += ' ORDER BY bt.created_at DESC';
    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(filters.limit, 10));
    }
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT bt.*, u.full_name AS approver_name
       FROM borrow_transactions bt
       LEFT JOIN users u ON bt.approved_by = u.id
       WHERE bt.id = ?`,
      [id]
    );
    const transaction = rows[0];
    if (!transaction) return null;

    const [items] = await pool.query(
      `SELECT bi.*, i.item_code, i.item_name, i.available_quantity,
              i.department_id, i.location_id
       FROM borrow_items bi
       JOIN inventory_items i ON bi.inventory_item_id = i.id
       WHERE bi.borrow_transaction_id = ?`,
      [id]
    );
    transaction.items = items;
    return transaction;
  },

  async create(data, items) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        `INSERT INTO borrow_transactions
         (transaction_code, borrower_id, borrower_name, borrower_department, purpose,
          borrow_date, expected_return_date, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.transaction_code, data.borrower_id, data.borrower_name,
          data.borrower_department || null, data.purpose || null,
          data.borrow_date, data.expected_return_date || null,
          data.status || 'Pending', data.notes || null
        ]
      );
      const transactionId = result.insertId;

      for (const item of items) {
        await connection.query(
          'INSERT INTO borrow_items (borrow_transaction_id, inventory_item_id, quantity) VALUES (?, ?, ?)',
          [transactionId, item.inventory_item_id, item.quantity]
        );
      }

      await connection.commit();
      return transactionId;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  async updateStatus(id, status, approvedBy = null) {
    if (approvedBy) {
      await pool.query(
        'UPDATE borrow_transactions SET status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?',
        [status, approvedBy, id]
      );
    } else {
      await pool.query('UPDATE borrow_transactions SET status = ? WHERE id = ?', [status, id]);
    }
    return true;
  },

  async getRecent(limit = 5, scope) {
    if (scope?.type === 'none') {
      return [];
    }
    let sql = `SELECT bt.transaction_code, bt.borrower_name, bt.borrow_date, bt.status
       FROM borrow_transactions bt WHERE 1=1`;
    const params = [];
    if (scope?.type === 'own' && scope.userId) {
      sql += ' AND bt.borrower_id = ?';
      params.push(scope.userId);
    } else if (scope && scope.type !== 'all') {
      const scopeFilter = appendBorrowTransactionScopeSql(scope, 'bt');
      sql += scopeFilter.clause;
      params.push(...scopeFilter.params);
    }
    sql += ' ORDER BY bt.created_at DESC LIMIT ?';
    params.push(limit);
    const [rows] = await pool.query(sql, params);
    return rows || [];
  },

  async getMonthlyBorrowed(scope) {
    if (scope?.type === 'none') {
      return [];
    }
    let sql = `
      SELECT DATE_FORMAT(bt.borrow_date, '%b') AS month, MONTH(bt.borrow_date) AS month_num,
             COUNT(*) AS count
      FROM borrow_transactions bt
      WHERE bt.borrow_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        AND bt.status IN ('Approved', 'Borrowed', 'Returned', 'Overdue')`;
    const params = [];
    if (scope?.type === 'own' && scope.userId) {
      sql += ' AND bt.borrower_id = ?';
      params.push(scope.userId);
    } else if (scope && scope.type !== 'all') {
      const scopeFilter = appendBorrowTransactionScopeSql(scope, 'bt');
      sql += scopeFilter.clause;
      params.push(...scopeFilter.params);
    }
    sql += ` GROUP BY MONTH(bt.borrow_date), DATE_FORMAT(bt.borrow_date, '%b')
      ORDER BY month_num`;
    const [rows] = await pool.query(sql, params);
    return rows || [];
  },

  async getBorrowItems(transactionId) {
    const [rows] = await pool.query(
      'SELECT * FROM borrow_items WHERE borrow_transaction_id = ?',
      [transactionId]
    );
    return rows;
  },

  async countPending(scope) {
    if (scope?.type === 'none') {
      return 0;
    }
    let sql = `SELECT COUNT(*) AS count FROM borrow_transactions bt WHERE bt.status = 'Pending'`;
    const params = [];
    if (scope?.type === 'own' && scope.userId) {
      sql += ' AND bt.borrower_id = ?';
      params.push(scope.userId);
    } else if (scope && scope.type !== 'all') {
      const scopeFilter = appendBorrowTransactionScopeSql(scope, 'bt');
      sql += scopeFilter.clause;
      params.push(...scopeFilter.params);
    }
    const [rows] = await pool.query(sql, params);
    return Number(rows[0]?.count ?? 0);
  },

  async countByStatus(scope, status) {
    if (scope?.type === 'none') return 0;
    let sql = `SELECT COUNT(*) AS count FROM borrow_transactions bt WHERE bt.status = ?`;
    const params = [status];
    if (scope?.type === 'own' && scope.userId) {
      sql += ' AND bt.borrower_id = ?';
      params.push(scope.userId);
    } else if (scope && scope.type !== 'all') {
      const scopeFilter = appendBorrowTransactionScopeSql(scope, 'bt');
      sql += scopeFilter.clause;
      params.push(...scopeFilter.params);
    }
    const [rows] = await pool.query(sql, params);
    return Number(rows[0]?.count ?? 0);
  },

  async countCurrentBorrowed(scope) {
    if (scope?.type === 'none') return 0;
    let sql = `SELECT COUNT(*) AS count FROM borrow_transactions bt
      WHERE bt.status IN ('Approved', 'Borrowed', 'Overdue')`;
    const params = [];
    if (scope?.type === 'own' && scope.userId) {
      sql += ' AND bt.borrower_id = ?';
      params.push(scope.userId);
    } else if (scope && scope.type !== 'all') {
      const scopeFilter = appendBorrowTransactionScopeSql(scope, 'bt');
      sql += scopeFilter.clause;
      params.push(...scopeFilter.params);
    }
    const [rows] = await pool.query(sql, params);
    return Number(rows[0]?.count ?? 0);
  },

  async countOverdue(scope) {
    if (scope?.type === 'none') return 0;
    let sql = `SELECT COUNT(*) AS count FROM borrow_transactions bt
      WHERE bt.status = 'Overdue'
         OR (bt.status IN ('Approved', 'Borrowed')
             AND bt.expected_return_date IS NOT NULL
             AND bt.expected_return_date < CURDATE())`;
    const params = [];
    if (scope?.type === 'own' && scope.userId) {
      sql += ' AND bt.borrower_id = ?';
      params.push(scope.userId);
    } else if (scope && scope.type !== 'all') {
      const scopeFilter = appendBorrowTransactionScopeSql(scope, 'bt');
      sql += scopeFilter.clause;
      params.push(...scopeFilter.params);
    }
    const [rows] = await pool.query(sql, params);
    return Number(rows[0]?.count ?? 0);
  },

  async countDueSoon(scope, days = 3) {
    if (scope?.type === 'none') return 0;
    let sql = `SELECT COUNT(*) AS count FROM borrow_transactions bt
      WHERE bt.status IN ('Approved', 'Borrowed')
        AND bt.expected_return_date IS NOT NULL
        AND bt.expected_return_date >= CURDATE()
        AND bt.expected_return_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)`;
    const params = [days];
    if (scope?.type === 'own' && scope.userId) {
      sql += ' AND bt.borrower_id = ?';
      params.push(scope.userId);
    } else if (scope && scope.type !== 'all') {
      const scopeFilter = appendBorrowTransactionScopeSql(scope, 'bt');
      sql += scopeFilter.clause;
      params.push(...scopeFilter.params);
    }
    const [rows] = await pool.query(sql, params);
    return Number(rows[0]?.count ?? 0);
  }
};

module.exports = BorrowModel;
