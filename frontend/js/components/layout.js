/**
 * Shared layout component - sidebar, topbar, and navigation
 */

const NAV_ROLES = {
  ADMINISTRATOR: 'administrator',
  PROPERTY_MANAGER: 'property_manager',
  CUSTODIAN: 'custodian'
};

const NAV_ITEMS = [
  { href: '/pages/dashboard.html', icon: 'bi-grid-1x2-fill', label: 'Dashboard', page: 'dashboard', roles: ['administrator', 'property_manager', 'custodian'] },
  { href: '/pages/pending-approvals.html', icon: 'bi-clipboard-check', label: 'Pending Approvals', page: 'pending-approvals', roles: ['property_manager'] },
  { href: '/pages/inventory.html', icon: 'bi-box-seam', label: 'Inventory', page: 'inventory', roles: ['administrator', 'property_manager', 'custodian'] },
  { href: '/pages/orders.html', icon: 'bi-box-arrow-in-right', label: 'Borrow', page: 'orders', roles: ['administrator', 'property_manager', 'custodian'] },
  { href: '/pages/transfer-requests.html', icon: 'bi-arrow-left-right', label: 'Transfers', page: 'transfer-requests', roles: ['property_manager', 'custodian'] },
  { href: '/pages/maintenance-requests.html', icon: 'bi-tools', label: 'Maintenance', page: 'maintenance-requests', roles: ['administrator', 'property_manager', 'custodian'] },
  { href: '/pages/disposal-requests.html', icon: 'bi-trash3', label: 'Disposals', page: 'disposal-requests', roles: ['administrator', 'property_manager', 'custodian'] },
  { href: '/pages/suppliers.html', icon: 'bi-truck', label: 'Suppliers', page: 'suppliers', roles: ['property_manager'] },
  {
    type: 'group',
    icon: 'bi-buildings',
    label: 'Manage',
    page: 'manage',
    roles: ['administrator'],
    children: [
      { href: '/pages/manage-departments.html', icon: 'bi-building', label: 'Departments', page: 'manage-departments', roles: ['administrator'] },
      { href: '/pages/manage-locations.html', icon: 'bi-geo-alt', label: 'Locations', page: 'manage-locations', roles: ['administrator'] },
      { href: '/pages/manage-users.html', icon: 'bi-people', label: 'Users', page: 'manage-users', roles: ['administrator'] },
      { href: '/pages/suppliers.html', icon: 'bi-truck', label: 'Suppliers', page: 'suppliers', roles: ['administrator'] }
    ]
  },
  { href: '/pages/reports.html', icon: 'bi-bar-chart-line', label: 'Reports', page: 'reports', roles: ['administrator', 'property_manager', 'custodian'] },
  { href: '/pages/archive.html', icon: 'bi-archive', label: 'Archive', page: 'archive', roles: ['administrator', 'property_manager'] }
];

const FOOTER_NAV = [
  { href: '/pages/settings.html', icon: 'bi-gear', label: 'Settings', page: 'settings', roles: ['administrator', 'property_manager', 'custodian'] },
  { action: 'logout', icon: 'bi-box-arrow-right', label: 'Log Out', roles: ['administrator', 'property_manager', 'custodian'] }
];

const PAGE_PERMISSIONS = {
  dashboard: ['administrator', 'property_manager', 'custodian'],
  'pending-approvals': ['property_manager'],
  inventory: ['administrator', 'property_manager', 'custodian'],
  reports: ['administrator', 'property_manager', 'custodian'],
  suppliers: ['administrator', 'property_manager'],
  orders: ['administrator', 'property_manager', 'custodian'],
  'maintenance-requests': ['administrator', 'property_manager', 'custodian'],
  'transfer-requests': ['property_manager', 'custodian'],
  'disposal-requests': ['administrator', 'property_manager', 'custodian'],
  'manage-departments': ['administrator'],
  'manage-locations': ['administrator'],
  'manage-users': ['administrator'],
  'manage-store': ['administrator'],
  archive: ['administrator', 'property_manager'],
  settings: ['administrator', 'property_manager', 'custodian'],
  documents: ['administrator', 'property_manager'],
  'document-preview': ['administrator', 'property_manager', 'custodian']
};

