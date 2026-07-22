const pool = require('../config/database');
const { normalizePropertyTag } = require('./assetClassification');

const AUTO_TAG_REGEX = /^(\d{8})-(\d+)$/;

/**
 * Parse a property tag ending in digits for legacy sequential generation.
 * Example: "2025-0001" -> { prefix: "2025-", startNum: 1, padWidth: 4 }
 */
function parseSequentialTag(tag) {
  const normalized = normalizePropertyTag(tag);
  if (!normalized) return null;

  const match = normalized.match(/^(.*?)(\d+)$/);
  if (!match) return null;

  return {
    prefix: match[1],
    startNum: parseInt(match[2], 10),
    padWidth: match[2].length
  };
}

function formatSequentialTag(parsed, offset) {
  const num = parsed.startNum + offset;
  return `${parsed.prefix}${String(num).padStart(parsed.padWidth, '0')}`;
}

function generatePropertyTagSequence(startingTag, count) {
  const parsed = parseSequentialTag(startingTag);
  if (!parsed) {
    throw new Error('Starting property tag must end with a number for sequential generation (e.g. 2025-0001)');
  }

  const total = Math.max(1, Number(count) || 1);
  const tags = [];
  for (let i = 0; i < total; i += 1) {
    tags.push(formatSequentialTag(parsed, i));
  }
  return tags;
}

function getDatePrefix(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function formatAutoPropertyTag(datePrefix, sequence) {
  return `${datePrefix}-${String(sequence).padStart(6, '0')}`;
}

function parseAutoTagSequence(tag) {
  if (!tag) return null;
  const match = String(tag).match(AUTO_TAG_REGEX);
  if (!match) return null;
  return parseInt(match[2], 10);
}

function isAutoPropertyTagFormat(tag) {
  return AUTO_TAG_REGEX.test(String(tag || ''));
}

async function getMaxGlobalPropertyTagSequence(conn = pool) {
  const [rows] = await conn.query(
    `SELECT property_tag FROM inventory_items
     WHERE property_tag IS NOT NULL`
  );

  let max = 0;
  for (const row of rows) {
    const seq = parseAutoTagSequence(row.property_tag);
    if (seq != null && seq > max) max = seq;
  }
  return max;
}

async function findConflictingPropertyTags(tags, conn = pool, excludeIds = []) {
  const normalized = tags.map(normalizePropertyTag).filter(Boolean);
  if (!normalized.length) return [];

  const placeholders = normalized.map(() => '?').join(', ');
  const params = [...normalized];
  let sql = `SELECT property_tag FROM inventory_items WHERE property_tag IN (${placeholders})`;

  if (excludeIds.length) {
    sql += ` AND id NOT IN (${excludeIds.map(() => '?').join(', ')})`;
    params.push(...excludeIds);
  }

  const [rows] = await conn.query(sql, params);
  return rows.map((r) => r.property_tag);
}

async function validatePropertyTagsUnique(tags, conn = pool, excludeIds = []) {
  const conflicts = await findConflictingPropertyTags(tags, conn, excludeIds);
  if (conflicts.length) {
    throw new Error(`Property tag(s) already exist: ${conflicts.join(', ')}`);
  }
  return true;
}

/**
 * Generate globally sequential property tags: YYYYMMDD-000001
 * The date prefix is the creation date; the numeric suffix never resets.
 *
 * options.startSequence — when provided, skip the max scan and continue from this
 *   sequence (used by Excel Import to scan once per import). Same format/padding.
 * options.onAllocated(nextSequence) — called with the next unused sequence after
 *   these tags (startSequence + count).
 */
async function generateAutoPropertyTags(count, conn = pool, options = {}) {
  const total = Math.max(1, Number(count) || 1);
  const datePrefix = getDatePrefix();
  const startSeq = options.startSequence != null
    ? Number(options.startSequence)
    : (await getMaxGlobalPropertyTagSequence(conn)) + 1;

  if (!Number.isFinite(startSeq) || startSeq < 1) {
    throw new Error('Invalid property tag start sequence');
  }

  const tags = [];

  for (let i = 0; i < total; i += 1) {
    tags.push(formatAutoPropertyTag(datePrefix, startSeq + i));
  }

  await validatePropertyTagsUnique(tags, conn);

  if (typeof options.onAllocated === 'function') {
    options.onAllocated(startSeq + total);
  }

  return tags;
}

function canAutoSequencePropertyTag(tag) {
  return parseSequentialTag(tag) !== null;
}

module.exports = {
  parseSequentialTag,
  formatSequentialTag,
  generatePropertyTagSequence,
  getDatePrefix,
  formatAutoPropertyTag,
  parseAutoTagSequence,
  isAutoPropertyTagFormat,
  getMaxGlobalPropertyTagSequence,
  generateAutoPropertyTags,
  findConflictingPropertyTags,
  validatePropertyTagsUnique,
  canAutoSequencePropertyTag
};
