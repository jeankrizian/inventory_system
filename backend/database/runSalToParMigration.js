/**
 * Migrate all SAL documents to PAR and remove SAL from the active schema.
 * - document_type SAL → PAR
 * - document_number SAL-YYYY-###### → PAR-YYYY-###### (next free if conflict)
 * - RDF / payload references updated
 * - document_sequences SAL merged into PAR, then deleted
 * - ENUM updated to drop SAL
 */
const pool = require('../config/database');
const { formatDocumentNumber, parseDocumentNumber } = require('../utils/documentNumber');

function parsePayload(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return { ...raw };
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function rewriteSalNumber(value, numberMap) {
  if (value == null) return value;
  const text = String(value);
  if (numberMap.has(text)) return numberMap.get(text);
  if (/^SAL-/i.test(text)) {
    const candidate = text.replace(/^SAL-/i, 'PAR-');
    return numberMap.get(text.toUpperCase()) || numberMap.get(candidate) || candidate;
  }
  return text;
}

function normalizeMigratedParPayload(payload, newNumber) {
  const next = { ...payload };
  next.documentNumber = newNumber;
  if (!next.deliveryDate && next.issueDate) next.deliveryDate = next.issueDate;
  if (!next.preparedBy && next.issuedBy) next.preparedBy = next.issuedBy;
  if (next.classification) {
    const c = String(next.classification).toLowerCase();
    if (c.includes('semi')) next.classification = 'Semi-Durable';
    else if (c.includes('non-consumable') || c.includes('fixed') || c === 'durable') next.classification = 'Durable';
  }
  return next;
}

function rewriteRdfPayload(payload, numberMap) {
  const next = { ...payload };
  next.sourceDocLabel = 'PAR No.';
  next.sourceDocType = 'PAR';
  if (next.sourceDocNumber) {
    next.sourceDocNumber = rewriteSalNumber(next.sourceDocNumber, numberMap);
  }
  next.items = (next.items || []).map((item) => {
    const row = { ...item };
    if (row.sourceDocNumber) row.sourceDocNumber = rewriteSalNumber(row.sourceDocNumber, numberMap);
    if (row.parNo) row.parNo = rewriteSalNumber(row.parNo, numberMap);
    return row;
  });
  return next;
}

async function allocateParNumber(connection, preferredNumber, usedNumbers) {
  const preferred = String(preferredNumber || '').replace(/^SAL-/i, 'PAR-').toUpperCase();
  if (preferred && !usedNumbers.has(preferred)) {
    usedNumbers.add(preferred);
    return preferred;
  }

  const parsed = parseDocumentNumber(preferred);
  const year = parsed?.year || new Date().getFullYear();

  const [seqRows] = await connection.query(
    'SELECT last_number FROM document_sequences WHERE document_type = ? AND year = ? FOR UPDATE',
    ['PAR', year]
  );
  let next = seqRows.length ? Number(seqRows[0].last_number) + 1 : 1;

  let candidate = formatDocumentNumber('PAR', year, next);
  while (usedNumbers.has(candidate)) {
    next += 1;
    candidate = formatDocumentNumber('PAR', year, next);
  }

  if (seqRows.length) {
    await connection.query(
      'UPDATE document_sequences SET last_number = ? WHERE document_type = ? AND year = ?',
      [next, 'PAR', year]
    );
  } else {
    await connection.query(
      'INSERT INTO document_sequences (document_type, year, last_number) VALUES (?, ?, ?)',
      ['PAR', year, next]
    );
  }

  usedNumbers.add(candidate);
  return candidate;
}

async function runSalToParMigration() {
  console.log('Migrating SAL documents to PAR...');
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Ensure ENUM still accepts SAL during migration
    await connection.query(`
      ALTER TABLE document_history
      MODIFY COLUMN document_type ENUM('PAR', 'GRN', 'RDF', 'ABL', 'TRF', 'RTF', 'SAL') NOT NULL
    `);

    const [existingPars] = await connection.query(
      `SELECT document_number FROM document_history WHERE document_type = 'PAR'`
    );
    const usedNumbers = new Set(
      existingPars.map((row) => String(row.document_number || '').toUpperCase()).filter(Boolean)
    );

    const [salDocs] = await connection.query(
      `SELECT id, document_number, payload FROM document_history WHERE document_type = 'SAL' ORDER BY id ASC`
    );

    const numberMap = new Map();

    for (const doc of salDocs) {
      const oldNumber = String(doc.document_number || '');
      const preferred = oldNumber.replace(/^SAL-/i, 'PAR-');
      const newNumber = await allocateParNumber(connection, preferred, usedNumbers);
      numberMap.set(oldNumber, newNumber);
      numberMap.set(oldNumber.toUpperCase(), newNumber);

      const payload = normalizeMigratedParPayload(parsePayload(doc.payload), newNumber);

      await connection.query(
        `UPDATE document_history
         SET document_type = 'PAR', document_number = ?, payload = ?
         WHERE id = ?`,
        [newNumber, JSON.stringify(payload), doc.id]
      );

      console.log(`  Migrated ${oldNumber || '(blank)'} → ${newNumber} (id=${doc.id})`);
    }

    // Rewrite RDF payloads that still reference SAL
    const [rdfDocs] = await connection.query(
      `SELECT id, payload FROM document_history
       WHERE document_type = 'RDF'
         AND (
           CAST(payload AS CHAR) LIKE '%SAL%'
           OR CAST(payload AS CHAR) LIKE '%sal%'
         )`
    );

    for (const doc of rdfDocs) {
      const payload = rewriteRdfPayload(parsePayload(doc.payload), numberMap);
      await connection.query(
        `UPDATE document_history SET payload = ? WHERE id = ?`,
        [JSON.stringify(payload), doc.id]
      );
    }

    // Merge SAL sequences into PAR, then drop SAL sequences
    const [salSequences] = await connection.query(
      `SELECT year, last_number FROM document_sequences WHERE document_type = 'SAL'`
    );
    for (const seq of salSequences) {
      const [parSeq] = await connection.query(
        `SELECT last_number FROM document_sequences WHERE document_type = 'PAR' AND year = ?`,
        [seq.year]
      );
      const merged = Math.max(
        Number(seq.last_number) || 0,
        parSeq.length ? Number(parSeq[0].last_number) || 0 : 0
      );
      if (parSeq.length) {
        await connection.query(
          `UPDATE document_sequences SET last_number = ? WHERE document_type = 'PAR' AND year = ?`,
          [merged, seq.year]
        );
      } else if (merged > 0) {
        await connection.query(
          `INSERT INTO document_sequences (document_type, year, last_number) VALUES ('PAR', ?, ?)`,
          [seq.year, merged]
        );
      }
    }
    await connection.query(`DELETE FROM document_sequences WHERE document_type = 'SAL'`);

    // Drop SAL from ENUM
    await connection.query(`
      ALTER TABLE document_history
      MODIFY COLUMN document_type ENUM('PAR', 'GRN', 'RDF', 'ABL', 'TRF', 'RTF') NOT NULL
    `);

    await connection.commit();
    console.log(`SAL → PAR migration complete. Migrated ${salDocs.length} document(s).`);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

if (require.main === module) {
  runSalToParMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runSalToParMigration };