const MANAGE_PAGES = ['manage-departments', 'manage-locations', 'manage-users', 'suppliers', 'manage-store'];

const SIDEBAR_COLLAPSED_KEY = 'sidebarCollapsed';
const SIDEBAR_AUTO_COLLAPSE_KEY = 'sidebarAutoCollapse';

let layoutClickHandler = null;
let searchHandler = null;
let sidebarToggleHandler = null;
let mobileMenuHandler = null;
let overlayClickHandler = null;
let resizeHandler = null;
let navLinkClickHandler = handleNavLinkClick;

function getUserRole(user) {
  return normalizeNavRole(user);
}

function filterNavByRole(items, role) {
  return items
    .filter(item => item.roles.includes(role))
    .map(item => {
      if (item.type !== 'group' || !item.children) return item;
      const children = item.children.filter(child => (child.roles || item.roles).includes(role));
      if (!children.length) return null;
      return { ...item, children };
    })
    .filter(Boolean);
}

function userHasPageAccess(page, user) {
  const role = getUserRole(user);
  const allowed = PAGE_PERMISSIONS[page] || ['administrator'];
  return allowed.includes(role);
}

/** Route guard — mirrors PAGE_PERMISSIONS / NAV_ITEMS role requirements */
function canAccessPage(pageName, user) {
  return userHasPageAccess(pageName, user);
}

function isSidebarCollapsed() {
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
}

function setSidebarCollapsedState(collapsed, { persist = true } = {}) {
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('mainContent');
  if (sidebar) sidebar.classList.toggle('collapsed', collapsed);
  if (mainContent) mainContent.classList.toggle('sidebar-collapsed', collapsed);
  if (persist) localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? 'true' : 'false');
  if (!isMobileView()) updateToggleIcon(collapsed);
}

function scheduleSidebarAutoCollapse() {
  sessionStorage.setItem(SIDEBAR_AUTO_COLLAPSE_KEY, '1');
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'true');
}

function applyAutoCollapseOnLoad() {
  if (sessionStorage.getItem(SIDEBAR_AUTO_COLLAPSE_KEY) !== '1') return;
  sessionStorage.removeItem(SIDEBAR_AUTO_COLLAPSE_KEY);
  if (isMobileView()) return;
  setSidebarCollapsedState(true);
}

function handleNavLinkClick(e) {
  if (isMobileView()) {
    closeMobileSidebar();
    return;
  }
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

  const sidebar = document.getElementById('sidebar');
  if (!sidebar || sidebar.classList.contains('collapsed')) return;

  const href = e.currentTarget.getAttribute('href');
  if (!href || href === '#') return;

  scheduleSidebarAutoCollapse();
}

function isMobileView() {
  return window.innerWidth <= 768;
}

function isManageGroupExpanded() {
  if (localStorage.getItem('manageNavExpanded') === 'false') return false;
  return localStorage.getItem('manageNavExpanded') !== 'false';
}

function setManageGroupExpanded(expanded) {
  localStorage.setItem('manageNavExpanded', expanded ? 'true' : 'false');
}

function isManagePage(page) {
  return MANAGE_PAGES.includes(page);
}

function renderNavItem(item, activePage, isLogout = false) {
  const isActive = !isLogout && activePage === item.page;
  const tooltip = `data-tooltip="${item.label}"`;

  if (isLogout) {
    return `
      <a href="#" class="nav-item" id="logoutBtn" ${tooltip}>
        <i class="bi ${item.icon}"></i>
        <span class="nav-label">${item.label}</span>
      </a>
    `;
  }

  return `
    <a href="${item.href}" class="nav-item ${isActive ? 'active' : ''}" ${tooltip}>
      <i class="bi ${item.icon}"></i>
      <span class="nav-label">${item.label}</span>
    </a>
  `;
}

