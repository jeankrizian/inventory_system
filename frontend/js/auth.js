/**
 * Authentication & utility helpers
 */

let cachedUser = null;
let authCheckPromise = null;

/** Clear cached auth state (call on logout) */
function clearAuthCache() {
  cachedUser = null;
  authCheckPromise = null;
}

/** Check auth and redirect if not logged in */
async function requireAuth() {
  if (cachedUser) return cachedUser;

  if (!authCheckPromise) {
    authCheckPromise = API.getMe().finally(() => { authCheckPromise = null; });
  }

  try {
    const res = await authCheckPromise;
    if (!res || !res.success) {
      clearAuthCache();
      window.location.href = '/index.html';
      return null;
    }
    cachedUser = res.data;
    return cachedUser;
  } catch {
    clearAuthCache();
    window.location.href = '/index.html';
    return null;
  }
}

/** Redirect to dashboard if already logged in */
async function redirectIfAuthenticated() {
  try {
    const res = await API.getMe();
    if (res && res.success) {
      cachedUser = res.data;
      window.location.replace('/pages/dashboard.html');
    }
  } catch {
    /* not logged in — stay on login page */
  }
}

const ACCESS_DENIED_TOAST_KEY = 'accessDeniedToast';
const AUTH_EXPIRED_TOAST_KEY = 'authExpiredToast';

/** Show a toast stored before a redirect (route guard / session expiry) */
function showPendingRedirectToast(storageKey) {
  const msg = sessionStorage.getItem(storageKey);
  if (!msg) return;
  sessionStorage.removeItem(storageKey);
  showToast(msg, 'error');
}

function showPendingAccessDeniedToast() {
  showPendingRedirectToast(ACCESS_DENIED_TOAST_KEY);
}

function showPendingAuthExpiredToast() {
  showPendingRedirectToast(AUTH_EXPIRED_TOAST_KEY);
}

/** Redirect unauthorized page access to dashboard with toast */
function denyPageAccess(message = 'You do not have permission to access that page.') {
  sessionStorage.setItem(ACCESS_DENIED_TOAST_KEY, message);
  window.location.replace('/pages/dashboard.html');
}

/** Show toast notification */
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-custom ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function openGeneratedDocument(doc, label) {
  if (!doc?.id) return;
  showToast(`${label || doc.document_type} ${doc.document_number} generated`);
  setTimeout(() => API.openDocumentPreview(doc.id), 500);
}

async function openDocumentForTransaction(type, module, transactionId) {
  try {
    const res = await API.lookupDocument(type, module, transactionId);
    API.openDocumentPreview(res.data.id);
  } catch (err) {
    showToast(err.message || 'Document not found', 'error');
  }
}

async function openBorrowDocument(borrowId) {
  try {
    const res = await API.lookupDocument('ABL', 'borrow', borrowId);
    API.openDocumentPreview(res.data.id);
  } catch {
    try {
      const res = await API.lookupDocument('PAR', 'borrow', borrowId);
      API.openDocumentPreview(res.data.id);
    } catch (err) {
      showToast(err.message || 'Document not found', 'error');
    }
  }
}

async function openTransferDocument(transferId) {
  try {
    const res = await API.lookupDocument('TRF', 'transfer', transferId);
    API.openDocumentPreview(res.data.id);
  } catch {
    try {
      const res = await API.lookupDocument('PAR', 'transfer', transferId);
      API.openDocumentPreview(res.data.id);
    } catch (err) {
      showToast(err.message || 'Document not found', 'error');
    }
  }
}

/** Format date string */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Map user role to navigation permission group */
function normalizeNavRole(user) {
  return getRoleKey(user?.role_name || user?.role);
}

function getRoleKey(role) {
  const normalized = (role || '').toLowerCase().trim();
  if (normalized === 'admin') return 'administrator';
  if (normalized === 'property manager') return 'property_manager';
  if (normalized === 'custodian' || normalized === 'department custodian' || normalized === 'laboratory custodian') {
    return 'custodian';
  }
  return null;
}

