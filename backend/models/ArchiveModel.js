const pool = require('../config/database');
const { ARCHIVE_MODULES } = require('../utils/archiveService');

const ArchiveModel = {
  async getAll(filters = {}) {
    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(filters.pageSize, 10) || 10));
    const offset = (page - 1) * pageSize;
    const search = (filters.search || '').trim();
    const moduleFilter = filters.module || '';

    const parts = [];
    const params = [];

    for (const [key, cfg] of Object.entries(ARCHIVE_MODULES)) {
      if (moduleFilter && moduleFilter !== key) continue;

      let sql = `
        SELECT '${key}' AS module_key, '${cfg.module}' AS module,
               t.id, t.${cfg.titleSql} AS title, t.${cfg.detailSql} AS detail,
               t.archived_at, t.archived_by, u.full_name AS archived_by_name
        FROM ${cfg.table} t
        LEFT JOIN users u ON t.archived_by = u.id
        WHERE t.is_archived = 1`;

      if (search) {
        sql += ` AND (t.${cfg.titleSql} LIKE ? OR t.${cfg.detailSql} LIKE ?)`;
        const term = `%${search}%`;
        params.push(term, term);
      }
      parts.push(sql);
    }

    if (!parts.length) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const unionSql = parts.join(' UNION ALL ');
    const countSql = `SELECT COUNT(*) AS total FROM (${unionSql}) archived`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0].total;

    const dataSql = `${unionSql} ORDER BY archived_at DESC LIMIT ? OFFSET ?`;
    const [items] = await pool.query(dataSql, [...params, pageSize, offset]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 0
    };
  }
};

module.exports = ArchiveModel;
