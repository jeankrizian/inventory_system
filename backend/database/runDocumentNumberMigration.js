/**
 * Sync document_sequences from existing document_history numbers (backward compat).
 */
const pool = require('../config/database');
const { parseDocumentNumber } = require('../utils/documentNumber');

async function runDocumentNumberMigration() {
  const [rows] = await pool.query(
    `SELECT document_type, document_number, generated_at
     FROM document_history
     WHERE document_number IS NOT NULL AND TRIM(document_number) != ''`
  );

  const maxByTypeYear = new Map();

  for (const row of rows) {
    const parsed = parseDocumentNumber(row.document_number);
    if (!parsed?.documentType || !parsed.sequence) continue;

    const year = parsed.year || new Date(row.generated_at || Date.now()).getFullYear();
    const key = `${parsed.documentType}:${year}`;
    const current = maxByTypeYear.get(key) || 0;
    if (parsed.sequence > current) {
      maxByTypeYear.set(key, parsed.sequence);
    }
  }

  let synced = 0;
  for (const [key, lastNumber] of maxByTypeYear.entries()) {
    const [documentType, year] = key.split(':');
    const [existing] = await pool.query(
      'SELECT last_number FROM document_sequences WHERE document_type = ? AND year = ?',
      [documentType, Number(year)]
    );

    if (!existing.length) {
      await pool.query(
        'INSERT INTO document_sequences (document_type, year, last_number) VALUES (?, ?, ?)',
        [documentType, Number(year), lastNumber]
      );
      synced += 1;
    } else if (existing[0].last_number < lastNumber) {
      await pool.query(
        'UPDATE document_sequences SET last_number = ? WHERE document_type = ? AND year = ?',
        [lastNumber, documentType, Number(year)]
      );
      synced += 1;
    }
  }

  console.log(
    `Document number migration completed. Sequence rows synced: ${synced}, documents scanned: ${rows.length}.`
  );
  return { synced, scanned: rows.length };
}

module.exports = { runDocumentNumberMigration };