function renderNavGroup(group, activePage) {
  const childActive = group.children.some(child => child.page === activePage);
  const expanded = childActive || (isManageGroupExpanded() && !isSidebarCollapsed());
  const groupActive = childActive ? ' active' : '';

  return `
    <div class="nav-group${expanded ? ' expanded' : ''}" data-nav-group="${group.page}">
      <button type="button" class="nav-item nav-group-toggle${groupActive}" data-tooltip="${group.label}" aria-expanded="${expanded}">
        <i class="bi ${group.icon}"></i>
        <span class="nav-label">${group.label}</span>
        <i class="bi bi-chevron-right nav-chevron"></i>
      </button>
      <div class="nav-submenu">
        ${group.children.map(child => {
          const isActive = activePage === child.page;
          return `
            <a href="${child.href}" class="nav-item nav-subitem ${isActive ? 'active' : ''}" data-tooltip="${child.label}">
              <i class="bi ${child.icon}"></i>
              <span class="nav-label">${child.label}</span>
            </a>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderNavEntry(item, activePage) {
  if (item.type === 'group') return renderNavGroup(item, activePage);
  return renderNavItem(item, activePage);
}

function renderLayout(activePage, user) {
  const initials = getInitials(user.full_name);
  const roleLabel = formatRoleDisplayName(user);
  const role = getUserRole(user);
  const collapsed = isSidebarCollapsed();
  const navItems = filterNavByRole(NAV_ITEMS, role);
  const footerItems = filterNavByRole(FOOTER_NAV, role);

  if (isManagePage(activePage)) {
    setManageGroupExpanded(true);
  }

  return `
    <div class="sidebar-overlay" id="sidebarOverlay"></div>
    <aside class="sidebar${collapsed ? ' collapsed' : ''}" id="sidebar" aria-label="Main navigation">
      <div class="sidebar-header">
        <img src="/images/cavite-institute-logo.png" alt="Cavite Institute" class="sidebar-logo" title="Cavite Institute Property Management System">
        <div class="sidebar-brand">
          <h2 class="system-brand-name">
            <span>CAVITE INSTITUTE</span>
            <span>PROPERTY MANAGEMENT</span>
            <span>SYSTEM</span>
          </h2>
        </div>
      </div>
      <nav class="sidebar-nav">
        ${navItems.map(item => renderNavEntry(item, activePage)).join('')}
      </nav>
      <div class="sidebar-footer">
        ${footerItems.map(item => item.action === 'logout'
    ? renderNavItem(item, activePage, true)
    : renderNavItem(item, activePage)).join('')}
      </div>
    </aside>

    <div class="main-content${collapsed ? ' sidebar-collapsed' : ''}" id="mainContent">
      <header class="topbar">
        <button class="topbar-sidebar-toggle" id="topbarSidebarToggle" type="button" title="Toggle sidebar" aria-label="Toggle sidebar">
          <i class="bi bi-list"></i>
        </button>
        <button class="mobile-menu-btn" id="mobileMenuBtn" type="button" aria-label="Open menu">
          <i class="bi bi-list"></i>
        </button>
        <div class="topbar-search">
          <i class="bi bi-search"></i>
          <input type="text" id="globalSearch" placeholder="Search property tag, batch, item, department, location..." autocomplete="off">
          <div class="search-results-dropdown" id="searchResults"></div>
        </div>
        <div class="topbar-actions">
          <div class="notification-dropdown">
            <button class="topbar-btn" type="button" id="notificationBtn" title="Notifications" aria-label="Notifications">
              <i class="bi bi-bell"></i>
              <span class="notification-dot" id="notificationDot" style="display:none;"></span>
              <span class="notification-badge" id="notificationBadge" style="display:none;">0</span>
            </button>
            <div class="notification-panel" id="notificationPanel">
              <div class="notification-panel-header">
                <h4>Notifications</h4>
                <button type="button" class="notification-mark-all" id="markAllReadBtn" title="Mark all as read">Mark all read</button>
              </div>
              <div class="notification-list" id="notificationList">
                <div class="notification-loading"><span class="spinner-border spinner-border-sm"></span> Loading...</div>
              </div>
            </div>
          </div>
          <div class="profile-dropdown">
            <button class="profile-btn" id="profileDropdownBtn" type="button" title="Profile" aria-label="Profile">
              <div class="profile-avatar" id="profileAvatar">${initials}</div>
            </button>
            <div class="dropdown-menu-custom" id="profileDropdown">
              <div class="dropdown-header">
                <strong>${user.full_name}</strong>
                <small>${roleLabel}</small>
              </div>
            </div>
          </div>
        </div>
      </header>
      <div class="page-content" id="pageContent"></div>
    </div>
  `;
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('mainContent');
  if (!sidebar || !mainContent) return;

  if (isMobileView()) {
    const overlay = document.getElementById('sidebarOverlay');
    const isOpen = sidebar.classList.contains('mobile-open');
    sidebar.classList.toggle('mobile-open', !isOpen);
    overlay?.classList.toggle('show', !isOpen);
    return;
  }

  const willCollapse = !sidebar.classList.contains('collapsed');
  setSidebarCollapsedState(willCollapse);
  window.dispatchEvent(new Event('resize'));
}

function closeMobileSidebar() {
  document.getElementById('sidebar')?.classList.remove('mobile-open');
  document.getElementById('sidebarOverlay')?.classList.remove('show');
}

function updateToggleIcon(collapsed) {
  const btn = document.getElementById('topbarSidebarToggle');
  if (!btn) return;
  const icon = btn.querySelector('i');
  if (icon) {
    icon.className = collapsed ? 'bi bi-layout-sidebar' : 'bi bi-list';
  }
  btn.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
}

function initNavGroups() {
  document.querySelectorAll('.nav-group-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const group = toggle.closest('.nav-group');
      if (!group) return;

      if (isSidebarCollapsed() && !isMobileView()) {
        toggleSidebar();
        group.classList.add('expanded');
        setManageGroupExpanded(true);
        return;
      }

      const expanded = group.classList.toggle('expanded');
      toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      setManageGroupExpanded(expanded);
    });
  });
}

