const pool = require('../config/database');

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function runBorrowUxMigration() {
  if (!(await columnExists('borrow_transactions', 'borrower_department_id'))) {
    await pool.query(
      `ALTER TABLE borrow_transactions
       ADD COLUMN borrower_department_id INT NULL AFTER borrower_department`
    );
    console.log('Added borrower_department_id to borrow_transactions.');
  }

  if (!(await columnExists('borrow_transactions', 'requested_by'))) {
    await pool.query(
      `ALTER TABLE borrow_transactions
       ADD COLUMN requested_by INT NULL AFTER borrower_id`
    );
    console.log('Added requested_by to borrow_transactions.');
  }

  await pool.query(
    `UPDATE borrow_transactions
     SET requested_by = borrower_id
     WHERE requested_by IS NULL`
  );

  return { applied: true };
}

module.exports = { runBorrowUxMigration };