function getUserRoleName(user) {
  return (user?.role_name || user?.role || '').toLowerCase().trim();
}

function isAdministrator(user) {
  const role = getUserRoleName(user);
  return role === 'admin' || role === 'administrator';
}

function isPropertyManager(user) {
  return getUserRoleName(user) === 'property manager';
}

function isCustodian(user) {
  const role = getUserRoleName(user);
  return role === 'custodian' || role === 'department custodian' || role === 'laboratory custodian';
}

function formatRoleDisplayName(userOrRole) {
  const role = typeof userOrRole === 'string'
    ? userOrRole.toLowerCase().trim()
    : getUserRoleName(userOrRole);
  if (role === 'custodian' || role === 'department custodian' || role === 'laboratory custodian') {
    return 'Custodian';
  }
  if (role === 'admin' || role === 'administrator') return 'Administrator';
  if (role === 'property manager') return 'Property Manager';
  return userOrRole?.role_name || userOrRole?.role || userOrRole || '-';
}

function isEmployee(user) {
  return false;
}

/** @deprecated Use isAdministrator or isPropertyManager — former admin tier */
function isAdminUser(user) {
  return isAdministrator(user) || isPropertyManager(user);
}

function canApproveBorrow(user) {
  return isPropertyManager(user);
}

function canProcessReturn(user) {
  return isPropertyManager(user);
}

function canManageInventory(user) {
  return isAdministrator(user) || isPropertyManager(user);
}

function canViewInventory(user) {
  return isAdministrator(user) || isPropertyManager(user) || isCustodian(user);
}

function canSubmitBorrow(user) {
  return isAdministrator(user) || isPropertyManager(user) || isCustodian(user);
}

function canSubmitTransfer(user) {
  return isCustodian(user) || isPropertyManager(user);
}

function canSubmitMaintenance(user) {
  return isCustodian(user) || isPropertyManager(user);
}

function canOperateTransfers(user) {
  return isPropertyManager(user);
}

function canOperateMaintenance(user) {
  return isPropertyManager(user);
}

function canOperateDisposal(user) {
  return isPropertyManager(user);
}

function canAccessReports(user) {
  return isAdministrator(user) || isPropertyManager(user) || isCustodian(user);
}

const CUSTODIAN_REPORT_TYPES = new Set([
  'inventory',
  'borrow',
  'return',
  'low-stock',
  'transfers',
  'maintenance',
  'disposals',
  'asset-status'
]);

function canAccessReportType(user, reportType) {
  if (isAdministrator(user) || isPropertyManager(user)) return true;
  if (isCustodian(user)) return CUSTODIAN_REPORT_TYPES.has(reportType);
  return false;
}

function canAccessArchive(user) {
  return isAdministrator(user) || isPropertyManager(user);
}

function canManageSystem(user) {
  return isAdministrator(user);
}

function canViewBackups(user) {
  return isAdministrator(user) || isPropertyManager(user);
}

function canManageBackups(user) {
  return isAdministrator(user);
}

function canManageSuppliers(user) {
  return isAdministrator(user) || isPropertyManager(user);
}

function canViewReturnHistory(user) {
  return isAdministrator(user) || isPropertyManager(user);
}

function canViewAllBorrows(user) {
  return isAdministrator(user) || isPropertyManager(user);
}

function canViewTransfers(user) {
  return canSubmitTransfer(user) || canOperateTransfers(user);
}

function canViewMaintenance(user) {
  return isAdministrator(user) || isPropertyManager(user) || isCustodian(user);
}

function canViewDisposal(user) {
  return isAdministrator(user) || isPropertyManager(user) || isCustodian(user);
}

function canSubmitDisposal(user) {
  return isPropertyManager(user) || isCustodian(user);
}

function canViewPersonalBorrowStats(user) {
  return false;
}

function canViewInventoryDashboard(user) {
  return isAdministrator(user) || isPropertyManager(user) || isCustodian(user);
}

function canViewUsersDashboard(user) {
  return isAdministrator(user);
}

function canViewTransferDashboard(user) {
  return isPropertyManager(user) || isCustodian(user);
}

