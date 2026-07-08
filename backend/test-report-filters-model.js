require('dotenv').config();
const pool = require('./config/database');
const InventoryModel = require('./models/InventoryModel');
const BorrowModel = require('./models/BorrowModel');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const [depts] = await pool.query('SELECT id FROM departments WHERE is_archived = 0 ORDER BY id LIMIT 1');
  assert(depts.length, 'Need at least one department');

  const deptId = depts[0].id;
  const allItems = await InventoryModel.getAll({});
  const filteredItems = await InventoryModel.getAll({ department_id: deptId });
  assert(filteredItems.length <= allItems.length, 'Department filter reduces or keeps inventory count');
  assert(
    filteredItems.every((item) => item.department_id === deptId),
    'Inventory department filter matches department_id'
  );

  const allBorrows = await BorrowModel.getAll({});
  const filteredBorrows = await BorrowModel.getAll({ department_id: deptId });
  assert(filteredBorrows.length <= allBorrows.length, 'Borrow department filter reduces or keeps count');

  if (filteredBorrows.length) {
    const [check] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM borrow_items bi
       JOIN inventory_items ii ON bi.inventory_item_id = ii.id
       WHERE bi.borrow_transaction_id = ? AND ii.department_id = ?`,
      [filteredBorrows[0].id, deptId]
    );
    assert(check[0].cnt > 0, 'Filtered borrow includes item from selected department');
  }

  console.log('Department filter inventory:', filteredItems.length, '/', allItems.length);
  console.log('Department filter borrow:', filteredBorrows.length, '/', allBorrows.length);
  console.log('Report filter model tests OK');
  process.exit(0);
})().catch((err) => {
  console.error('Report filter model test failed:', err.message);
  process.exit(1);
});
