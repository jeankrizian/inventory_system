const ROLES = {
  ADMINISTRATOR: 'admin',
  PROPERTY_MANAGER: 'property manager',
  CUSTODIAN: 'custodian',
  DEPARTMENT_CUSTODIAN: 'department custodian',
  LABORATORY_CUSTODIAN: 'laboratory custodian'
};

const ALLOWED_ROLE_NAMES = new Set(['admin', 'Property Manager', 'Custodian']);

function normalizeRoleName(role) {
  return (role || '').toLowerCase().trim();
}

/** Map user-facing role labels to canonical DB role names */
function resolveRoleDbName(role) {
  if (!role) return role;
  const normalized = normalizeRoleName(role);
  if (normalized === ROLES.ADMINISTRATOR || normalized === 'administrator') return 'admin';
  if (normalized === ROLES.PROPERTY_MANAGER) return 'Property Manager';
  if (
    normalized === ROLES.CUSTODIAN
    || normalized === ROLES.DEPARTMENT_CUSTODIAN
    || normalized === ROLES.LABORATORY_CUSTODIAN
  ) {
    return 'Custodian';
  }
  return String(role).trim();
}

function isAllowedRole(role) {
  const dbName = resolveRoleDbName(role);
  return ALLOWED_ROLE_NAMES.has(dbName);
}

function formatRoleDisplayName(role) {
  if (isCustodian(role)) return 'Custodian';
  if (isAdministrator(role)) return 'Administrator';
  if (isPropertyManager(role)) return 'Property Manager';
  return String(role || '').trim();
}

function isAdministrator(role) {
  const normalized = normalizeRoleName(role);
  return normalized === ROLES.ADMINISTRATOR || normalized === 'administrator';
}

function isPropertyManager(role) {
  return normalizeRoleName(role) === ROLES.PROPERTY_MANAGER;
}

function isCustodian(role) {
  const normalized = normalizeRoleName(role);
  return normalized === ROLES.CUSTODIAN
    || normalized === ROLES.DEPARTMENT_CUSTODIAN
    || normalized === ROLES.LABORATORY_CUSTODIAN;
}

function getCustodianScopeFromAssignments(user) {
  const departmentId = user?.assigned_department_id ?? null;

  if (departmentId) {
    return { type: 'department', departmentId };
  }
  return null;
}

function canApproveBorrow(role) {
  return isPropertyManager(role);
}

function canProcessReturn(role) {
  return isPropertyManager(role);
}

function canManageInventory(role) {
  return isAdministrator(role) || isPropertyManager(role);
}

function canViewInventory(role) {
  return isAdministrator(role) || isPropertyManager(role) || isCustodian(role);
}

function canSubmitBorrow(role) {
  return isAdministrator(role) || isPropertyManager(role) || isCustodian(role);
}

function canSubmitTransfer(role) {
  return isCustodian(role) || isPropertyManager(role);
}

function canSubmitMaintenance(role) {
  return isCustodian(role) || isPropertyManager(role);
}

function canOperateTransfers(role) {
  return isPropertyManager(role);
}

function canOperateMaintenance(role) {
  return isPropertyManager(role);
}

function canOperateDisposal(role) {
  return isPropertyManager(role);
}

function canAccessReports(role) {
  return isAdministrator(role) || isPropertyManager(role) || isCustodian(role);
}

const CUSTODIAN_ALLOWED_REPORT_TYPES = new Set([
  'inventory',
  'borrow',
  'return',
  'transfers',
  'maintenance',
  'disposals',
  'asset-status'
]);

function canAccessReportType(role, reportType) {
  if (isAdministrator(role) || isPropertyManager(role)) {
    return true;
  }
  if (isCustodian(role)) {
    return CUSTODIAN_ALLOWED_REPORT_TYPES.has(reportType);
  }
  return false;
}

/** Report data scope — department for custodians, school-wide for admin/PM */
function getReportAccessScope(user) {
  return getAccessScope(user);
}

function applyReportDepartmentScope(filters, scope) {
  if (
    scope?.type === 'department'
    && scope.departmentId
    && filters.department_id
    && filters.department_id !== scope.departmentId
  ) {
    filters.department_scope_mismatch = true;
    delete filters.department_id;
  }
  return filters;
}

function canAccessArchive(role) {
  return isAdministrator(role) || isPropertyManager(role);
}