function canViewMaintenanceDashboard(user) {
  return isPropertyManager(user) || isCustodian(user);
}

function canViewDisposalDashboard(user) {
  return isPropertyManager(user) || isCustodian(user);
}

function canViewPendingApprovalsDashboard(user) {
  return isPropertyManager(user);
}

function canViewOperationalDashboard(user) {
  return canViewTransferDashboard(user) || canViewMaintenanceDashboard(user);
}

function canViewPersonalDashboardOnly(user) {
  return false;
}

function canViewDashboardCharts(user) {
  return isAdministrator(user) || isPropertyManager(user);
}

function canViewLowStockDashboard(user) {
  return isAdministrator(user) || isPropertyManager(user) || isCustodian(user);
}

function canViewAssetsNeedingAttention(user) {
  return isCustodian(user);
}

function canViewRecentBorrowsDashboard(user) {
  return isPropertyManager(user);
}

function canViewRecentReturnsDashboard(user) {
  return isPropertyManager(user);
}

function canViewDashboardActivities(user) {
  return isAdministrator(user) || isPropertyManager(user) || isCustodian(user);
}

function getDashboardStatTitle(user, module) {
  if (module === 'inventoryStats' && isCustodian(user)) return 'Assigned Assets';
  if (module === 'inventoryStats' && isAdministrator(user)) return 'Inventory Summary';
  if (module === 'inventoryStats' && isPropertyManager(user)) return 'Inventory Summary';
  if (module === 'personalBorrowStats') return 'My Borrow Summary';
  if (module === 'pendingApprovals') return 'Pending Approvals';
  if (module === 'usersStats') return 'Users Summary';
  if (module === 'transferStats') return 'Transfer Summary';
  if (module === 'maintenanceStats') return 'Maintenance Summary';
  if (module === 'disposalStats') return 'Disposal Summary';
  if (module === 'assetsNeedingAttention') return 'Assets Needing Attention';
  return 'Summary';
}

function getDashboardSubtitle(user) {
  if (isAdministrator(user)) return 'Administrative summary';
  if (isPropertyManager(user)) return 'Operational summary';
  if (isCustodian(user)) return 'Assigned assets overview';
  return 'Overview';
}

function canViewDashboardModule(user, module) {
  const modules = {
    personalBorrowStats: canViewPersonalBorrowStats(user),
    inventoryStats: canViewInventoryDashboard(user),
    usersStats: canViewUsersDashboard(user),
    pendingApprovals: canViewPendingApprovalsDashboard(user),
    transferStats: canViewTransferDashboard(user),
    maintenanceStats: canViewMaintenanceDashboard(user),
    disposalStats: canViewDisposalDashboard(user),
    charts: canViewDashboardCharts(user),
    recentInventory: canViewInventoryDashboard(user),
    lowStock: canViewLowStockDashboard(user),
    assetsNeedingAttention: canViewAssetsNeedingAttention(user),
    recentBorrows: canViewRecentBorrowsDashboard(user),
    recentReturns: canViewRecentReturnsDashboard(user),
    activities: canViewDashboardActivities(user)
  };
  return modules[module] !== false;
}

/** Validate Cavite Institute school email */
function isSchoolEmail(email) {
  const normalized = (email || '').trim().toLowerCase();
  return normalized.endsWith('@caviteinstitute.edu.ph') && normalized.length > '@caviteinstitute.edu.ph'.length;
}

/** Toggle password visibility for a single control */
function togglePasswordVisibility(button) {
  const input = document.getElementById(button.dataset.target);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  const icon = button.querySelector('i');
  if (icon) icon.className = isHidden ? 'bi bi-eye-slash' : 'bi bi-eye';
  button.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
  button.setAttribute('aria-pressed', isHidden ? 'true' : 'false');
}

/** Bind show/hide password behavior to a toggle button */
function initPasswordToggle(button) {
  if (button.dataset.toggleBound === 'true') return;
  button.dataset.toggleBound = 'true';
  button.setAttribute('type', 'button');

  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePasswordVisibility(button);
  });
  button.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      togglePasswordVisibility(button);
    }
  });
}

