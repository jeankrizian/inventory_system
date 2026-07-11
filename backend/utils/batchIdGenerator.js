const pool = require('../config/database');
const { getDatePrefix } = require('./propertyTagGenerator');

const BATCH_ID_REGEX = /^BATCH-(\d{8})-(\d+)$/;

function formatBatchId(datePrefix, sequence) {
  return `BATCH-${datePrefix}-${String(sequence).padStart(3, '0')}`;
}

function parseBatchSequence(batchId) {
  if (!batchId) return null;
  const match = String(batchId).match(BATCH_ID_REGEX);
  if (!match) return null;
  return parseInt(match[2], 10);
}

function isValidBatchIdFormat(batchId) {
  return BATCH_ID_REGEX.test(String(batchId || ''));
}

async function getMaxGlobalBatchSequence(conn = pool) {
  const [rows] = await conn.query(
    `SELECT batch_id FROM inventory_items
     WHERE batch_id IS NOT NULL AND is_archived = 0`
  );

  let max = 0;
  for (const row of rows) {
    const seq = parseBatchSequence(row.batch_id);
    if (seq != null && seq > max) max = seq;
  }
  return max;
}

/**
 * Generate the next batch ID: BATCH-YYYYMMDD-001
 * Numeric suffix increments globally and does not reset per day.
 */
async function generateNextBatchId(conn = pool) {
  const datePrefix = getDatePrefix();
  const nextSeq = (await getMaxGlobalBatchSequence(conn)) + 1;
  return formatBatchId(datePrefix, nextSeq);
}

module.exports = {
  BATCH_ID_REGEX,
  formatBatchId,
  parseBatchSequence,
  isValidBatchIdFormat,
  getMaxGlobalBatchSequence,
  generateNextBatchId
};
