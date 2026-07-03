const pool = require('../config/database');

async function getNextDocumentNumber(documentType) {
  const year = new Date().getFullYear();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      'SELECT last_number FROM document_sequences WHERE document_type = ? AND year = ? FOR UPDATE',
      [documentType, year]
    );

    let nextNumber = 1;
    if (rows.length) {
      nextNumber = rows[0].last_number + 1;
      await connection.query(
        'UPDATE document_sequences SET last_number = ? WHERE document_type = ? AND year = ?',
        [nextNumber, documentType, year]
      );
    } else {
      await connection.query(
        'INSERT INTO document_sequences (document_type, year, last_number) VALUES (?, ?, 1)',
        [documentType, year]
      );
    }

    await connection.commit();
    return `${documentType}-${year}-${String(nextNumber).padStart(6, '0')}`;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = { getNextDocumentNumber };