/** Initialize all password visibility toggles on the page */
function initAllPasswordToggles(root = document) {
  root.querySelectorAll('.password-toggle-btn').forEach(initPasswordToggle);
}

document.addEventListener('DOMContentLoaded', () => initAllPasswordToggles());
if (document.readyState !== 'loading') initAllPasswordToggles();

/** Get status badge HTML */
function getStatusBadge(status) {
  const map = {
    'Available': 'badge-available',
    'Borrowed': 'badge-borrowed',
    'Low Stock': 'badge-low-stock',
    'Out of Stock': 'badge-out-of-stock',
    'Under Maintenance': 'badge-pending',
    'Pending': 'badge-pending',
    'Inspected': 'badge-borrowed',
    'Scheduled': 'badge-pending',
    'Ongoing': 'badge-borrowed',
    'Completed': 'badge-approved',
    'Cancelled': 'badge-rejected',
    'Approved': 'badge-approved',
    'Rejected': 'badge-rejected',
    'Returned': 'badge-returned',
    'Overdue': 'badge-low-stock'
  };
  const cls = map[status] || 'badge-available';
  return `<span class="badge ${cls}">${status}</span>`;
}

/** Get user initials */
function getInitials(name) {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

/** Debounce function */
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Confirm dialog */
function confirmAction(message) {
  return window.confirm(message);
}

/** Open modal */
function openModal(modalId) {
  document.getElementById(modalId)?.classList.add('show');
}

/** Close modal */
function closeModal(modalId) {
  document.getElementById(modalId)?.classList.remove('show');
}

const ACTION_ICON_TOOLTIPS = {
  'bi-eye': 'View',
  'bi-pencil': 'Edit',
  'bi-archive': 'Archive',
  'bi-x-lg': 'Close',
  'bi-trash': 'Remove',
  'bi-trash3': 'Dispose',
  'bi-arrow-left-right': 'Transfer',
  'bi-tools': 'Maintenance',
  'bi-cpu': 'Replace Component',
  'bi-file-earmark-text': 'View Document',
  'bi-file-earmark-check': 'View PAR',
  'bi-file-pdf': 'Download PDF',
  'bi-printer': 'Print',
  'bi-arrow-counterclockwise': 'Restore',
  'bi-three-dots': 'More Actions',
  'bi-three-dots-vertical': 'More Actions'
};

let actionIconTooltipObserver = null;

/** Apply native tooltips to icon-only action buttons */
function applyActionIconTooltips(root) {
  const scope = root || document.getElementById('app') || document;
  scope.querySelectorAll('.btn-icon').forEach(btn => {
    const icon = btn.querySelector('i');
    if (!icon) return;

    if (!btn.getAttribute('title')) {
      for (const cls of icon.classList) {
        if (ACTION_ICON_TOOLTIPS[cls]) {
          btn.setAttribute('title', ACTION_ICON_TOOLTIPS[cls]);
          break;
        }
      }
    }

    const title = btn.getAttribute('title');
    if (title && !btn.getAttribute('aria-label')) {
      btn.setAttribute('aria-label', title);
    }
  });
}

function initActionIconTooltips() {
  applyActionIconTooltips();
  if (actionIconTooltipObserver) return;

  const app = document.getElementById('app');
  if (!app) return;

  actionIconTooltipObserver = new MutationObserver(() => applyActionIconTooltips(app));
  actionIconTooltipObserver.observe(app, { childList: true, subtree: true });
}

/** Populate select dropdown */
function populateSelect(selectEl, items, valueKey = 'id', labelKey = 'name', placeholder = 'Select...') {
  if (!selectEl) return;
  selectEl.innerHTML = `<option value="">${placeholder}</option>`;
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item[valueKey];
    opt.textContent = item[labelKey];
    selectEl.appendChild(opt);
  });
}

/** Handle logout */
async function handleLogout() {
  try {
    await API.logout();
  } catch { /* proceed anyway */ }
  clearAuthCache();
  window.location.href = '/index.html';
}
