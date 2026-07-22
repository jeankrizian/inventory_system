const pool = require('../config/database');
const { appendBorrowTransactionScopeSql } = require('../utils/roleHelpers');
const { appendDateRangeSql } = require('../utils/reportFilters');
const { appendBorrowInventoryExistsFilters, inventoryFieldFilters } = require('../utils/inventoryReportFilterSql');
const {
  breakdownFromRows,
  queryWithOptionalPagination
} = require('../utils/listPagination');

function buildReturnListParts(filters = {}) {
  let whereSql = ' WHERE 1=1';
  const params = [];

  const scopeFilter = appendBorrowTransactionScopeSql(filters.scope, 'bt');
  whereSql += scopeFilter.clause;
  params.push(...scopeFilter.params);

  if (filters.transaction_code) {
    whereSql += ' AND rt.transaction_code LIKE ?';
    params.push(`%${filters.transaction_code}%`);
  }
  if (filters.borrow_code) {
    whereSql += ' AND bt.transaction_code LIKE ?';
    params.push(`%${filters.borrow_code}%`);
  }
  if (filters.returned_by_name) {
    whereSql += ' AND u.full_name LIKE ?';
    params.push(`%${filters.returned_by_name}%`);
  }
  if (filters.condition) {
    whereSql += ' AND rt.`condition` LIKE ?';
    params.push(`%${filters.condition}%`);
  }
  if (filters.return_date) {
    whereSql += ' AND DATE(rt.return_date) = ?';
    params.push(filters.return_date);
  }
  whereSql += appendBorrowInventoryExistsFilters(inventoryFieldFilters(filters), 'bt', params);
  whereSql += appendDateRangeSql(filters, 'rt.return_date', params);

  const joins = `
    FROM return_transactions rt
    JOIN borrow_transactions bt ON rt.borrow_transaction_id = bt.id
    JOIN users u ON rt.returned_by = u.id`;

  return { joins, whereSql, params };
}

const ReturnModel = {
  async getAll(filters = {}) {
    const { joins, whereSql, params } = buildReturnListParts(filters);
    const selectSql = `
      SELECT rt.*, bt.transaction_code AS borrow_code, u.full_name AS returned_by_name,
             bt.borrower_department AS borrower_department
      ${joins}${whereSql}`;
    const countSql = `SELECT COUNT(*) AS total ${joins}${whereSql}`;
    return queryWithOptionalPagination(pool, {
      selectSql,
      countSql,
      params,
      orderBy: 'ORDER BY rt.created_at DESC',
      filters
    });
  },

  async getReportAggregates(filters = {}) {
    const { joins, whereSql, params } = buildReturnListParts(filters);
    const [countRows] = await pool.query(`SELECT COUNT(*) AS total ${joins}${whereSql}`, params);
    const [statusRows] = await pool.query(
      `SELECT COALESCE(NULLIF(TRIM(rt.\`condition\`), ''), 'Unspecified') AS label, COUNT(*) AS cnt
       ${joins}${whereSql}
       GROUP BY COALESCE(NULLIF(TRIM(rt.\`condition\`), ''), 'Unspecified')`,
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

      const InventoryModel = require('./InventoryModel');

      for (const item of borrowItems) {
        const returned = await InventoryModel.markAssetReturned(item.inventory_item_id, connection);
        if (!returned) {
          throw new Error(`Asset ID ${item.inventory_item_id} could not be returned`);
        }
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

  async getMonthlyReturned(scope) {
    if (scope?.type === 'none') {
      return [];
    }
    let sql = `
      SELECT DATE_FORMAT(rt.return_date, '%b') AS month,
             YEAR(rt.return_date) AS year_num,
             MONTH(rt.return_date) AS month_num,
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
    sql += ` GROUP BY YEAR(rt.return_date), MONTH(rt.return_date), DATE_FORMAT(rt.return_date, '%b')
      ORDER BY year_num, month_num`;
    const [rows] = await pool.query(sql, params);
    return rows || [];
  }
};

module.exports = ReturnModel;
