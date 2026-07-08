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

  if (query.low_stock === 'true' || query.low_stock === true) {
    filters.low_stock = true;
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
  appendDateRangeSql
};
