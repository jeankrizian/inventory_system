const pool = require('../config/database');
const { appendBorrowTransactionScopeSql } = require('../utils/roleHelpers');
const { appendDateRangeSql } = require('../utils/reportFilters');
const { appendBorrowInventoryExistsFilters } = require('../utils/inventoryReportFilterSql');

const ReturnModel = {
  async getAll(filters = {}) {
    let sql = `
      SELECT rt.*, bt.transaction_code AS borrow_code, u.full_name AS returned_by_name
      FROM return_transactions rt
      JOIN borrow_transactions bt ON rt.borrow_transaction_id = bt.id
      JOIN users u ON rt.returned_by = u.id
      WHERE 1=1`;
    const params = [];

    const scopeFilter = appendBorrowTransactionScopeSql(filters.scope, 'bt');
    sql += scopeFilter.clause;
    params.push(...scopeFilter.params);

    if (filters.transaction_code) {
      sql += ' AND rt.transaction_code LIKE ?';
      params.push(`%${filters.transaction_code}%`);
    }
    if (filters.borrow_code) {
      sql += ' AND bt.transaction_code LIKE ?';
      params.push(`%${filters.borrow_code}%`);
    }
    if (filters.returned_by_name) {
      sql += ' AND u.full_name LIKE ?';
      params.push(`%${filters.returned_by_name}%`);
    }
    if (filters.condition) {
      sql += ' AND rt.`condition` LIKE ?';
      params.push(`%${filters.condition}%`);
    }
    if (filters.return_date) {
      sql += ' AND DATE(rt.return_date) = ?';
      params.push(filters.return_date);
    }
    sql += appendBorrowInventoryExistsFilters(filters, 'bt', params);

    sql += appendDateRangeSql(filters, 'rt.return_date', params);

    sql += ' ORDER BY rt.created_at DESC';
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async create(data) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        `INSERT INTO return_transactions
         (transaction_code, borrow_transaction_id, returned_by, return_date, \`condition\`, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          data.transaction_code, data.borrow_transaction_id, data.returned_by,
          data.return_date, data.condition || 'Good', data.notes || null
        ]
      );

      await connection.query(
        "UPDATE borrow_transactions SET status = 'Returned' WHERE id = ?",
        [data.borrow_transaction_id]
      );

      const [borrowItems] = await connection.query(
        'SELECT inventory_item_id, quantity FROM borrow_items WHERE borrow_transaction_id = ?',
        [data.borrow_transaction_id]
      );

      for (const item of borrowItems) {
        await connection.query(
          'UPDATE inventory_items SET available_quantity = available_quantity + ? WHERE id = ?',
          [item.quantity, item.inventory_item_id]
        );
        await connection.query(
          `UPDATE inventory_items SET status = CASE
            WHEN available_quantity <= 0 THEN 'Out of Stock'
            WHEN available_quantity <= low_stock_threshold THEN 'Low Stock'
            WHEN available_quantity < quantity THEN 'Borrowed'
            ELSE 'Available'
          END WHERE id = ?`,
          [item.inventory_item_id]
        );
      }

      await connection.commit();
      return result.insertId;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  async getRecent(limit = 5, scope) {
    if (scope?.type === 'none') {
      return [];
    }
    let sql = `SELECT rt.transaction_code, bt.borrower_name, rt.return_date, rt.\`condition\`
       FROM return_transactions rt
       JOIN borrow_transactions bt ON rt.borrow_transaction_id = bt.id
       WHERE 1=1`;
    const params = [];
    if (scope?.type === 'own' && scope.userId) {
      sql += ' AND bt.borrower_id = ?';
      params.push(scope.userId);
    } else if (scope && scope.type !== 'all') {
      const scopeFilter = appendBorrowTransactionScopeSql(scope, 'bt');
      sql += scopeFilter.clause;
      params.push(...scopeFilter.params);
    }
    sql += ' ORDER BY rt.created_at DESC LIMIT ?';
    params.push(limit);
    const [rows] = await pool.query(sql, params);
    return rows || [];
  },

  async getMonthlyReturned(scope) {
    if (scope?.type === 'none') {
      return [];
    }
    let sql = `
      SELECT DATE_FORMAT(rt.return_date, '%b') AS month, MONTH(rt.return_date) AS month_num,
             COUNT(*) AS count
      FROM return_transactions rt
      JOIN borrow_transactions bt ON rt.borrow_transaction_id = bt.id
      WHERE rt.return_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)`;
    const params = [];
    if (scope?.type === 'own' && scope.userId) {
      sql += ' AND bt.borrower_id = ?';
      params.push(scope.userId);
    } else if (scope && scope.type !== 'all') {
      const scopeFilter = appendBorrowTransactionScopeSql(scope, 'bt');
      sql += scopeFilter.clause;
      params.push(...scopeFilter.params);
    }
    sql += ` GROUP BY MONTH(rt.return_date), DATE_FORMAT(rt.return_date, '%b')
      ORDER BY month_num`;
    const [rows] = await pool.query(sql, params);
    return rows || [];
  },

  async countTotal(scope) {
    if (scope?.type === 'none') {
      return 0;
    }
    let sql = 'SELECT COUNT(*) AS count FROM return_transactions rt JOIN borrow_transactions bt ON rt.borrow_transaction_id = bt.id WHERE 1=1';
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
  }
};

module.exports = ReturnModel;
