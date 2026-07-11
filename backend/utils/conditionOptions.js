const CONDITION_OPTIONS = [
  'New',
  'Excellent',
  'Good',
  'Fair',
  'Poor',
  'For Repair',
  'Damaged',
  'Unserviceable'
];

function normalizeCondition(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function isValidCondition(value) {
  if (!value) return true;
  return CONDITION_OPTIONS.includes(value);
}

module.exports = {
  CONDITION_OPTIONS,
  normalizeCondition,
  isValidCondition
};
