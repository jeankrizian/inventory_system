const pool = require('../config/database');

const ReturnModel = {
  async getAll() {
    const [rows] = await pool.query(
      `SELECT rt.*, bt.transaction_code AS borrow_code, u.full_name AS returned_by_name
       FROM return_transactions rt
       JOIN borrow_transactions bt ON rt.borrow_transaction_id = bt.id
       JOIN users u ON rt.returned_by = u.id
       ORDER BY rt.created_at DESC`
    );
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

      // Update borrow transaction status
      await connection.query(
        "UPDATE borrow_transactions SET status = 'Returned' WHERE id = ?",
        [data.borrow_transaction_id]
      );

      // Restore inventory quantities
      const [borrowItems] = await connection.query(
        'SELECT inventory_item_id, quantity FROM borrow_items WHERE borrow_transaction_id = ?',
        [data.borrow_transaction_id]
      );

      for (const item of borrowItems) {
        await connection.query(
          'UPDATE inventory_items SET available_quantity = available_quantity + ? WHERE id = ?',
          [item.quantity, item.inventory_item_id]
        );
        // Update status
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

  async getRecent(limit = 5) {
    const [rows] = await pool.query(
      `SELECT rt.transaction_code, bt.borrower_name, rt.return_date, rt.\`condition\`
       FROM return_transactions rt
       JOIN borrow_transactions bt ON rt.borrow_transaction_id = bt.id
       ORDER BY rt.created_at DESC LIMIT ?`,
      [limit]
    );
    return rows;
  },

  async getMonthlyReturned() {
    const [rows] = await pool.query(`
      SELECT DATE_FORMAT(return_date, '%b') AS month, MONTH(return_date) AS month_num,
             COUNT(*) AS count
      FROM return_transactions
      WHERE return_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY MONTH(return_date), DATE_FORMAT(return_date, '%b')
      ORDER BY month_num
    `);
    return rows;
  },

  async countTotal() {
    const [rows] = await pool.query('SELECT COUNT(*) AS count FROM return_transactions');
    return rows[0].count;
  }
};

module.exports = ReturnModel;
