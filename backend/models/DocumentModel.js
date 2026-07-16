const pool = require('../config/database');

const DocumentModel = {
  async create(data) {
    const [result] = await pool.query(
      `INSERT INTO document_history
       (document_type, document_number, related_module, related_transaction_id, generated_by, payload, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.document_type,
        data.document_number,
        data.related_module || null,
        data.related_transaction_id || null,
        data.generated_by || null,
        JSON.stringify(data.payload),
        data.status || 'Generated'
      ]
    );
    return result.insertId;
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT d.*, u.full_name AS generated_by_name
       FROM document_history d
       LEFT JOIN users u ON d.generated_by = u.id
       WHERE d.id = ?`,
      [id]
    );
    const row = rows[0];
    if (!row) return null;
    if (typeof row.payload === 'string') row.payload = JSON.parse(row.payload);
    return row;
  },

  async findByTransaction(documentType, relatedModule, relatedTransactionId) {
    const [rows] = await pool.query(
      `SELECT d.*, u.full_name AS generated_by_name
       FROM document_history d
       LEFT JOIN users u ON d.generated_by = u.id
       WHERE d.document_type = ? AND d.related_module = ? AND d.related_transaction_id = ?
       ORDER BY d.generated_at DESC LIMIT 1`,
      [documentType, relatedModule, relatedTransactionId]
    );
    let row = rows[0] || null;

    // Legacy: bulk Add Item used to store one PAR/GRN against the first asset.
    // Keep batch fallback only when this asset has no direct document,
    // and for PAR prefer a document whose property tag matches this asset.
    if (
      !row
      && String(relatedModule || '').toLowerCase() === 'inventory'
      && ['PAR', 'GRN'].includes(String(documentType || '').toUpperCase())
    ) {
      const [targetRows] = await pool.query(
        'SELECT property_tag, batch_id FROM inventory_items WHERE id = ?',
        [relatedTransactionId]
      );
      const target = targetRows[0];
      const targetTag = String(target?.property_tag || '').trim();

      const [batchRows] = await pool.query(
        `SELECT d.*, u.full_name AS generated_by_name
         FROM document_history d
         LEFT JOIN users u ON d.generated_by = u.id
         JOIN inventory_items target ON target.id = ?
         JOIN inventory_items sibling
           ON sibling.batch_id IS NOT NULL
          AND sibling.batch_id <> ''
          AND sibling.batch_id = target.batch_id
         WHERE d.document_type = ?
           AND d.related_module = 'inventory'
           AND d.related_transaction_id = sibling.id
         ORDER BY d.generated_at DESC, d.id DESC`,
        [relatedTransactionId, documentType]
      );

      const parsed = batchRows.map((candidate) => {
        if (typeof candidate.payload === 'string') {
          try { candidate.payload = JSON.parse(candidate.payload); } catch { candidate.payload = {}; }
        }
        return candidate;
      });

      if (String(documentType).toUpperCase() === 'PAR' && targetTag) {
        row = parsed.find((candidate) => {
          const payload = candidate.payload || {};
          const single = String(payload?.items?.[0]?.propertyTag || '').trim();
          const list = Array.isArray(payload.propertyTags)
            ? payload.propertyTags
            : (payload?.items?.[0]?.propertyTags || []);
          const tags = list.map((t) => String(t || '').trim()).filter(Boolean);
          return single === targetTag || tags.includes(targetTag);
        }) || null;
      } else {
        row = parsed[0] || null;
      }
    }

    if (!row) return null;
    if (typeof row.payload === 'string') {
      try { row.payload = JSON.parse(row.payload); } catch { row.payload = {}; }
    }
    return row;
  },

  async findAllForInventoryItem(inventoryItemId) {
    const itemId = parseInt(inventoryItemId, 10);
    if (!itemId) return [];

    // Inventory acquisition docs (PAR/GRN):
    // - Prefer docs linked directly to this asset (1 asset = 1 PAR)
    // - Fall back to a sibling batch PAR/GRN only when this asset has none (legacy shared PAR)
    const [rows] = await pool.query(
      `SELECT d.*, u.full_name AS generated_by_name
       FROM document_history d
       LEFT JOIN users u ON d.generated_by = u.id
       WHERE
         (
           d.related_module = 'inventory'
           AND (
             d.related_transaction_id = ?
             OR (
               d.document_type IN ('PAR', 'GRN')
               AND d.related_transaction_id IN (
                 SELECT sibling.id
                 FROM inventory_items target
                 JOIN inventory_items sibling
                   ON sibling.batch_id IS NOT NULL
                  AND sibling.batch_id <> ''
                  AND sibling.batch_id = target.batch_id
                 WHERE target.id = ?
               )
               AND NOT EXISTS (
                 SELECT 1
                 FROM document_history own_doc
                 WHERE own_doc.document_type = d.document_type
                   AND own_doc.related_module = 'inventory'
                   AND own_doc.related_transaction_id = ?
               )
             )
           )
         )
         OR (d.related_module = 'disposal' AND d.related_transaction_id IN (
           SELECT id FROM disposal_requests WHERE inventory_item_id = ?
         ))
         OR (d.related_module = 'transfer' AND d.related_transaction_id IN (
           SELECT id FROM transfer_requests WHERE inventory_item_id = ?
         ))
         OR (d.related_module = 'borrow' AND d.related_transaction_id IN (
           SELECT bi.borrow_transaction_id
           FROM borrow_items bi
           WHERE bi.inventory_item_id = ?
         ))
       ORDER BY d.generated_at DESC, d.id DESC`,
      [itemId, itemId, itemId, itemId, itemId, itemId]
    );

    return rows.map((row) => {
      if (typeof row.payload === 'string') {
        try { row.payload = JSON.parse(row.payload); } catch { row.payload = {}; }
      }
      return row;
    });
  },

  async updatePayload(id, payload, status = 'Updated') {
    await pool.query(
      `UPDATE document_history SET payload = ?, status = ? WHERE id = ?`,
      [JSON.stringify(payload), status, id]
    );
  },

  async getAll(filters = {}) {
    let sql = `
      SELECT d.*, u.full_name AS generated_by_name
      FROM document_history d
      LEFT JOIN users u ON d.generated_by = u.id
      WHERE 1=1`;
    const params = [];

    if (filters.document_type) {
      sql += ' AND d.document_type = ?';
      params.push(filters.document_type);
    }
    if (filters.search) {
      sql += ' AND (d.document_number LIKE ? OR d.related_module LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term);
    }

    sql += ' ORDER BY d.generated_at DESC';
    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(filters.limit, 10));
    }

    const [rows] = await pool.query(sql, params);
    return rows.map(row => {
      if (typeof row.payload === 'string') {
        try { row.payload = JSON.parse(row.payload); } catch { row.payload = {}; }
      }
      return row;
    });
  }
};

module.exports = DocumentModel;
