function assignTrimmed(filters, query, field) {
  if (query[field] && String(query[field]).trim()) {
    filters[field] = String(query[field]).trim();
  }
}

function parseReportFilters(query = {}) {
  const filters = {};

  const departmentId = query.department_id || query.category_id;
  if (departmentId) {
    const parsed = parseInt(departmentId, 10);
    if (!Number.isNaN(parsed)) filters.department_id = parsed;
  }

  if (query.asset_classification) {
    filters.asset_classification = String(query.asset_classification);
  }

  if (query.status) {
    filters.status = String(query.status);
  }

  if (query.date_from) {
    filters.date_from = String(query.date_from);
  }

  if (query.date_to) {
    filters.date_to = String(query.date_to);
  }

  if (query.custodian_id) {
    const parsed = parseInt(query.custodian_id, 10);
    if (!Number.isNaN(parsed)) filters.custodian_id = parsed;
  }

  const textFields = [
    'transaction_code',
    'borrower_name',
    'borrower_department',
    'purpose',
    'borrow_code',
    'returned_by_name',
    'item_code',
    'item_name',
    'property_tag',
    'batch_id',
    'from_department_name',
    'to_department_name',
    'requested_by_name',
    'maintenance_type',
    'service_provider',
    'department_name',
    'disposal_method',
    'reason',
    'name',
    'contact_person',
    'phone',
    'email',
    'address',
    'code',
    'department_head',
    'custodian_name'
  ];
  for (const field of textFields) {
    assignTrimmed(filters, query, field);
  }

  const exactFields = ['condition', 'borrow_date', 'return_date', 'request_date', 'scheduled_date', 'priority'];
  for (const field of exactFields) {
    assignTrimmed(filters, query, field);
  }

  if (query.material) {
    filters.material = String(query.material);
  }

  if (query.acquisition_date) {
    filters.acquisition_date = String(query.acquisition_date);
  }

  if (query.unit_cost != null && String(query.unit_cost).trim() !== '') {
    filters.unit_cost = String(query.unit_cost).trim();
  }

  assignTrimmed(filters, query, 'search');

  return filters;
}

function parseInventoryReportFilters(query = {}) {
  const filters = parseReportFilters(query);

  const textFields = [
    'item_code',
    'item_name',
    'property_tag',
    'batch_id',
    'brand',
    'model',
    'custodian_name',
    'supplier_name',
    'department_name',
    'location_name'
  ];
  for (const field of textFields) {
    assignTrimmed(filters, query, field);
  }

  if (query.condition) {
    filters.condition = String(query.condition);
  }

  if (query.material) {
    filters.material = String(query.material);
  }

  if (query.acquisition_date) {
    filters.acquisition_date = String(query.acquisition_date);
  }

  if (query.unit_cost != null && String(query.unit_cost).trim() !== '') {
    filters.unit_cost = String(query.unit_cost).trim();
  }

  if (query.custodian_id) {
    const parsed = parseInt(query.custodian_id, 10);
    if (!Number.isNaN(parsed)) filters.custodian_id = parsed;
  }

  if (query.location_id) {
    const parsed = parseInt(query.location_id, 10);
    if (!Number.isNaN(parsed)) filters.location_id = parsed;
  }

  if (query.supplier_id) {
    const parsed = parseInt(query.supplier_id, 10);
    if (!Number.isNaN(parsed)) filters.supplier_id = parsed;
  }

  if (filters.department_id) {
    delete filters.department_name;
  }

  return filters;
}

function appendDateRangeSql(filters, columnExpr, params) {
  let clause = '';
  if (filters.date_from) {
    clause += ` AND ${columnExpr} >= ?`;
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    clause += ` AND ${columnExpr} <= ?`;
    params.push(filters.date_to);
  }
  return clause;
}

module.exports = {
  parseReportFilters,
  parseInventoryReportFilters,
  appendDateRangeSql
};
