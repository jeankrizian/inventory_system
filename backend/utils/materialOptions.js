const MATERIAL_OPTIONS = [
  'Wood',
  'Metal',
  'Plastic',
  'Glass',
  'Fabric'
];

function normalizeMaterial(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function isValidMaterial(value) {
  if (!value) return true;
  return MATERIAL_OPTIONS.includes(value);
}

module.exports = {
  MATERIAL_OPTIONS,
  normalizeMaterial,
  isValidMaterial
};
