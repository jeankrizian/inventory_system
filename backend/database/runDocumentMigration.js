const pool = require('../config/database');

async function runDocumentMigration() {
  console.log('Running document migration...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS document_sequences (
      document_type VARCHAR(10) NOT NULL,
      year INT NOT NULL,
      last_number INT NOT NULL DEFAULT 0,
      PRIMARY KEY (document_type, year)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS document_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      document_type ENUM('PAR', 'GRN', 'RDF') NOT NULL,
      document_number VARCHAR(50) NOT NULL UNIQUE,
      related_module VARCHAR(50) NULL,
      related_transaction_id INT NULL,
      generated_by INT NULL,
      generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      payload JSON NOT NULL,
      status VARCHAR(30) DEFAULT 'Generated',
      FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_doc_type (document_type),
      INDEX idx_doc_related (related_module, related_transaction_id)
    )
  `);

  console.log('Document migration completed.');
}

if (require.main === module) {
  runDocumentMigration().then(() => process.exit(0)).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { runDocumentMigration };
