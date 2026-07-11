const pool = require('../config/database');

const DOCUMENT_TYPES = new Set(['GRN', 'PAR', 'ABL', 'TRF', 'RDF', 'SAL']);
const STANDARD_DOCUMENT_NUMBER_REGEX = /^([A-Z]+)-(\d{4})-(\d{6})$/;
const LEGACY_YEAR_SUFFIX_REGEX = /^([A-Z]+)-(\d{4})-(\d+)$/;
const LEGACY_SHORT_REGEX = /^([A-Z]+)-(\d+)$/;

function formatDocumentNumber(documentType, year, sequence) {
  const type = String(documentType || '').toUpperCase();
  const y = Number(year);
  const seq = Math.max(1, Number(sequence) || 1);
  return `${type}-${y}-${String(seq).padStart(6, '0')}`;
}

function parseDocumentNumber(documentNumber) {
  if (!documentNumber) return null;
  const value = String(documentNumber).trim().toUpperCase();

  let match = value.match(STANDARD_DOCUMENT_NUMBER_REGEX);
  if (match) {
    return {
      documentType: match[1],
      year: parseInt(match[2], 10),
      sequence: parseInt(match[3], 10),
      format: 'standard'
    };
  }

  match = value.match(LEGACY_YEAR_SUFFIX_REGEX);
  if (match) {
    return {
      documentType: match[1],
      year: parseInt(match[2], 10),
      sequence: parseInt(match[3], 10),
      format: 'legacy-year'
    };
  }

  match = value.match(LEGACY_SHORT_REGEX);
  if (match) {
    return {
      documentType: match[1],
      year: null,
      sequence: parseInt(match[2], 10),
      format: 'legacy-short'
    };
  }

  return {
    documentType: null,
    year: null,
    sequence: null,
    format: 'legacy-freeform',
    raw: value
  };
}

async function getNextDocumentNumber(documentType, conn = null) {
  const type = String(documentType || '').toUpperCase();
  if (!DOCUMENT_TYPES.has(type)) {
    throw new Error(`Unsupported document type: ${documentType}`);
  }

  const year = new Date().getFullYear();
  const ownConnection = conn ? null : await pool.getConnection();
  const connection = conn || ownConnection;

  try {
    if (!conn) await connection.beginTransaction();

    const [rows] = await connection.query(
      'SELECT last_number FROM document_sequences WHERE document_type = ? AND year = ? FOR UPDATE',
      [type, year]
    );

    let nextNumber = 1;
    if (rows.length) {
      nextNumber = rows[0].last_number + 1;
      await connection.query(
        'UPDATE document_sequences SET last_number = ? WHERE document_type = ? AND year = ?',
        [nextNumber, type, year]
      );
    } else {
      await connection.query(
        'INSERT INTO document_sequences (document_type, year, last_number) VALUES (?, ?, 1)',
        [type, year]
      );
    }

    if (!conn) await connection.commit();
    return formatDocumentNumber(type, year, nextNumber);
  } catch (err) {
    if (!conn) await connection.rollback();
    throw err;
  } finally {
    if (ownConnection) ownConnection.release();
  }
}

module.exports = {
  DOCUMENT_TYPES,
  STANDARD_DOCUMENT_NUMBER_REGEX,
  formatDocumentNumber,
  parseDocumentNumber,
  getNextDocumentNumber
};
