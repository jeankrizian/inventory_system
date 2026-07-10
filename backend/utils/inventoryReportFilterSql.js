function appendInventoryItemFieldFilters(filters, itemAlias, params, options = {}) {
  const { supplierAlias = null, departmentAlias = null } = options;
  let clause = '';

  if (filters.item_code) {
    clause += ` AND ${itemAlias}.item_code LIKE ?`;
    params.push(`%${filters.item_code}%`);
  }
  if (filters.item_name) {
    clause += ` AND ${itemAlias}.item_name LIKE ?`;
    params.push(`%${filters.item_name}%`);
  }
  if (filters.department_id) {
    clause += ` AND ${itemAlias}.department_id = ?`;
    params.push(filters.department_id);
  }
  if (filters.department_name && departmentAlias) {
    clause += ` AND ${departmentAlias}.name LIKE ?`;
    params.push(`%${filters.department_name}%`);
  }
  if (filters.material) {
    clause += ` AND ${itemAlias}.material = ?`;
    params.push(filters.material);
  }
  if (filters.quantity != null && filters.quantity !== '') {
    const qty = parseInt(filters.quantity, 10);
    if (!Number.isNaN(qty)) {
      clause += ` AND ${itemAlias}.quantity = ?`;
      params.push(qty);
    }
  }
  if (filters.unit_cost != null && filters.unit_cost !== '') {
    const cost = parseFloat(filters.unit_cost);
    if (!Number.isNaN(cost)) {
      clause += ` AND (${itemAlias}.unit_cost = ? OR ${itemAlias}.acquisition_cost = ?)`;
      params.push(cost, cost);
    }
  }
  if (filters.supplier_name && supplierAlias) {
    clause += ` AND ${supplierAlias}.name LIKE ?`;
    params.push(`%${filters.supplier_name}%`);
  }
  if (filters.purchase_date) {
    clause += ` AND DATE(${itemAlias}.purchase_date) = ?`;
    params.push(filters.purchase_date);
  }

  return clause;
}

function appendBorrowInventoryExistsFilters(filters, borrowAlias, params) {
  const inv = [];
  const invParams = [];

  if (filters.item_code) {
    inv.push('ii_f.item_code LIKE ?');
    invParams.push(`%${filters.item_code}%`);
  }
  if (filters.item_name) {
    inv.push('ii_f.item_name LIKE ?');
    invParams.push(`%${filters.item_name}%`);
  }
  if (filters.department_id) {
    inv.push('ii_f.department_id = ?');
    invParams.push(filters.department_id);
  }
  if (filters.department_name) {
    inv.push('dep_f.name LIKE ?');
    invParams.push(`%${filters.department_name}%`);
  }
  if (filters.material) {
    inv.push('ii_f.material = ?');
    invParams.push(filters.material);
  }
  if (filters.quantity != null && filters.quantity !== '') {
    const qty = parseInt(filters.quantity, 10);
    if (!Number.isNaN(qty)) {
      inv.push('ii_f.quantity = ?');
      invParams.push(qty);
    }
  }
  if (filters.unit_cost != null && filters.unit_cost !== '') {
    const cost = parseFloat(filters.unit_cost);
    if (!Number.isNaN(cost)) {
      inv.push('(ii_f.unit_cost = ? OR ii_f.acquisition_cost = ?)');
      invParams.push(cost, cost);
    }
  }
  if (filters.supplier_name) {
    inv.push('sup_f.name LIKE ?');
    invParams.push(`%${filters.supplier_name}%`);
  }
  if (filters.purchase_date) {
    inv.push('DATE(ii_f.purchase_date) = ?');
    invParams.push(filters.purchase_date);
  }

  if (!inv.length) {
    return '';
  }

  params.push(...invParams);
  return ` AND EXISTS (
    SELECT 1 FROM borrow_items bi_f
    JOIN inventory_items ii_f ON bi_f.inventory_item_id = ii_f.id
    LEFT JOIN suppliers sup_f ON ii_f.supplier_id = sup_f.id
    LEFT JOIN departments dep_f ON ii_f.department_id = dep_f.id
    WHERE bi_f.borrow_transaction_id = ${borrowAlias}.id
      AND ${inv.join(' AND ')}
  )`;
}

module.exports = {
  appendInventoryItemFieldFilters,
  appendBorrowInventoryExistsFilters
};
