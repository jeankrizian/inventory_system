/** Workflow list endpoints use `status` for request state — not inventory item status. */
function inventoryFieldFilters(filters = {}) {
  if (!filters || !Object.prototype.hasOwnProperty.call(filters, 'status')) {
    return filters;
  }
  const { status, ...rest } = filters;
  return rest;
}

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
  if (filters.custodian_id) {
    clause += ` AND ${itemAlias}.custodian_id = ?`;
    params.push(filters.custodian_id);
  }
  if (filters.property_tag) {
    clause += ` AND ${itemAlias}.property_tag LIKE ?`;
    params.push(`%${filters.property_tag}%`);
  }
  if (filters.batch_id) {
    clause += ` AND ${itemAlias}.batch_id LIKE ?`;
    params.push(`%${filters.batch_id}%`);
  }
  if (filters.status) {
    clause += ` AND ${itemAlias}.status LIKE ?`;
    params.push(`%${filters.status}%`);
  }
  if (filters.unit_cost != null && filters.unit_cost !== '') {
    const cost = parseFloat(filters.unit_cost);
    if (!Number.isNaN(cost)) {
      clause += ` AND ${itemAlias}.unit_cost = ?`;
      params.push(cost);
    }
  }
  if (filters.supplier_name && supplierAlias) {
    clause += ` AND ${supplierAlias}.name LIKE ?`;
    params.push(`%${filters.supplier_name}%`);
  }
  if (filters.acquisition_date) {
    clause += ` AND DATE(${itemAlias}.acquisition_date) = ?`;
    params.push(filters.acquisition_date);
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
  if (filters.custodian_id) {
    inv.push('ii_f.custodian_id = ?');
    invParams.push(filters.custodian_id);
  }
  if (filters.property_tag) {
    inv.push('ii_f.property_tag LIKE ?');
    invParams.push(`%${filters.property_tag}%`);
  }
  if (filters.batch_id) {
    inv.push('ii_f.batch_id LIKE ?');
    invParams.push(`%${filters.batch_id}%`);
  }
  if (filters.status) {
    inv.push('ii_f.status LIKE ?');
    invParams.push(`%${filters.status}%`);
  }
  if (filters.unit_cost != null && filters.unit_cost !== '') {
    const cost = parseFloat(filters.unit_cost);
    if (!Number.isNaN(cost)) {
      inv.push('ii_f.unit_cost = ?');
      invParams.push(cost);
    }
  }
  if (filters.supplier_name) {
    inv.push('sup_f.name LIKE ?');
    invParams.push(`%${filters.supplier_name}%`);
  }
  if (filters.acquisition_date) {
    inv.push('DATE(ii_f.acquisition_date) = ?');
    invParams.push(filters.acquisition_date);
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
  inventoryFieldFilters,
  appendInventoryItemFieldFilters,
  appendBorrowInventoryExistsFilters
};
