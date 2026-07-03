const ADMIN_ROLES = ['admin', 'property manager'];

function normalizeRoleName(role) {
  return (role || '').toLowerCase().trim();
}

function isAdminRole(role) {
  return ADMIN_ROLES.includes(normalizeRoleName(role));
}

module.exports = { ADMIN_ROLES, normalizeRoleName, isAdminRole };
