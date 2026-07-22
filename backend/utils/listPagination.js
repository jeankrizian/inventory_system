/**
 * Shared list pagination helpers for report (and similar) queries.
 * When filters.paginated is set, returns { data, total, page, limit }.
 * Otherwise returns a plain row array (existing callers unchanged).
 */

function parseListPagination(filters = {}) {
  if (!filters.paginated) return null;
  const page = Math.max(1, parseInt(filters.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 25));
  return { page, limit, offset: (page - 1) * limit };
}

function emptyListResult(filters = {}) {
  if (!filters.paginated) return [];
  const pagination = parseListPagination({ ...filters, paginated: true });
  return { data: [], total: 0, page: pagination.page, limit: pagination.limit };
}

function breakdownFromRows(rows = []) {
  const out = {};
  rows.forEach((row) => {
    const label = row.label != null && String(row.label).trim() !== ''
      ? String(row.label).trim()
      : 'Unspecified';
    out[label] = Number(row.cnt || 0);
  });
  return out;
}

async function queryWithOptionalPagination(pool, {
  selectSql,
  countSql,
  params = [],
  orderBy = '',
  filters = {}
}) {
  const pagination = parseListPagination(filters);

  if (!pagination) {
    let sql = `${selectSql}${orderBy ? ` ${orderBy}` : ''}`;
    const dataParams = [...params];
    if (filters.limit) {
      sql += ' LIMIT ?';
      dataParams.push(parseInt(filters.limit, 10));
    }
    const [rows] = await pool.query(sql, dataParams);
    return rows;
  }

  const [countRows] = await pool.query(countSql, params);
  const total = Number(countRows[0]?.total || 0);
  const [rows] = await pool.query(
    `${selectSql}${orderBy ? ` ${orderBy}` : ''} LIMIT ? OFFSET ?`,
    [...params, pagination.limit, pagination.offset]
  );
  return {
    data: rows,
    total,
    page: pagination.page,
    limit: pagination.limit
  };
}

module.exports = {
  parseListPagination,
  emptyListResult,
  breakdownFromRows,
  queryWithOptionalPagination
};
