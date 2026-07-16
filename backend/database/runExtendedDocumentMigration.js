const pool = require('../config/database');

async function runExtendedDocumentMigration() {
  console.log('Running extended document migration...');

  await pool.query(`
    ALTER TABLE document_history
    MODIFY COLUMN document_type ENUM('PAR', 'GRN', 'RDF', 'ABL', 'TRF', 'RTF') NOT NULL
  `);

  console.log('Extended document migration completed.');
}

if (require.main === module) {
  runExtendedDocumentMigration().then(() => process.exit(0)).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { runExtendedDocumentMigration };
