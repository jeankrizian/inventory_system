const ROLES = {
  ADMINISTRATOR: 'admin',
  PROPERTY_MANAGER: 'property manager',
  DEPARTMENT_CUSTODIAN: 'department custodian',
  LABORATORY_CUSTODIAN: 'laboratory custodian',
  EMPLOYEE: 'staff'
};

const NAV_ROLES = {
  ADMINISTRATOR: 'administrator',
  PROPERTY_MANAGER: 'property_manager',
  CUSTODIAN: 'custodian',
  EMPLOYEE: 'employee'
};

/** @deprecated Use isAdministrator — kept for minimal migration churn */
const ADMIN_ROLES = [ROLES.ADMINISTRATOR, ROLES.PROPERTY_MANAGER];

function normalizeRoleName(role) {
  return (role || '').toLowerCase().trim();
}

/** Map user-facing role labels to canonical DB role names */
function resolveRoleDbName(role) {
  if (!role) return role;
  const normalized = normalizeRoleName(role);
  if (normalized === ROLES.EMPLOYEE || normalized === 'employee') return 'staff';
  if (normalized === ROLES.ADMINISTRATOR || normalized === 'administrator') return 'admin';
  if (normalized === ROLES.PROPERTY_MANAGER) return 'Property Manager';
  if (normalized === ROLES.DEPARTMENT_CUSTODIAN) return 'Department Custodian';
  if (normalized === ROLES.LABORATORY_CUSTODIAN) return 'Laboratory Custodian';
  return String(role).trim();
}

function getRoleKey(role) {
  const normalized = normalizeRoleName(role);
  if (normalized === ROLES.ADMINISTRATOR) return NAV_ROLES.ADMINISTRATOR;
  if (normalized === ROLES.PROPERTY_MANAGER) return NAV_ROLES.PROPERTY_MANAGER;
  if (normalized === ROLES.DEPARTMENT_CUSTODIAN || normalized === ROLES.LABORATORY_CUSTODIAN) {
    return NAV_ROLES.CUSTODIAN;
  }
  return NAV_ROLES.EMPLOYEE;
}

function isAdministrator(role) {
  const normalized = normalizeRoleName(role);
  return normalized === ROLES.ADMINISTRATOR || normalized === 'administrator';
}

function isPropertyManager(role) {
  return normalizeRoleName(role) === ROLES.PROPERTY_MANAGER;
}

function isDepartmentCustodian(role) {
  return normalizeRoleName(role) === ROLES.DEPARTMENT_CUSTODIAN;
}

function isLaboratoryCustodian(role) {
  return normalizeRoleName(role) === ROLES.LABORATORY_CUSTODIAN;
}

function isCustodian(role) {
  return isDepartmentCustodian(role) || isLaboratoryCustodian(role);
}

function isEmployee(role) {
  const normalized = normalizeRoleName(role);
  return normalized === ROLES.EMPLOYEE || normalized === 'staff' || normalized === 'employee';
}

/** @deprecated Former admin tier — use specific permission helpers instead */
function isAdminRole(role) {
  return ADMIN_ROLES.includes(normalizeRoleName(role));
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
  return isAdministrator(role) || isPropertyManager(role) || isCustodian(role) || isEmployee(role);
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
  return isAdministrator(role) || isPropertyManager(role);
}

function canAccessArchive(role) {
  return isAdministrator(role) || isPropertyManager(role);
}

function canManageSystem(role) {
  return isAdministrator(role);
}

function canManageSuppliers(role) {
  return isAdministrator(role) || isPropertyManager(role);
}

function canViewAllBorrows(role) {
  return isAdministrator(role) || isPropertyManager(role) || isCustodian(role);
}

function canViewReturnHistory(role) {
  return isAdministrator(role) || isPropertyManager(role) || isCustodian(role);
}

function canViewTransfers(role) {
  return canSubmitTransfer(role) || canOperateTransfers(role);
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

  if (isEmployee(role)) {
    return { type: 'own', userId };
  }

  if (isDepartmentCustodian(role)) {
    return {
      type: 'department',
      userId,
      departmentId: user?.assigned_department_id ?? null
    };
  }

  if (isLaboratoryCustodian(role)) {
    return {
      type: 'location',
      userId,
      locationId: user?.assigned_location_id ?? null
    };
  }

  return { type: 'all', userId };
}

/** Borrow list scope — admin/PM see all; custodians by dept/location; employees own only */
function getBorrowListScope(user) {
  const role = user?.role;
  const userId = user?.id;

  if (isEmployee(role)) {
    return { type: 'own', userId };
  }

  if (isAdministrator(role) || isPropertyManager(role)) {
    return { type: 'all', userId };
  }

  if (isDepartmentCustodian(role)) {
    return {
      type: 'department',
      userId,
      departmentId: user?.assigned_department_id ?? null
    };
  }

  if (isLaboratoryCustodian(role)) {
    return {
      type: 'location',
      userId,
      locationId: user?.assigned_location_id ?? null
    };
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
  NAV_ROLES,
  ADMIN_ROLES,
  normalizeRoleName,
  resolveRoleDbName,
  getRoleKey,
  isAdministrator,
  isPropertyManager,
  isDepartmentCustodian,
  isLaboratoryCustodian,
  isCustodian,
  isEmployee,
  isAdminRole,
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
  canAccessArchive,
  canManageSystem,
  canManageSuppliers,
  canViewAllBorrows,
  canViewReturnHistory,
  canViewTransfers,
  canViewMaintenance,
  canViewDisposal,
  canSubmitDisposal,
  getAccessScope,
  getBorrowListScope,
  isInventoryScopeDenied,
  appendInventoryScopeSql,
  appendBorrowTransactionScopeSql,
  itemMatchesScope,
  borrowTransactionMatchesScope,
  buildSessionUser
};