async function initLayout(activePage) {
  const user = await requireAuth();
  if (!user) return null;

  if (!canAccessPage(activePage, user)) {
    denyPageAccess();
    return null;
  }

  initPwa();
  showPendingAccessDeniedToast();

  const appEl = document.getElementById('app');
  appEl.innerHTML = renderLayout(activePage, user);
  initLayoutEvents();
  initNavGroups();
  applyAutoCollapseOnLoad();
  updateToggleIcon(isSidebarCollapsed() && !isMobileView());
  initActionIconTooltips();
  return user;
}

function initLayoutEvents() {
  const sidebar = document.getElementById('sidebar');
  const topbarToggle = document.getElementById('topbarSidebarToggle');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  if (sidebarToggleHandler) {
    topbarToggle?.removeEventListener('click', sidebarToggleHandler);
  }
  sidebarToggleHandler = (e) => {
    e.stopPropagation();
    toggleSidebar();
  };
  topbarToggle?.addEventListener('click', sidebarToggleHandler);

  if (mobileMenuHandler) {
    mobileMenuBtn?.removeEventListener('click', mobileMenuHandler);
  }
  mobileMenuHandler = (e) => {
    e.stopPropagation();
    sidebar?.classList.add('mobile-open');
    sidebarOverlay?.classList.add('show');
  };
  mobileMenuBtn?.addEventListener('click', mobileMenuHandler);

  if (overlayClickHandler) {
    sidebarOverlay?.removeEventListener('click', overlayClickHandler);
  }
  overlayClickHandler = closeMobileSidebar;
  sidebarOverlay?.addEventListener('click', overlayClickHandler);

  sidebar?.querySelectorAll('.sidebar-nav a.nav-item, .sidebar-footer a.nav-item[href]').forEach(link => {
    link.removeEventListener('click', navLinkClickHandler);
    link.addEventListener('click', navLinkClickHandler);
  });

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
  }
  resizeHandler = debounce(() => {
    if (!isMobileView()) {
      closeMobileSidebar();
    }
  }, 150);
  window.addEventListener('resize', resizeHandler);

  const profileDropdown = document.getElementById('profileDropdown');
  document.getElementById('profileDropdownBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    profileDropdown.classList.toggle('show');
  });

  if (layoutClickHandler) {
    document.removeEventListener('click', layoutClickHandler);
  }
  layoutClickHandler = (e) => {
    profileDropdown?.classList.remove('show');
    document.getElementById('searchResults')?.classList.remove('show');
    if (!e.target.closest('.notification-dropdown')) {
      closeNotificationPanel();
    }
  };
  document.addEventListener('click', layoutClickHandler);

  document.getElementById('logoutBtn')?.addEventListener('click', (e) => { e.preventDefault(); handleLogout(); });

  if (typeof initNotifications === 'function') initNotifications();

  const searchInput = document.getElementById('globalSearch');
  const searchResults = document.getElementById('searchResults');

  if (searchInput) {
    if (searchHandler) {
      searchInput.removeEventListener('input', searchHandler);
    }
    searchHandler = debounce(async (e) => {
      const q = e.target.value.trim();
      if (q.length < 2) {
        searchResults.classList.remove('show');
        searchResults.innerHTML = '';
        return;
      }
      try {
        const res = await API.search(q);
        if (!res?.data) return;
        let html = '';
        res.data.inventory.forEach(item => {
          const meta = [
            item.property_tag,
            item.batch_id,
            item.item_code,
            item.department_name,
            item.location_name
          ].filter(Boolean).join(' · ');
          html += `<div class="search-result-item" data-href="/pages/inventory.html"><strong>${item.item_name}</strong><small>${meta || 'Inventory item'}</small></div>`;
        });
        res.data.suppliers.forEach(s => {
          html += `<div class="search-result-item" data-href="/pages/suppliers.html"><strong>${s.name}</strong><small>Supplier</small></div>`;
        });
        res.data.orders.forEach(o => {
          html += `<div class="search-result-item" data-href="/pages/orders.html"><strong>${o.transaction_code}</strong><small>${o.status}</small></div>`;
        });
        if (!html) html = '<div class="search-result-item">No results found</div>';
        searchResults.innerHTML = html;
        searchResults.querySelectorAll('[data-href]').forEach(el => {
          el.addEventListener('click', () => { window.location.href = el.dataset.href; });
        });
        searchResults.classList.add('show');
      } catch (err) {
        searchResults.classList.remove('show');
        searchResults.innerHTML = '';
        showToast(err?.message || 'Unable to perform search. Please try again.', 'error');
      }
    }, 400);
    searchInput.addEventListener('input', searchHandler);
    searchInput.addEventListener('click', (e) => e.stopPropagation());
  }
}

function initPwa() {
  if (window.__ciPwaInit) return;
  window.__ciPwaInit = true;

  if (!document.querySelector('link[rel="manifest"]')) {
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = '/manifest.webmanifest';
    document.head.appendChild(manifest);
  }

  if (!document.querySelector('meta[name="theme-color"]')) {
    const theme = document.createElement('meta');
    theme.name = 'theme-color';
    theme.content = '#800000';
    document.head.appendChild(theme);
  }

  if (!document.querySelector('meta[name="mobile-web-app-capable"]')) {
    const mobile = document.createElement('meta');
    mobile.name = 'mobile-web-app-capable';
    mobile.content = 'yes';
    document.head.appendChild(mobile);
  }

  if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
    const apple = document.createElement('meta');
    apple.name = 'apple-mobile-web-app-capable';
    apple.content = 'yes';
    document.head.appendChild(apple);
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}