function canManageSystem(role) {
  return isAdministrator(role);
}

function canViewBackups(role) {
  return isAdministrator(role) || isPropertyManager(role);
}

function canManageBackups(role) {
  return isAdministrator(role);
}

function canManageSuppliers(role) {
  return isAdministrator(role) || isPropertyManager(role);
}

function canViewReturnHistory(role) {
  return isAdministrator(role) || isPropertyManager(role);
}

function canViewTransfers(role) {
  return canSubmitTransfer(role) || canOperateTransfers(role);
}

function canViewAssetTransferHistory(role) {
  return canViewTransfers(role) || canViewInventory(role);
}

function canViewMaintenance(role) {
  return isAdministrator(role) || isPropertyManager(role) || isCustodian(role);
}

function canViewDisposal(role) {
  return isAdministrator(role) || isPropertyManager(role) || isCustodian(role);
}

function canSubmitDisposal(role) {
  return isPropertyManager(role) || isCustodian(role);
}

/** Data access scope for inventory and operational modules */
function getAccessScope(user) {
  const role = user?.role;
  const userId = user?.id;

  if (isAdministrator(role) || isPropertyManager(role)) {
    return { type: 'all', userId };
  }

  if (isCustodian(role)) {
    const assignmentScope = getCustodianScopeFromAssignments(user);
    if (assignmentScope?.type === 'department') {
      return { type: 'department', userId, departmentId: assignmentScope.departmentId };
    }
    return { type: 'denied', userId };
  }

  return { type: 'denied', userId };
}

/** Borrow list scope — school-wide for admin/PM; custodians see own requests */
function getBorrowListScope(user) {
  const role = user?.role;
  const userId = user?.id;

  if (isCustodian(role)) {
    return { type: 'own', userId };
  }

  if (isAdministrator(role) || isPropertyManager(role)) {
    return { type: 'all', userId };
  }

  return { type: 'none', userId };
}

function isInventoryScopeDenied(scope) {
  if (!scope) return false;
  return scope.type === 'own' || scope.type === 'none' || scope.type === 'denied';
}

function appendInventoryScopeSql(scope, tableAlias = 'i') {
  if (!scope || scope.type === 'all') {
    return { clause: '', params: [] };
  }
  if (isInventoryScopeDenied(scope)) {
    return { clause: '', params: [], denied: true };
  }
  if (scope.type === 'department') {
    if (!scope.departmentId) return { clause: '', params: [], denied: true };
    return { clause: ` AND ${tableAlias}.department_id = ?`, params: [scope.departmentId] };
  }
  if (scope.type === 'location') {
    if (!scope.locationId) return { clause: '', params: [], denied: true };
    return { clause: ` AND ${tableAlias}.location_id = ?`, params: [scope.locationId] };
  }
  return { clause: '', params: [], denied: true };
}

/** Transfer list scope — includes from/to department or location on the request */
function appendTransferRequestScopeSql(scope, inventoryAlias = 'i', transferAlias = 't') {
  if (!scope || scope.type === 'all') {
    return { clause: '', params: [] };
  }
  if (isInventoryScopeDenied(scope)) {
    return { clause: '', params: [], denied: true };
  }
  if (scope.type === 'department') {
    if (!scope.departmentId) return { clause: '', params: [], denied: true };
    const id = scope.departmentId;
    return {
      clause: ` AND (${inventoryAlias}.department_id = ? OR ${transferAlias}.from_department_id = ? OR ${transferAlias}.to_department_id = ?)`,
      params: [id, id, id]
    };
  }
  if (scope.type === 'location') {
    if (!scope.locationId) return { clause: '', params: [], denied: true };
    const id = scope.locationId;
    return {
      clause: ` AND (${inventoryAlias}.location_id = ? OR ${transferAlias}.from_location_id = ? OR ${transferAlias}.to_location_id = ?)`,
      params: [id, id, id]
    };
  }
  return { clause: '', params: [], denied: true };
}

function itemMatchesScope(item, scope) {
  if (!item || !scope || scope.type === 'all') return true;
  if (scope.type === 'department') {
    return scope.departmentId != null && item.department_id == scope.departmentId;
  }
  if (scope.type === 'location') {
    return scope.locationId != null && item.location_id == scope.locationId;
  }
  return false;
}

