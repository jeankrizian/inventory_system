require('dotenv').config();
const { generateNextItemCode, getMaxSequenceForPrefix } = require('./utils/itemCodeGenerator');
const pool = require('./config/database');

(async () => {
  try {
    const [depts] = await pool.query('SELECT id, name, code FROM departments WHERE is_archived = 0 LIMIT 8');
    console.log('Departments:', depts.map((d) => `${d.code}(id=${d.id})`).join(', '));

    for (const dept of depts) {
      const next = await generateNextItemCode(dept.id);
      const max = await getMaxSequenceForPrefix(dept.code);
      console.log(`${dept.code}: max=${max} next=${next}`);
    }

    const [ictItems] = await pool.query(
      "SELECT item_code FROM inventory_items WHERE item_code LIKE 'ICT-%'"
    );
    console.log('Existing ICT codes:', ictItems.map((r) => r.item_code).join(', '));

    const itDept = depts.find((d) => d.code === 'IT');
    if (itDept) {
      const nextForIt = await generateNextItemCode(itDept.id);
      console.log(`IT department next code: ${nextForIt}`);
    }

    await pool.end();
    console.log('OK');
  } catch (err) {
    console.error('FAIL:', err.message);
    process.exit(1);
  }
})();
