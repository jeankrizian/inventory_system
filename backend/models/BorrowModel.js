const pool = require('../config/database');

const BorrowModel = {
  async getAll(filters = {}) {
    let sql = `
      SELECT bt.*, u.full_name AS approver_name
      FROM borrow_transactions bt
      LEFT JOIN users u ON bt.approved_by = u.id
      WHERE 1=1`;
    const params = [];

    if (filters.status) {
      sql += ' AND bt.status = ?';
      params.push(filters.status);
    }
    if (filters.search) {
      sql += ' AND (bt.transaction_code LIKE ? OR bt.borrower_name LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term);
    }

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
      `SELECT bi.*, i.item_code, i.item_name, i.available_quantity
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
    const updates = { status };
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

  async getRecent(limit = 5) {
    const [rows] = await pool.query(
      `SELECT transaction_code, borrower_name, borrow_date, status
       FROM borrow_transactions ORDER BY created_at DESC LIMIT ?`,
      [limit]
    );
    return rows;
  },

  async getMonthlyBorrowed() {
    const [rows] = await pool.query(`
      SELECT DATE_FORMAT(borrow_date, '%b') AS month, MONTH(borrow_date) AS month_num,
             COUNT(*) AS count
      FROM borrow_transactions
      WHERE borrow_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        AND status IN ('Approved', 'Borrowed', 'Returned', 'Overdue')
      GROUP BY MONTH(borrow_date), DATE_FORMAT(borrow_date, '%b')
      ORDER BY month_num
    `);
    return rows;
  },

  async getBorrowItems(transactionId) {
    const [rows] = await pool.query(
      'SELECT * FROM borrow_items WHERE borrow_transaction_id = ?',
      [transactionId]
    );
    return rows;
  },

  async countPending() {
    const [rows] = await pool.query(`SELECT COUNT(*) AS count FROM borrow_transactions WHERE status = 'Pending'`);
    return rows[0].count;
  }
};

module.exports = BorrowModel;