function transferMatchesScope(transfer, scope) {
  if (!transfer || !scope || scope.type === 'all') return true;
  if (scope.type === 'department') {
    return scope.departmentId != null && (
      transfer.from_department_id == scope.departmentId
      || transfer.to_department_id == scope.departmentId
      || transfer.department_id == scope.departmentId
    );
  }
  if (scope.type === 'location') {
    return scope.locationId != null && (
      transfer.from_location_id == scope.locationId
      || transfer.to_location_id == scope.locationId
      || transfer.location_id == scope.locationId
    );
  }
  return false;
}

function appendBorrowTransactionScopeSql(scope, tableAlias = 'bt') {
  if (!scope || scope.type === 'all') {
    return { clause: '', params: [] };
  }
  if (scope.type === 'own') {
    if (!scope.userId) {
      return { clause: ' AND 1=0', params: [] };
    }
    return { clause: ` AND ${tableAlias}.borrower_id = ?`, params: [scope.userId] };
  }
  if (scope.type === 'none') {
    return { clause: ' AND 1=0', params: [] };
  }
  if (scope.type === 'department') {
    if (!scope.departmentId) return { clause: ' AND 1=0', params: [] };
    return {
      clause: ` AND EXISTS (SELECT 1 FROM borrow_items bi_scope JOIN inventory_items i_scope ON bi_scope.inventory_item_id = i_scope.id WHERE bi_scope.borrow_transaction_id = ${tableAlias}.id AND i_scope.department_id = ?)`,
      params: [scope.departmentId]
    };
  }
  if (scope.type === 'denied') {
    return { clause: ' AND 1=0', params: [] };
  }
  if (scope.type === 'location') {
    if (!scope.locationId) return { clause: ' AND 1=0', params: [] };
    return {
      clause: ` AND EXISTS (SELECT 1 FROM borrow_items bi_scope JOIN inventory_items i_scope ON bi_scope.inventory_item_id = i_scope.id WHERE bi_scope.borrow_transaction_id = ${tableAlias}.id AND i_scope.location_id = ?)`,
      params: [scope.locationId]
    };
  }
  return { clause: ' AND 1=0', params: [] };
}

function borrowTransactionMatchesScope(transaction, scope) {
  if (!scope || scope.type === 'all') return true;
  if (scope.type === 'own') {
    return transaction?.borrower_id === scope.userId;
  }
  return (transaction?.items || []).some((item) => itemMatchesScope(item, scope));
}

function buildSessionUser(dbUser) {
  if (!dbUser) return null;
  return {
    id: dbUser.id,
    username: dbUser.username,
    email: dbUser.email,
    full_name: dbUser.full_name,
    role: dbUser.role_name || dbUser.role,
    profile_image: dbUser.profile_image,
    assigned_department_id: dbUser.assigned_department_id ?? null,
    assigned_location_id: dbUser.assigned_location_id ?? null
  };
}

module.exports = {
  ROLES,
  ALLOWED_ROLE_NAMES,
  normalizeRoleName,
  resolveRoleDbName,
  isAllowedRole,
  formatRoleDisplayName,
  isAdministrator,
  isPropertyManager,
  isCustodian,
  getCustodianScopeFromAssignments,
  canApproveBorrow,
  canProcessReturn,
  canManageInventory,
  canViewInventory,
  canSubmitBorrow,
  canSubmitTransfer,
  canSubmitMaintenance,
  canOperateTransfers,
  canOperateMaintenance,
  canOperateDisposal,
  canAccessReports,
  canAccessReportType,
  CUSTODIAN_ALLOWED_REPORT_TYPES,
  getReportAccessScope,
  applyReportDepartmentScope,
  canAccessArchive,
  canManageSystem,
  canViewBackups,
  canManageBackups,
  canManageSuppliers,
  canViewReturnHistory,
  canViewTransfers,
  canViewAssetTransferHistory,
  canViewMaintenance,
  canViewDisposal,
  canSubmitDisposal,
  getAccessScope,
  getBorrowListScope,
  isInventoryScopeDenied,
  appendInventoryScopeSql,
  appendTransferRequestScopeSql,
  appendBorrowTransactionScopeSql,
  itemMatchesScope,
  transferMatchesScope,
  borrowTransactionMatchesScope,
  buildSessionUser
};
