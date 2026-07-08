const pool = require('../config/database');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatItemCode(prefix, sequence) {
  return `${prefix}-${String(sequence).padStart(3, '0')}`;
}

async function getMaxSequenceForPrefix(prefix, conn = pool) {
  const [rows] = await conn.query(
    'SELECT item_code FROM inventory_items WHERE item_code LIKE ?',
    [`${prefix}-%`]
  );

  const regex = new RegExp(`^${escapeRegex(prefix)}-(\\d+)$`, 'i');
  let max = 0;

  for (const row of rows) {
    const match = String(row.item_code).match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!Number.isNaN(num) && num > max) {
        max = num;
      }
    }
  }

  return max;
}

async function generateNextItemCode(departmentId, conn = pool) {
  const [deptRows] = await conn.query(
    'SELECT code FROM departments WHERE id = ? AND is_archived = 0',
    [departmentId]
  );
  const department = deptRows[0];

  if (!department) {
    throw new Error('Department not found');
  }

  const prefix = String(department.code || '').trim();
  if (!prefix) {
    throw new Error('Department code is not set');
  }

  const maxSequence = await getMaxSequenceForPrefix(prefix, conn);
  return formatItemCode(prefix, maxSequence + 1);
}

module.exports = {
  formatItemCode,
  getMaxSequenceForPrefix,
  generateNextItemCode
};
