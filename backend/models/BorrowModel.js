const pool = require('../config/database');
const { appendBorrowTransactionScopeSql } = require('../utils/roleHelpers');
const { appendDateRangeSql } = require('../utils/reportFilters');
const { appendBorrowInventoryExistsFilters, inventoryFieldFilters } = require('../utils/inventoryReportFilterSql');
const {
  breakdownFromRows,
  queryWithOptionalPagination
} = require('../utils/listPagination');

function buildBorrowListParts(filters = {}) {
  let whereSql = ' WHERE 1=1';
  const params = [];

  if (filters.borrower_id) {
    whereSql += ' AND bt.borrower_id = ?';
    params.push(filters.borrower_id);
  }
  if (filters.status) {
    whereSql += ' AND bt.status LIKE ?';
    params.push(`%${filters.status}%`);
  }
  if (filters.transaction_code) {
    whereSql += ' AND bt.transaction_code LIKE ?';
    params.push(`%${filters.transaction_code}%`);
  }
  if (filters.borrower_name) {
    whereSql += ' AND bt.borrower_name LIKE ?';
    params.push(`%${filters.borrower_name}%`);
  }
  if (filters.borrower_department) {
    whereSql += ' AND bt.borrower_department LIKE ?';
    params.push(`%${filters.borrower_department}%`);
  }
  if (filters.purpose) {
    whereSql += ' AND bt.purpose LIKE ?';
    params.push(`%${filters.purpose}%`);
  }
  if (filters.borrow_date) {
    whereSql += ' AND DATE(bt.borrow_date) = ?';
    params.push(filters.borrow_date);
  }
  whereSql += appendBorrowInventoryExistsFilters(inventoryFieldFilters(filters), 'bt', params);
  if (filters.search) {
    whereSql += ' AND (bt.transaction_code LIKE ? OR bt.borrower_name LIKE ? OR bt.purpose LIKE ?)';
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }
  whereSql += appendDateRangeSql(filters, 'bt.borrow_date', params);

  const scopeFilter = appendBorrowTransactionScopeSql(filters.scope, 'bt');
  whereSql += scopeFilter.clause;
  params.push(...scopeFilter.params);

  const joins = `
    FROM borrow_transactions bt
    LEFT JOIN users u ON bt.approved_by = u.id`;

  return { joins, whereSql, params };
}

const BorrowModel = {
  async getAll(filters = {}) {
    const { joins, whereSql, params } = buildBorrowListParts(filters);
    const selectSql = `
      SELECT bt.*, u.full_name AS approver_name,
        (
          SELECT GROUP_CONCAT(DISTINCT i.item_name ORDER BY i.item_name SEPARATOR ', ')
          FROM borrow_items bi
          JOIN inventory_items i ON i.id = bi.inventory_item_id
          WHERE bi.borrow_transaction_id = bt.id
        ) AS item_names,
        (
          SELECT GROUP_CONCAT(DISTINCT i.property_tag ORDER BY i.property_tag SEPARATOR ', ')
          FROM borrow_items bi
          JOIN inventory_items i ON i.id = bi.inventory_item_id
          WHERE bi.borrow_transaction_id = bt.id
            AND i.property_tag IS NOT NULL
            AND i.property_tag != ''
        ) AS property_tags
      ${joins}${whereSql}`;
    const countSql = `SELECT COUNT(*) AS total ${joins}${whereSql}`;
    return queryWithOptionalPagination(pool, {
      selectSql,
      countSql,
      params,
      orderBy: 'ORDER BY bt.created_at DESC',
      filters
    });
  },

  async getReportAggregates(filters = {}) {
    const { joins, whereSql, params } = buildBorrowListParts(filters);
    const [countRows] = await pool.query(`SELECT COUNT(*) AS total ${joins}${whereSql}`, params);
    const [statusRows] = await pool.query(
      `SELECT COALESCE(NULLIF(TRIM(bt.status), ''), 'Unspecified') AS label, COUNT(*) AS cnt
       ${joins}${whereSql}
       GROUP BY COALESCE(NULLIF(TRIM(bt.status), ''), 'Unspecified')`,
      params
    );
    const [deptRows] = await pool.query(
      `SELECT COALESCE(NULLIF(TRIM(bt.borrower_department), ''), 'Unspecified') AS label, COUNT(*) AS cnt
       ${joins}${whereSql}
       GROUP BY COALESCE(NULLIF(TRIM(bt.borrower_department), ''), 'Unspecified')`,
      params
    );
    return {
      total: Number(countRows[0]?.total || 0),
      status_breakdown: breakdownFromRows(statusRows),
      department_breakdown: breakdownFromRows(deptRows)
    };
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
      `SELECT bi.*, i.item_code, i.item_name, i.property_tag,
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
         (transaction_code, borrower_id, requested_by, borrower_name, borrower_department, borrower_department_id,
          purpose, borrow_date, expected_return_date, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.transaction_code, data.borrower_id, data.requested_by || data.borrower_id,
          data.borrower_name,
          data.borrower_department || null, data.borrower_department_id || null,
          data.purpose || null,
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

  async getMonthlyBorrowed(scope) {
    if (scope?.type === 'none') {
      return [];
    }
    let sql = `
      SELECT DATE_FORMAT(bt.borrow_date, '%b') AS month,
             YEAR(bt.borrow_date) AS year_num,
             MONTH(bt.borrow_date) AS month_num,
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
    sql += ` GROUP BY YEAR(bt.borrow_date), MONTH(bt.borrow_date), DATE_FORMAT(bt.borrow_date, '%b')
      ORDER BY year_num, month_num`;
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

  async countTotal(scope) {
    if (scope?.type === 'none') {
      return 0;
    }
    let sql = `SELECT COUNT(*) AS count FROM borrow_transactions bt WHERE 1=1`;
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
  },

  async getByAsset(inventoryItemId) {
    const [rows] = await pool.query(
      `SELECT bt.id, bt.transaction_code, bt.borrower_name, bt.borrower_department,
              bt.borrow_date, bt.expected_return_date, bt.status, bt.purpose,
              rt.transaction_code AS return_code, rt.return_date, rt.condition AS return_condition,
              ru.full_name AS returned_by_name
       FROM borrow_items bi
       JOIN borrow_transactions bt ON bi.borrow_transaction_id = bt.id
       LEFT JOIN return_transactions rt ON rt.borrow_transaction_id = bt.id
       LEFT JOIN users ru ON rt.returned_by = ru.id
       WHERE bi.inventory_item_id = ?
       ORDER BY bt.borrow_date DESC, bt.created_at DESC`,
      [inventoryItemId]
    );
    return rows;
  }
};

module.exports = BorrowModel;
