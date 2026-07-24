let categories = [], suppliers = [], locations = [], items = [], users = [];
let currentUser = null;
let inventoryActionsListenersBound = false;
let inventoryTableSelection = null;
let inventoryPage = 1;
const INVENTORY_PAGE_SIZE = 50;
let inventoryPagination = { total: 0, page: 1, limit: INVENTORY_PAGE_SIZE, totalPages: 1 };

function closeAllInventoryActionsMenus() {
  document.querySelectorAll('.inventory-actions-menu.show').forEach(menu => {
    menu.classList.remove('show', 'is-fixed');
    menu.style.top = '';
    menu.style.left = '';
  });
  document.querySelectorAll('.inventory-actions-submenu.show').forEach(sub => {
    sub.classList.remove('show', 'flip-left', 'is-fixed');
    sub.style.top = '';
    sub.style.left = '';
    sub.style.right = '';
  });
  document.querySelectorAll('.inventory-actions-submenu-wrap.is-flipped').forEach(wrap => {
    wrap.classList.remove('is-flipped');
  });
  document.querySelectorAll('.inventory-actions-overflow[aria-expanded="true"]').forEach(btn => {
    btn.setAttribute('aria-expanded', 'false');
  });
}

function showBorrowInInventoryMenu(classification) {
  return canBorrowAsset(classification);
}

function getInventoryDocumentOptions(item, classification) {
  const options = [];
  if (
    isFixedAssetClassification(classification)
    || normalizeAssetClassification(classification) === 'Semi-Durable'
  ) {
    options.push({ type: 'PAR', module: 'inventory', label: 'View PAR', icon: 'bi-file-earmark-check' });
  }
  if (item.status === 'Disposed') {
    options.push({ type: 'RDF', module: 'disposal', label: 'View RDF', icon: 'bi-file-earmark-x', inventoryItemId: item.id });
  }
  return options;
}

async function openInventoryDocument(itemId, docType, module, inventoryItemId) {
  closeAllInventoryActionsMenus();
  if (docType === 'RDF' && module === 'disposal') {
    try {
      const res = await API.getDisposals();
      const disposal = (res?.data || []).find(d =>
        d.inventory_item_id === inventoryItemId &&
        ['Completed', 'Approved'].includes(d.status)
      );
      if (!disposal) {
        showToast('RDF document not found', 'error');
        return;
      }
      await openDocumentForTransaction('RDF', 'disposal', disposal.id);
    } catch (err) {
      showToast(err.message || 'Document not found', 'error');
    }
    return;
  }

  try {
    const res = await API.lookupDocument(docType, module, itemId);
    if (res?.data?.id) {
      API.openDocumentPreview(res.data.id);
      return;
    }
  } catch {
    // Fall through to inventory document history lookup
  }

  try {
    const listRes = await API.getDocumentsByInventory(itemId);
    const docs = listRes?.data || [];
    const exact = docs.find((d) =>
      d.document_type === docType
      && Number(d.related_transaction_id) === Number(itemId)
    );
    const doc = exact || docs.find((d) => d.document_type === docType);
    if (doc?.id) {
      API.openDocumentPreview(doc.id);
      return;
    }
  } catch {
    // ignore and show not found
  }

  showToast(`${docType} document not found`, 'error');
}

function openBorrowForItem(itemId) {
  closeAllInventoryActionsMenus();
  sessionStorage.setItem('inventoryBorrowItemId', String(itemId));
  window.location.href = '/pages/orders.html';
}

function positionInventoryActionsMenu(wrap) {
  const menu = wrap.querySelector('.inventory-actions-menu');
  const trigger = wrap.querySelector('.inventory-actions-overflow');
  if (!menu || !trigger) return;

  menu.classList.add('is-fixed');
  const triggerRect = trigger.getBoundingClientRect();
  const menuWidth = menu.offsetWidth || 230;
  const menuHeight = menu.offsetHeight || 200;
  const margin = 8;

  let left = triggerRect.right - menuWidth;
  left = Math.max(margin, Math.min(left, window.innerWidth - menuWidth - margin));

  let top = triggerRect.bottom + 4;
  if (top + menuHeight > window.innerHeight - margin && triggerRect.top > menuHeight + margin) {
    top = triggerRect.top - menuHeight - 4;
  }

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;

  const submenu = wrap.querySelector('.inventory-actions-submenu.show');
  if (submenu) positionInventoryDocumentsSubmenu(wrap);
}

function positionInventoryDocumentsSubmenu(wrap) {
  const submenuWrap = wrap.querySelector('.inventory-actions-submenu-wrap');
  const submenu = wrap?.querySelector('.inventory-actions-submenu');
  const trigger = submenuWrap?.querySelector('.inventory-actions-submenu-trigger');
  if (!submenu || !trigger) return;

  submenu.classList.add('show', 'is-fixed');
  submenu.style.visibility = 'hidden';
  submenu.style.left = '0px';
  submenu.style.top = '0px';
  submenu.style.right = 'auto';

  const triggerRect = trigger.getBoundingClientRect();
  const submenuWidth = Math.max(submenu.offsetWidth || 0, 150);
  const submenuHeight = Math.max(submenu.offsetHeight || 0, 40);
  const margin = 8;
  const gap = 4;

  const spaceRight = window.innerWidth - triggerRect.right - margin;
  const spaceLeft = triggerRect.left - margin;
  const needsFlip = spaceRight < submenuWidth + gap;
  const flipLeft = needsFlip && spaceLeft >= Math.min(submenuWidth + gap, spaceRight);

  let left = flipLeft
    ? triggerRect.left - submenuWidth - gap
    : triggerRect.right + gap;
  left = Math.max(margin, Math.min(left, window.innerWidth - submenuWidth - margin));

  let top = triggerRect.top;
  if (top + submenuHeight > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - submenuHeight - margin);
  }

  submenu.classList.toggle('flip-left', flipLeft);
  submenuWrap?.classList.toggle('is-flipped', flipLeft);
  submenu.style.left = `${left}px`;
  submenu.style.top = `${top}px`;
  submenu.style.visibility = '';
}

function closeInventoryDocumentsSubmenu(wrap) {
  const submenu = wrap?.querySelector('.inventory-actions-submenu');
  const submenuWrap = wrap?.querySelector('.inventory-actions-submenu-wrap');
  if (!submenu) return;
  submenu.classList.remove('show', 'flip-left', 'is-fixed');
  submenu.style.top = '';
  submenu.style.left = '';
  submenu.style.right = '';
  submenu.style.visibility = '';
  submenuWrap?.classList.remove('is-flipped');
}

function openInventoryDocumentsSubmenu(wrap) {
  const menu = wrap?.querySelector('.inventory-actions-menu.show');
  const submenu = wrap?.querySelector('.inventory-actions-submenu');
  if (!menu || !submenu) return;
  positionInventoryDocumentsSubmenu(wrap);
}

function toggleInventoryDocumentsSubmenu(itemId, event) {
  event.preventDefault();
  event.stopPropagation();

  const wrap = document.getElementById(`inventory-actions-${itemId}`);
  const submenu = wrap?.querySelector('.inventory-actions-submenu');
  if (!submenu) return;

  if (submenu.classList.contains('show')) {
    closeInventoryDocumentsSubmenu(wrap);
    return;
  }

  requestAnimationFrame(() => openInventoryDocumentsSubmenu(wrap));
}

function toggleInventoryActionsMenu(itemId, event) {
  event.preventDefault();
  event.stopPropagation();

  const wrap = document.getElementById(`inventory-actions-${itemId}`);
  const menu = wrap?.querySelector('.inventory-actions-menu');
  const trigger = wrap?.querySelector('.inventory-actions-overflow');
  if (!menu || !trigger) return;

  const wasOpen = menu.classList.contains('show');
  closeAllInventoryActionsMenus();
  if (wasOpen) {
    trigger.setAttribute('aria-expanded', 'false');
    return;
  }

  requestAnimationFrame(() => {
    menu.classList.add('show');
    trigger.setAttribute('aria-expanded', 'true');
    positionInventoryActionsMenu(wrap);
  });
}

function runInventoryAction(event, callback) {
  event.preventDefault();
  event.stopPropagation();
  document.querySelectorAll('.inventory-actions-overflow[aria-expanded="true"]').forEach(btn => {
    btn.setAttribute('aria-expanded', 'false');
  });
  closeAllInventoryActionsMenus();
  callback();
}

function bindInventoryActionsListeners() {
  if (inventoryActionsListenersBound) return;
  inventoryActionsListenersBound = true;

  let documentsSubmenuCloseTimer = null;

  document.addEventListener('click', (event) => {
    if (event.target.closest('.inventory-actions-wrap')) return;
    closeAllInventoryActionsMenus();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllInventoryActionsMenus();
  });
  window.addEventListener('resize', closeAllInventoryActionsMenus);
  document.getElementById('inventoryTable')?.addEventListener('scroll', closeAllInventoryActionsMenus, true);

  document.addEventListener('mouseover', (event) => {
    const submenuWrap = event.target.closest?.('.inventory-actions-submenu-wrap');
    if (!submenuWrap) return;
    const wrap = submenuWrap.closest('.inventory-actions-wrap');
    if (!wrap?.querySelector('.inventory-actions-menu.show')) return;
    clearTimeout(documentsSubmenuCloseTimer);
    openInventoryDocumentsSubmenu(wrap);
  });

  document.addEventListener('mouseout', (event) => {
    const submenuWrap = event.target.closest?.('.inventory-actions-submenu-wrap');
    if (!submenuWrap) return;
    const related = event.relatedTarget;
    if (related && submenuWrap.contains(related)) return;
    const wrap = submenuWrap.closest('.inventory-actions-wrap');
    clearTimeout(documentsSubmenuCloseTimer);
    documentsSubmenuCloseTimer = setTimeout(() => {
      if (!wrap?.querySelector('.inventory-actions-menu.show')) return;
      if (submenuWrap.matches(':hover')) return;
      closeInventoryDocumentsSubmenu(wrap);
    }, 120);
  });
}

function renderInventoryActionsCell(item, classification, permissions) {
  const id = item.id;
  const isDisposed = item.status === 'Disposed';
  const canBorrowType = showBorrowInInventoryMenu(classification);
  const itemBorrowable = isItemAvailableForBorrow(item);
  const showBorrow = permissions.canSubmitBorrow && canBorrowType && itemBorrowable;
  const showBorrowUnavailable = permissions.canSubmitBorrow && canBorrowType && !itemBorrowable && !isDisposed;
  const showTransfer = permissions.canSubmitTransfer && item.status === 'Available' && canTransferAsset(classification);
  const showMaintain = permissions.canSubmitMaintenance && item.status === 'Available' && canMaintainAsset(classification);
  const showReplace = permissions.canManageInventory && !isDisposed && canReplaceComponent(classification);
  const showDispose = permissions.canSubmitDisposal && item.status === 'Available';
  const documentOptions = getInventoryDocumentOptions(item, classification);
  const hasOverflowItems = showBorrow || showBorrowUnavailable || showTransfer || showMaintain || showReplace || showDispose ||
    documentOptions.length || permissions.canArchiveInventory;

  const overflowItems = [
    showBorrow ? `<button type="button" role="menuitem" onclick="runInventoryAction(event, () => openBorrowForItem(${id}))"><i class="bi bi-box-arrow-right"></i> Borrow</button>` : '',
    showBorrowUnavailable ? `<button type="button" role="menuitem" disabled><i class="bi bi-box-arrow-right"></i> Borrow (Unavailable)</button>` : '',
    showTransfer ? `<button type="button" role="menuitem" onclick="runInventoryAction(event, () => openTransferModal(${id}))"><i class="bi bi-arrow-left-right"></i> Transfer</button>` : '',
    showMaintain ? `<button type="button" role="menuitem" onclick="runInventoryAction(event, () => openMaintenanceModal(${id}))"><i class="bi bi-tools"></i> Maintenance</button>` : '',
    showReplace ? `<button type="button" role="menuitem" onclick="runInventoryAction(event, () => openComponentModal(${id}))"><i class="bi bi-cpu"></i> Components</button>` : '',
    documentOptions.length ? `
      <div class="inventory-actions-submenu-wrap">
        <button type="button" class="inventory-actions-submenu-trigger" role="menuitem"
          onclick="toggleInventoryDocumentsSubmenu(${id}, event)">
          <span class="inventory-actions-submenu-label"><i class="bi bi-folder2-open"></i> Documents</span>
          <i class="bi bi-chevron-right inventory-actions-submenu-caret"></i>
        </button>
        <div class="inventory-actions-submenu" role="menu" onclick="event.stopPropagation()">
          ${documentOptions.map(doc => `
            <button type="button" role="menuitem"
              onclick="runInventoryAction(event, () => openInventoryDocument(${id}, '${doc.type}', '${doc.module}', ${doc.inventoryItemId || id}))">
              <i class="bi ${doc.icon}"></i> ${doc.label}
            </button>
          `).join('')}
        </div>
      </div>
    ` : '',
    showDispose ? `<button type="button" role="menuitem" class="danger" onclick="runInventoryAction(event, () => openDisposalModal(${id}))"><i class="bi bi-trash3"></i> Dispose</button>` : '',
    permissions.canArchiveInventory ? `<button type="button" role="menuitem" class="danger" onclick="runInventoryAction(event, () => archiveItem(${id}))"><i class="bi bi-archive"></i> Archive</button>` : ''
  ].filter(Boolean);

  const menuHtml = hasOverflowItems ? `
    <div class="inventory-actions-wrap" id="inventory-actions-${id}">
      <button type="button" class="btn-icon inventory-actions-overflow"
        onclick="toggleInventoryActionsMenu(${id}, event)"
        title="More actions" aria-label="More actions" aria-haspopup="true" aria-expanded="false">
        <i class="bi bi-three-dots-vertical"></i>
      </button>
      <div class="inventory-actions-menu" role="menu" onclick="event.stopPropagation()">
        <div class="inventory-actions-menu-header">More Actions</div>
        <div class="inventory-actions-separator"></div>
        ${overflowItems.join('')}
      </div>
    </div>
  ` : '';

  return `
    <div class="inventory-actions-cell">
      <button type="button" class="btn-icon" onclick="viewAssetDetails(${id})" title="View" aria-label="View">
        <i class="bi bi-eye"></i>
      </button>
      ${permissions.canManageInventory ? `
      <button type="button" class="btn-icon" onclick="editItem(${id})" title="Edit" aria-label="Edit">
        <i class="bi bi-pencil"></i>
      </button>
      ` : ''}
      ${menuHtml}
    </div>
  `;
}

function getInventoryPermissions(user) {
  return {
    canManageInventory: canManageInventory(user),
    canImportInventory: canManageInventory(user),
    canSubmitBorrow: canSubmitBorrow(user),
    canSubmitTransfer: canSubmitTransfer(user),
    canSubmitMaintenance: canSubmitMaintenance(user),
    canSubmitDisposal: canSubmitDisposal(user),
    canArchiveInventory: canManageInventory(user)
  };
}

function initInventoryTableSelection(permissions) {
  const bulkActions = [
    {
      id: 'export',
      label: 'Export Selected',
      icon: 'bi-download',
      onClick: bulkExportInventory
    }
  ];

  if (permissions.canArchiveInventory) {
    bulkActions.unshift({
      id: 'archive',
      label: 'Archive Selected',
      icon: 'bi-archive',
      danger: true,
      onClick: bulkArchiveInventory
    });
  }

  inventoryTableSelection = createTableSelection({
    container: 'inventoryTable',
    getRowId: (item) => item.id,
    getVisibleRows: () => items,
    bulkActions
  });
}

async function bulkArchiveInventory(ids) {
  if (!await confirmAction(
    `Archive ${ids.length} selected item(s)? They will remain in the Archive for 30 days before being permanently deleted.`,
    { variant: 'danger', title: 'Archive Items', confirmText: 'Archive' }
  )) return;

  await guardAsyncAction(async () => {
    let success = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await API.archiveInventoryItem(id);
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success) {
      showToast(success === 1 ? '1 item archived.' : `${success} items archived.`);
    }
    if (failed) {
      showToast(failed === 1 ? '1 item could not be archived.' : `${failed} items could not be archived.`, 'error');
    }
    inventoryTableSelection?.clearSelection();
    loadItems();
  }, { loadingText: 'Archiving...', lockKey: 'bulk-archive-inventory' });
}

function bulkExportInventory(_ids, rows) {
  exportRowsToCsv(
    `inventory-selected-${new Date().toISOString().slice(0, 10)}.csv`,
    rows,
    [
      { key: 'item_code', label: 'Item Code' },
      { key: 'property_tag', label: 'Property Tag' },
      { key: 'item_name', label: 'Item Name' },
      { label: 'Department', getValue: (row) => row.department_name || row.category_name || '' },
      { key: 'location_name', label: 'Location' },
      { key: 'condition', label: 'Condition' },
      { key: 'status', label: 'Status' },
      { label: 'Acquisition Date', getValue: (row) => formatDetailDate(row.acquisition_date) }
    ]
  );
  showToast(`Exported ${rows.length} item(s)`);
}

async function initInventoryPage() {
  currentUser = await initLayout('inventory');
  if (!currentUser) return;

  const permissions = getInventoryPermissions(currentUser);
  const actionButtons = [];
  if (permissions.canImportInventory) {
    actionButtons.push(`
      <div class="toolbar-dropdown" id="downloadToolbarDropdown">
        <button type="button" class="btn-outline-custom" id="downloadToolbarBtn" aria-haspopup="true" aria-expanded="false">
          <i class="bi bi-download"></i> Download <i class="bi bi-chevron-down" style="font-size:11px;margin-left:2px;"></i>
        </button>
        <div class="dropdown-menu-custom" id="downloadToolbarMenu" role="menu">
          <button type="button" class="toolbar-dropdown-item" id="downloadImportTemplateBtn" role="menuitem">
            <strong>Inventory Template</strong>
            <span>For importing inventory items only.</span>
          </button>
          <button type="button" class="toolbar-dropdown-item" id="downloadAssetWithComponentsTemplateBtn" role="menuitem">
            <strong>Asset with Components Template</strong>
            <span>For importing inventory items together with their replaceable components.</span>
          </button>
          <button type="button" class="toolbar-dropdown-item" id="downloadComponentImportTemplateBtn" role="menuitem">
            <strong>Components Template (Existing Assets)</strong>
            <span>For adding components to assets that already have Property Tags.</span>
          </button>
        </div>
      </div>
    `);
    actionButtons.push(`
      <div class="toolbar-dropdown" id="importToolbarDropdown">
        <button type="button" class="btn-secondary-custom" id="importToolbarBtn" aria-haspopup="true" aria-expanded="false">
          <i class="bi bi-file-earmark-excel"></i> Import <i class="bi bi-chevron-down" style="font-size:11px;margin-left:2px;"></i>
        </button>
        <div class="dropdown-menu-custom" id="importToolbarMenu" role="menu">
          <button type="button" class="toolbar-dropdown-item" id="importInventoryBtn" role="menuitem">
            <strong>Inventory Import</strong>
            <span>Import inventory items only.</span>
          </button>
          <button type="button" class="toolbar-dropdown-item" id="importAssetWithComponentsBtn" role="menuitem">
            <strong>Asset with Components Import</strong>
            <span>Create inventory items and their components in one upload.</span>
          </button>
          <button type="button" class="toolbar-dropdown-item" id="importComponentsBtn" role="menuitem">
            <strong>Components Import (Existing Assets)</strong>
            <span>Add components to existing assets by Property Tag.</span>
          </button>
        </div>
      </div>
    `);
  }
  if (permissions.canManageInventory) {
    actionButtons.push(`<button type="button" class="btn-primary-custom" id="addItemBtn"><i class="bi bi-plus-lg"></i> Add Item</button>`);
  }

  document.getElementById('pageContent').innerHTML = `
    <div class="page-header">
      <h1>Inventory Management</h1>
      <p>Manage school inventory items, stock levels, and item details</p>
    </div>
    <div class="content-card">
      <div class="content-card-header">
        <h3>All Items</h3>
        ${actionButtons.length ? `<div class="content-card-actions" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">${actionButtons.join('')}</div>` : ''}
      </div>
      <div class="filters-bar">
        <input type="text" class="form-control-custom" id="searchInput" placeholder="Search items...">
        <select class="form-control-custom" id="filterCategory"><option value="">All Departments</option></select>
        <select class="form-control-custom" id="filterLocation"><option value="">All Locations</option></select>
        <select class="form-control-custom" id="filterClassification">
          <option value="">All Classifications</option>
        </select>
        <select class="form-control-custom" id="filterStatus">
          <option value="">All Status</option>
          <option>Available</option><option>Borrowed</option>
          <option>Under Maintenance</option><option>Disposed</option>
        </select>
        <button type="button" class="btn-outline-custom btn-sm-custom" id="clearInventoryFiltersBtn">Clear Filters</button>
      </div>
      <div class="table-responsive" id="inventoryTable">
        <div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div>
      </div>
      <div id="inventoryPaginationBar" class="filters-bar" style="display:none;justify-content:space-between;align-items:center;margin-top:16px;margin-bottom:0;">
        <span id="inventoryPageInfo" style="font-size:13px;color:var(--text-muted);"></span>
        <div style="display:flex;gap:8px;align-items:center;">
          <button type="button" class="btn-outline-custom btn-sm-custom" id="inventoryPrevPage">Previous</button>
          <button type="button" class="btn-outline-custom btn-sm-custom" id="inventoryNextPage">Next</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('addItemBtn')?.addEventListener('click', openAddModal);
  document.getElementById('downloadImportTemplateBtn')?.addEventListener('click', () => {
    closeToolbarDropdowns();
    downloadInventoryImportTemplate();
  });
  document.getElementById('downloadAssetWithComponentsTemplateBtn')?.addEventListener('click', () => {
    closeToolbarDropdowns();
    downloadAssetWithComponentsTemplate();
  });
  document.getElementById('downloadComponentImportTemplateBtn')?.addEventListener('click', () => {
    closeToolbarDropdowns();
    downloadComponentImportTemplate();
  });
  document.getElementById('importInventoryBtn')?.addEventListener('click', () => {
    closeToolbarDropdowns();
    openInventoryImportModal();
  });
  document.getElementById('importAssetWithComponentsBtn')?.addEventListener('click', () => {
    closeToolbarDropdowns();
    openAssetWithComponentsImportModal();
  });
  document.getElementById('importComponentsBtn')?.addEventListener('click', () => {
    closeToolbarDropdowns();
    openComponentImportModal();
  });
  document.getElementById('downloadToolbarBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleToolbarDropdown('downloadToolbarMenu', 'downloadToolbarBtn');
  });
  document.getElementById('importToolbarBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleToolbarDropdown('importToolbarMenu', 'importToolbarBtn');
  });
  document.getElementById('inventoryImportValidateBtn')?.addEventListener('click', validateInventoryImportFile);
  document.getElementById('componentImportValidateBtn')?.addEventListener('click', validateComponentImportFile);
  document.getElementById('awcImportValidateBtn')?.addEventListener('click', validateAssetWithComponentsImportFile);
  document.getElementById('componentShowAddBtn')?.addEventListener('click', () => showComponentForm('add'));
  document.getElementById('componentShowListBtn')?.addEventListener('click', showComponentListPanel);
  document.getElementById('componentCancelFormBtn')?.addEventListener('click', showComponentListPanel);

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.toolbar-dropdown')) closeToolbarDropdowns();
  });

  await loadDropdowns();
  populateClassificationFilter();
  initItemFormSearchableSelects();
  initSearchableSelects(document.getElementById('pageContent'));
  initInventoryTableSelection(permissions);
  await loadItems();
  bindInventoryActionsListeners();

  document.getElementById('searchInput').addEventListener('input', debounce(() => loadItems({ resetPage: true }), 300));
  document.getElementById('filterCategory').addEventListener('change', () => loadItems({ resetPage: true }));
  document.getElementById('filterLocation').addEventListener('change', () => loadItems({ resetPage: true }));
  document.getElementById('filterClassification').addEventListener('change', () => loadItems({ resetPage: true }));
  document.getElementById('filterStatus').addEventListener('change', () => loadItems({ resetPage: true }));
  document.getElementById('clearInventoryFiltersBtn')?.addEventListener('click', () => {
    clearInventoryFilters();
    loadItems({ resetPage: true });
  });
  document.getElementById('inventoryPrevPage')?.addEventListener('click', () => {
    if (inventoryPage <= 1) return;
    inventoryPage -= 1;
    loadItems();
  });
  document.getElementById('inventoryNextPage')?.addEventListener('click', () => {
    if (inventoryPage >= inventoryPagination.totalPages) return;
    inventoryPage += 1;
    loadItems();
  });
  document.getElementById('itemClassification').addEventListener('change', () => {
    applyClassificationFormState();
    syncSystemUnitComponentsSection();
  });
  document.getElementById('itemName')?.addEventListener('input', syncSystemUnitComponentsSection);
  document.getElementById('itemQuantity').addEventListener('input', syncCreatePreviewDisplay);
  bindGuardedFormSubmit(document.getElementById('itemForm'), saveItem, { loadingText: 'Saving...' });
  bindGuardedFormSubmit(document.getElementById('transferForm'), submitTransfer, { loadingText: 'Submitting...' });
  bindGuardedFormSubmit(document.getElementById('disposalForm'), submitDisposal, { loadingText: 'Submitting...' });
  bindGuardedFormSubmit(document.getElementById('maintenanceForm'), submitMaintenance, { loadingText: 'Submitting...' });
  bindGuardedFormSubmit(document.getElementById('componentForm'), submitComponent, { loadingText: 'Saving...' });

}

function populateClassificationFilter() {
  const select = document.getElementById('filterClassification');
  if (!select) return;
  const options = getFilterClassifications();
  select.innerHTML = '<option value="">All Classifications</option>'
    + options.map((option) => `<option>${option}</option>`).join('');
  if (typeof refreshSearchableSelects === 'function') {
    refreshSearchableSelects(select);
  }
}

async function loadDropdowns() {
  const requests = [API.getCategories(), API.getLocations()];
  if (canManageInventory(currentUser)) {
    requests.push(API.getSuppliers(), API.getUsers());
  }

  const results = await Promise.all(requests);
  categories = results[0]?.data || [];
  locations = results[1]?.data || [];
  suppliers = canManageInventory(currentUser) ? (results[2]?.data || []) : [];
  users = canManageInventory(currentUser) ? (results[3]?.data || []) : [];

  populateSelect(document.getElementById('filterCategory'), categories);
  populateSelect(document.getElementById('filterLocation'), locations, 'id', 'name', 'All Locations');
  populateSelect(document.getElementById('itemCategory'), categories);
  if (canManageInventory(currentUser)) {
    populateSelect(document.getElementById('itemSupplier'), suppliers);
    populateSelect(document.getElementById('itemCustodian'), users, 'id', 'full_name', 'Select custodian...');
  }
  populateSelect(document.getElementById('itemLocation'), locations);
  populateSelect(document.getElementById('transferLocation'), locations);
  populateSelect(document.getElementById('transferDepartment'), categories);
  syncItemFormSearchableSelects();
}

function clearInventoryFilters() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';

  const filterIds = ['filterCategory', 'filterLocation', 'filterClassification', 'filterStatus'];
  filterIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  if (typeof refreshSearchableSelects === 'function') {
    refreshSearchableSelects(filterIds.map((id) => document.getElementById(id)).filter(Boolean));
  }
}

async function loadItems(options = {}) {
  if (options.resetPage) inventoryPage = 1;

  const params = {
    page: inventoryPage,
    limit: INVENTORY_PAGE_SIZE
  };
  const search = document.getElementById('searchInput')?.value;
  const category = document.getElementById('filterCategory')?.value;
  const location = document.getElementById('filterLocation')?.value;
  const classification = document.getElementById('filterClassification')?.value;
  const status = document.getElementById('filterStatus')?.value;

  if (search) params.search = search;
  if (category) params.category_id = category;
  if (location) params.location_id = location;
  if (classification) params.asset_classification = classification;
  if (status) params.status = status;

  try {
    const res = await API.getInventory(params);
    items = res?.data || [];
    const pagination = res?.pagination || {};
    inventoryPagination = {
      total: Number(pagination.total ?? items.length),
      page: Number(pagination.page ?? inventoryPage),
      limit: Number(pagination.limit ?? INVENTORY_PAGE_SIZE),
      totalPages: Number(pagination.totalPages ?? 1)
    };
    inventoryPage = inventoryPagination.page;

    // If filters/archives shrunk results past the current page, load the last valid page.
    if (!items.length && inventoryPagination.total > 0 && inventoryPage > inventoryPagination.totalPages) {
      inventoryPage = inventoryPagination.totalPages;
      return loadItems();
    }

    renderTable();
    renderInventoryPagination();
    closeAllInventoryActionsMenus();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderInventoryPagination() {
  const bar = document.getElementById('inventoryPaginationBar');
  const info = document.getElementById('inventoryPageInfo');
  const prevBtn = document.getElementById('inventoryPrevPage');
  const nextBtn = document.getElementById('inventoryNextPage');
  if (!bar || !info || !prevBtn || !nextBtn) return;

  const { total, page, limit, totalPages } = inventoryPagination;
  if (!total) {
    bar.style.display = 'none';
    return;
  }

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  info.textContent = `Showing ${start}–${end} of ${total}`;
  prevBtn.disabled = page <= 1;
  nextBtn.disabled = page >= totalPages;
  bar.style.display = 'flex';
}

function renderTable() {
  const el = document.getElementById('inventoryTable');
  const permissions = getInventoryPermissions(currentUser);

  inventoryTableSelection?.pruneHiddenSelections();

  if (!items.length) {
    el.innerHTML = '<div class="empty-state"><i class="bi bi-box"></i>No inventory items found.</div>';
    inventoryTableSelection?.bindAfterRender(el);
    return;
  }

  el.innerHTML = `
    <table class="data-table inventory-list-table">
      <thead>
        <tr>
          ${inventoryTableSelection?.renderCheckboxHeader() || ''}
          <th class="inv-col-prop">Property No.</th>
          <th class="inv-col-name">Item Name</th>
          <th class="inv-col-dept">Department</th>
          <th class="inv-col-class">Classification</th>
          <th class="inv-col-loc">Location</th>
          <th class="inv-col-qty">Qty</th>
          <th class="inv-col-cond">Condition</th>
          <th class="inv-col-status">Status</th>
          <th class="inv-col-actions">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr${inventoryTableSelection?.renderRowAttrs(item) || ''}>
            ${inventoryTableSelection?.renderCheckboxCell(item) || ''}
            <td class="inv-col-prop">${displayCell(item.property_tag)}</td>
            <td class="inv-col-name">${displayCell(item.item_name)}</td>
            <td class="inv-col-dept">${displayCell(item.department_name || item.category_name)}</td>
            <td class="inv-col-class">${displayCell(formatClassificationDisplay(item.asset_classification))}</td>
            <td class="inv-col-loc">${displayCell(item.location_name)}</td>
            <td class="inv-col-qty">1</td>
            <td class="inv-col-cond">${displayCell(item.condition)}</td>
            <td class="inv-col-status">${getStatusBadge(item.status)}</td>
            <td class="inventory-actions-td inv-col-actions">${renderInventoryActionsCell(item, formatClassificationDisplay(item.asset_classification), permissions)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  finishTableRender(el);
  inventoryTableSelection?.bindAfterRender(el);
}

function syncClassificationOptions(currentValue = '') {
  const select = document.getElementById('itemClassification');
  if (!select) return;

  const normalized = currentValue ? normalizeAssetClassification(currentValue) : '';
  const options = getSelectableClassifications(normalized);
  select.innerHTML = '<option value="">Select classification</option>'
    + options.map((option) => `<option value="${option}">${option}</option>`).join('');
  if (normalized) select.value = normalized;
}

function applyClassificationFormState() {
  const classification = normalizeAssetClassification(document.getElementById('itemClassification').value);
  const isFixed = isFixedAssetClassification(classification);
  const isConsumable = classification === 'Consumable';

  const custodianRow = document.getElementById('custodianRow');
  const maintenanceRow = document.getElementById('maintenanceRow');
  const serviceProviderRow = document.getElementById('serviceProviderRow');

  if (custodianRow) custodianRow.style.display = isFixed ? '' : 'none';
  if (maintenanceRow) maintenanceRow.style.display = isFixed ? '' : 'none';
  if (serviceProviderRow) serviceProviderRow.style.display = isFixed ? '' : 'none';

  if (isConsumable || !isFixed) {
    document.getElementById('itemCustodian').value = '';
    document.getElementById('itemMaintenanceSchedule').value = '';
    document.getElementById('itemNextMaintenance').value = '';
    document.getElementById('itemServiceProvider').value = '';
  }
}

function setAssetFormMode(isEdit) {
  const assetCountRow = document.getElementById('assetCountRow');
  const editSerialNumberRow = document.getElementById('editSerialNumberRow');
  const quantityInput = document.getElementById('itemQuantity');

  if (assetCountRow) assetCountRow.style.display = isEdit ? 'none' : '';
  if (editSerialNumberRow) editSerialNumberRow.style.display = isEdit ? '' : 'none';
  if (quantityInput) quantityInput.required = !isEdit;
}

function syncCreatePreviewDisplay() {
  const previewEl = document.getElementById('itemCreatePreview');
  const qtyEl = document.getElementById('itemQuantity');
  if (!previewEl || !qtyEl) return;

  const qty = parseInt(qtyEl.value, 10);
  const itemId = document.getElementById('itemId')?.value;
  if (itemId) return;

  if (Number.isNaN(qty) || qty < 1) {
    previewEl.value = 'Each asset becomes one inventory record';
    return;
  }

  previewEl.value = qty === 1
    ? '1 asset record'
    : `${qty} asset records`;
}

function openAddModal() {
  document.getElementById('itemModalTitle').textContent = 'Add Item';
  document.getElementById('itemForm').reset();
  document.getElementById('itemId').value = '';
  document.getElementById('itemQuantity').value = '1';
  const previewEl = document.getElementById('itemCreatePreview');
  if (previewEl) previewEl.value = '1 asset record';
  setAssetFormMode(false);
  syncClassificationOptions('');
  applyClassificationFormState();
  resetSystemUnitComponentFields();
  syncSystemUnitComponentsSection();
  clearEditComponentsSection();
  syncItemFormSearchableSelects();
  openModal('itemModal');
}

async function editItem(id) {
  try {
    const res = await API.getInventoryItem(id);
    const item = res.data;
    if (isConsumableEditBlocked(item.asset_classification)) {
      showToast(CONSUMABLE_DISABLED_MESSAGE, 'error');
      return;
    }
    document.getElementById('itemModalTitle').textContent = 'Edit Item';
    document.getElementById('itemId').value = item.id;
    document.getElementById('itemName').value = item.item_name;
    document.getElementById('itemDescription').value = item.description || '';
    document.getElementById('itemCategory').value = item.department_id || item.category_id;
    document.getElementById('itemSupplier').value = item.supplier_id || '';
    document.getElementById('itemBrand').value = item.brand || '';
    document.getElementById('itemModel').value = item.model || '';
    document.getElementById('itemEditSerialNumber').value = item.serial_number || '';
    setAssetFormMode(true);
    document.getElementById('itemLocation').value = item.location_id || '';
    document.getElementById('itemPR').value = item.purchase_request_number || '';
    document.getElementById('itemPO').value = item.purchase_order_number || '';
    document.getElementById('itemInvoice').value = item.invoice_number || '';
    document.getElementById('itemAcquisitionDate').value = item.acquisition_date
      ? String(item.acquisition_date).split('T')[0]
      : '';
    document.getElementById('itemUnitCost').value = item.unit_cost != null ? item.unit_cost : '';
    document.getElementById('itemCondition').value = item.condition;
    syncClassificationOptions(item.asset_classification);
    document.getElementById('itemMaterial').value = item.material || '';
    document.getElementById('itemCustodian').value = item.custodian_id || '';
    document.getElementById('itemMaintenanceSchedule').value = item.maintenance_schedule || '';
    document.getElementById('itemNextMaintenance').value = item.next_maintenance_date ? item.next_maintenance_date.split('T')[0] : '';
    document.getElementById('itemServiceProvider').value = item.service_provider || '';
    applyClassificationFormState();
    resetSystemUnitComponentFields();
    syncSystemUnitComponentsSection();
    syncItemFormSearchableSelects();
    openModal('itemModal');
    await loadEditComponentsForItem(item);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function escapeHtmlAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function clearEditComponentsSection() {
  const section = document.getElementById('editComponentsSection');
  const list = document.getElementById('editComponentsList');
  if (list) list.innerHTML = '';
  if (section) section.style.display = 'none';
}

function renderEditComponentsList(components = []) {
  const section = document.getElementById('editComponentsSection');
  const list = document.getElementById('editComponentsList');
  if (!section || !list) return;

  if (!components.length) {
    clearEditComponentsSection();
    return;
  }

  list.innerHTML = components.map((c) => {
    const id = Number(c.id);
    const name = c.component_name || '';
    const brand = c.brand || '';
    const model = c.model || '';
    const serial = c.serial_number || '';
    const remarks = c.remarks || '';
    return `
      <div class="edit-component-block" data-component-id="${id}"
           data-original-name="${escapeHtmlAttr(name)}"
           data-original-brand="${escapeHtmlAttr(brand)}"
           data-original-model="${escapeHtmlAttr(model)}"
           data-original-serial="${escapeHtmlAttr(serial)}"
           data-original-remarks="${escapeHtmlAttr(remarks)}"
           style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border-color,#e5e7eb);">
        <h5 style="font-size:13px;font-weight:600;margin:0 0 10px;">${escapeHtmlAttr(name || 'Component')}</h5>
        <div class="form-group">
          <label>Component Name</label>
          <input type="text" class="form-control-custom edit-comp-name" value="${escapeHtmlAttr(name)}" required>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Brand</label><input type="text" class="form-control-custom edit-comp-brand" value="${escapeHtmlAttr(brand)}" placeholder="Optional"></div>
          <div class="form-group"><label>Model / Capacity</label><input type="text" class="form-control-custom edit-comp-model" value="${escapeHtmlAttr(model)}" placeholder="Optional"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Serial Number</label><input type="text" class="form-control-custom edit-comp-serial" value="${escapeHtmlAttr(serial)}" placeholder="Optional"></div>
          <div class="form-group"><label>Remarks</label><input type="text" class="form-control-custom edit-comp-remarks" value="${escapeHtmlAttr(remarks)}" placeholder="Optional"></div>
        </div>
      </div>
    `;
  }).join('');

  section.style.display = '';
}

async function loadEditComponentsForItem(item) {
  clearEditComponentsSection();
  if (!item?.id) return;
  if (!canReplaceComponent(item.asset_classification)) return;
  if (!canManageInventory(currentUser)) return;

  try {
    const res = await API.getComponents(item.id);
    const components = Array.isArray(res?.data?.components) ? res.data.components : [];
    renderEditComponentsList(components);
  } catch (err) {
    // Parent may not support components; keep edit item usable.
    clearEditComponentsSection();
  }
}

function collectEditedComponentUpdates() {
  const blocks = document.querySelectorAll('#editComponentsList .edit-component-block');
  const updates = [];
  for (const block of blocks) {
    const id = parseInt(block.getAttribute('data-component-id'), 10);
    if (!id) continue;
    const name = block.querySelector('.edit-comp-name')?.value.trim() || '';
    const brand = block.querySelector('.edit-comp-brand')?.value.trim() || '';
    const model = block.querySelector('.edit-comp-model')?.value.trim() || '';
    const serial = block.querySelector('.edit-comp-serial')?.value.trim() || '';
    const remarks = block.querySelector('.edit-comp-remarks')?.value.trim() || '';

    if (!name) {
      return { error: 'Component name is required for all listed components' };
    }

    const original = {
      name: block.getAttribute('data-original-name') || '',
      brand: block.getAttribute('data-original-brand') || '',
      model: block.getAttribute('data-original-model') || '',
      serial: block.getAttribute('data-original-serial') || '',
      remarks: block.getAttribute('data-original-remarks') || ''
    };

    const changed = name !== original.name
      || brand !== original.brand
      || model !== original.model
      || serial !== original.serial
      || remarks !== original.remarks;

    if (!changed) continue;

    updates.push({
      id,
      component_name: name,
      brand: brand || null,
      model: model || null,
      serial_number: serial || null,
      remarks: remarks || null
    });
  }
  return { updates };
}

async function saveEditedComponents() {
  const collected = collectEditedComponentUpdates();
  if (collected.error) {
    throw new Error(collected.error);
  }
  const updates = collected.updates || [];
  let saved = 0;
  for (const payload of updates) {
    const { id, ...data } = payload;
    await API.updateAssetComponent(id, data);
    saved += 1;
  }
  return saved;
}

function getItemFormData() {
  const isEdit = Boolean(document.getElementById('itemId').value);
  const data = {
    item_name: document.getElementById('itemName').value,
    description: document.getElementById('itemDescription').value.trim() || null,
    department_id: parseInt(document.getElementById('itemCategory').value),
    category_id: parseInt(document.getElementById('itemCategory').value),
    supplier_id: document.getElementById('itemSupplier').value ? parseInt(document.getElementById('itemSupplier').value) : null,
    brand: document.getElementById('itemBrand').value,
    model: document.getElementById('itemModel').value,
    location_id: document.getElementById('itemLocation').value ? parseInt(document.getElementById('itemLocation').value) : null,
    acquisition_date: document.getElementById('itemAcquisitionDate').value || null,
    purchase_request_number: document.getElementById('itemPR').value.trim() || null,
    purchase_order_number: document.getElementById('itemPO').value.trim() || null,
    invoice_number: document.getElementById('itemInvoice').value.trim() || null,
    unit_cost: document.getElementById('itemUnitCost').value !== '' ? document.getElementById('itemUnitCost').value : null,
    condition: document.getElementById('itemCondition').value,
    asset_classification: document.getElementById('itemClassification').value,
    material: document.getElementById('itemMaterial').value || null,
    custodian_id: document.getElementById('itemCustodian').value ? parseInt(document.getElementById('itemCustodian').value) : null,
    maintenance_schedule: document.getElementById('itemMaintenanceSchedule').value || null,
    next_maintenance_date: document.getElementById('itemNextMaintenance').value || null,
    service_provider: document.getElementById('itemServiceProvider').value || null
  };

  if (isEdit) {
    data.serial_number = document.getElementById('itemEditSerialNumber').value.trim() || null;
  }

  if (!isEdit) {
    data.asset_count = Math.max(1, parseInt(document.getElementById('itemQuantity').value, 10) || 1);
  }

  return data;
}

/** Optional inline component fields shown only when adding a System Unit. */
const SYSTEM_UNIT_COMPONENT_FIELDS = [
  { id: 'suCompProcessor', name: 'Processor' },
  { id: 'suCompRam', name: 'RAM' },
  { id: 'suCompStorage', name: 'Storage' },
  { id: 'suCompMotherboard', name: 'Motherboard' },
  { id: 'suCompPowerSupply', name: 'Power Supply' },
  { id: 'suCompGraphicsCard', name: 'Graphics Card' },
  { id: 'suCompMonitor', name: 'Monitor' },
  { id: 'suCompKeyboard', name: 'Keyboard' },
  { id: 'suCompMouse', name: 'Mouse' }
];

function isSystemUnitItemName(value) {
  return String(value || '').trim().toLowerCase() === 'system unit';
}

function resetSystemUnitComponentFields() {
  SYSTEM_UNIT_COMPONENT_FIELDS.forEach(({ id }) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const remarks = document.getElementById('suCompRemarks');
  if (remarks) remarks.value = '';
}

function syncSystemUnitComponentsSection() {
  const section = document.getElementById('systemUnitComponentsSection');
  if (!section) return;
  const isEdit = Boolean(document.getElementById('itemId')?.value);
  const show = !isEdit && isSystemUnitItemName(document.getElementById('itemName')?.value);
  section.style.display = show ? '' : 'none';
  if (!show) resetSystemUnitComponentFields();
}

/**
 * Collect filled System Unit component fields for create-on-save shortcut.
 * Each filled field becomes one component via the existing Add Component API.
 */
function getFilledSystemUnitComponents() {
  const remarks = document.getElementById('suCompRemarks')?.value.trim() || null;
  const filled = [];
  SYSTEM_UNIT_COMPONENT_FIELDS.forEach(({ id, name }) => {
    const value = document.getElementById(id)?.value.trim();
    if (!value) return;
    filled.push({
      component_name: name,
      brand: value,
      remarks
    });
  });
  return filled;
}

/**
 * After a System Unit is created, reuse existing POST /api/components for each filled field.
 * Does not change Add Component modal behavior.
 */
async function createSystemUnitComponentsForParents(parentIds, components, options = {}) {
  const dateInstalled = options.dateInstalled || new Date().toISOString().split('T')[0];
  const condition = options.condition || 'Good';
  let created = 0;
  let failed = 0;

  for (const parentId of parentIds) {
    for (const component of components) {
      try {
        await API.createAssetComponent({
          parent_asset_id: parentId,
          component_name: component.component_name,
          asset_classification: 'Semi-Durable',
          brand: component.brand || null,
          model: null,
          serial_number: null,
          date_installed: dateInstalled,
          condition,
          remarks: component.remarks || null
        });
        created += 1;
      } catch (err) {
        failed += 1;
        console.error(`Failed to create component "${component.component_name}" for parent ${parentId}:`, err.message);
      }
    }
  }

  return { created, failed };
}

async function saveItem(e) {
  e.preventDefault();
  const id = document.getElementById('itemId').value;
  const data = getItemFormData();

  const classification = normalizeAssetClassification(data.asset_classification);

  if (!document.getElementById('itemClassification').value) {
    showToast('Classification is required', 'error');
    return;
  }

  data.asset_classification = classification;

  if (isConsumableClassification(classification) && !isConsumableEnabled()) {
    showToast(CONSUMABLE_DISABLED_MESSAGE, 'error');
    return;
  }

  if (isFixedAssetClassification(classification) && !data.custodian_id) {
    showToast('Assigned custodian is required for Durable items', 'error');
    return;
  }

  const inlineComponents = (!id && isSystemUnitItemName(data.item_name))
    ? getFilledSystemUnitComponents()
    : [];

  if (inlineComponents.length && !isFixedAssetClassification(classification)) {
    showToast('System Unit components require Durable classification', 'error');
    return;
  }

  try {
    if (id) {
      await API.updateInventoryItem(id, data);
      let componentSaved = 0;
      try {
        componentSaved = await saveEditedComponents();
      } catch (compErr) {
        showToast(compErr.message || 'Item saved, but component update failed', 'error');
        closeModal('itemModal');
        loadItems();
        return;
      }
      showToast(
        componentSaved > 0
          ? `Item updated successfully · ${componentSaved} component(s) updated`
          : 'Item updated successfully'
      );
    } else {
      const res = await API.createInventoryItem(data);
      const createdCount = res?.data?.created_count || 1;
      const parCount = res?.data?.generated_par_count || 0;
      let baseMessage = res?.message || (createdCount > 1 ? `${createdCount} assets created successfully` : 'Item created successfully');
      const generated = res?.data?.generated_document || res?.data?.custodian_par;

      if (inlineComponents.length) {
        const parentIds = Array.isArray(res?.data?.created_ids) && res.data.created_ids.length
          ? res.data.created_ids
          : (res?.data?.id ? [res.data.id] : []);
        if (parentIds.length) {
          const componentResult = await createSystemUnitComponentsForParents(parentIds, inlineComponents, {
            dateInstalled: data.acquisition_date || new Date().toISOString().split('T')[0],
            condition: data.condition || 'Good'
          });
          if (componentResult.created > 0) {
            baseMessage += ` · ${componentResult.created} component(s) added`;
          }
          if (componentResult.failed > 0) {
            showToast(`${baseMessage}. ${componentResult.failed} component(s) could not be added — use Add Component on the item.`, 'error');
          } else {
            showToast(parCount > 1 ? `${baseMessage} (${parCount} PARs generated)` : baseMessage);
          }
        } else {
          showToast(parCount > 1 ? `${baseMessage} (${parCount} PARs generated)` : baseMessage);
        }
      } else {
        showToast(parCount > 1 ? `${baseMessage} (${parCount} PARs generated)` : baseMessage);
      }

      if (generated) {
        openGeneratedDocument(generated, generated.document_type || 'PAR');
      }
    }
    closeModal('itemModal');
    loadItems();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function archiveItem(id) {
  if (!await confirmAction('Archive this item? It will remain in the Archive for 30 days before being permanently deleted.', { variant: 'danger', title: 'Archive Item', confirmText: 'Archive' })) return;
  await guardAsyncAction(async () => {
    try {
      const res = await API.archiveInventoryItem(id);
      showToast(res?.message || 'The record has been archived successfully. It will remain in the Archive for 30 days before being permanently deleted.');
      loadItems();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, { loadingText: 'Archiving...', lockKey: `archive-item-${id}` });
}

function openTransferModal(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  if (!canTransferAsset(item.asset_classification)) {
    showToast('This item cannot be transferred', 'error');
    return;
  }
  if (item.status !== 'Available') {
    showToast(`Only available assets can be transferred (current status: ${item.status})`, 'error');
    return;
  }
  document.getElementById('transferItemId').value = id;
  document.getElementById('transferAssetName').value = item.item_name || '';
  document.getElementById('transferPropertyTag').value = item.property_tag || '-';
  document.getElementById('transferCurrentDept').value = item.department_name || item.category_name || '-';
  document.getElementById('transferCurrentLocation').value = item.location_name || '-';
  document.getElementById('transferReason').value = '';
  document.getElementById('transferDepartment').value = '';
  document.getElementById('transferLocation').value = '';
  syncItemFormSearchableSelects();
  openModal('transferModal');
}

async function submitTransfer(e) {
  e.preventDefault();
  try {
    await API.createTransfer({
      inventory_item_id: parseInt(document.getElementById('transferItemId').value),
      to_location_id: parseInt(document.getElementById('transferLocation').value),
      to_department_id: parseInt(document.getElementById('transferDepartment').value),
      reason: document.getElementById('transferReason').value
    });
    showToast('Transfer request submitted');
    closeModal('transferModal');
  } catch (err) { showToast(err.message, 'error'); }
}

function openDisposalModal(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  if (item.status !== 'Available') {
    showToast(`Only available assets can be submitted for disposal (current status: ${item.status})`, 'error');
    return;
  }
  document.getElementById('disposalItemId').value = id;
  document.getElementById('disposalPropertyTag').value = item?.property_tag || '-';
  const qtyGroup = document.getElementById('disposalQuantityGroup');
  if (qtyGroup) qtyGroup.style.display = 'none';
  document.getElementById('disposalReason').value = '';
  openModal('disposalModal');
}

async function submitDisposal(e) {
  e.preventDefault();
  try {
    const itemId = parseInt(document.getElementById('disposalItemId').value, 10);
    const res = await API.createDisposal({
      inventory_item_id: itemId,
      quantity: 1,
      reason: document.getElementById('disposalReason').value
    });
    showToast('Disposal request submitted');
    closeModal('disposalModal');
  } catch (err) { showToast(err.message, 'error'); }
}

function openMaintenanceModal(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  if (!canMaintainAsset(item.asset_classification)) {
    showToast('Maintenance is only available for Durable items', 'error');
    return;
  }
  if (item.status !== 'Available') {
    showToast(`Only available assets can be submitted for maintenance (current status: ${item.status})`, 'error');
    return;
  }
  document.getElementById('maintenanceItemId').value = id;
  document.getElementById('maintenanceAssetName').value = item.item_name || '';
  document.getElementById('maintenancePropertyTag').value = item.property_tag || '-';
  document.getElementById('maintenanceDepartment').value = item.department_name || item.category_name || '-';
  document.getElementById('maintenanceLocation').value = item.location_name || '-';
  document.getElementById('maintenanceProblem').value = '';
  document.getElementById('maintenanceType').value = 'Preventive';
  document.getElementById('maintenancePriority').value = 'Medium';
  document.getElementById('maintenanceDate').value = '';
  document.getElementById('maintenanceRequestedDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('maintenanceNotes').value = '';
  refreshSearchableSelects(document.getElementById('maintenanceModal'));
  openModal('maintenanceModal');
}

async function submitMaintenance(e) {
  e.preventDefault();
  try {
    await API.createMaintenance({
      inventory_item_id: parseInt(document.getElementById('maintenanceItemId').value),
      reported_problem: document.getElementById('maintenanceProblem').value,
      maintenance_type: document.getElementById('maintenanceType').value,
      priority: document.getElementById('maintenancePriority').value,
      scheduled_date: document.getElementById('maintenanceDate').value,
      requested_date: document.getElementById('maintenanceRequestedDate').value,
      notes: document.getElementById('maintenanceNotes').value,
      description: document.getElementById('maintenanceNotes').value
    });
    showToast('Maintenance request submitted');
    closeModal('maintenanceModal');
    loadItems();
  } catch (err) { showToast(err.message, 'error'); }
}

let componentModalState = {
  parentId: null,
  mode: 'list',
  replaceId: null,
  components: [],
  history: []
};

function resetComponentFormFields() {
  document.getElementById('componentName').value = '';
  document.getElementById('componentClassification').value = '';
  document.getElementById('componentBrand').value = '';
  document.getElementById('componentModel').value = '';
  document.getElementById('componentSerial').value = '';
  document.getElementById('componentNotes').value = '';
  document.getElementById('componentCondition').value = 'Good';
  document.getElementById('componentDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('componentReplaceId').value = '';
}

function showComponentListPanel() {
  componentModalState.mode = 'list';
  componentModalState.replaceId = null;
  document.getElementById('componentListPanel').style.display = 'block';
  document.getElementById('componentForm').style.display = 'none';
  document.getElementById('componentShowAddBtn').style.display = '';
  document.getElementById('componentShowListBtn').style.display = 'none';
  document.getElementById('componentModalFooter').style.display = '';
}

function showComponentForm(mode, componentId = null) {
  componentModalState.mode = mode;
  componentModalState.replaceId = componentId;
  resetComponentFormFields();

  document.getElementById('componentListPanel').style.display = 'none';
  document.getElementById('componentForm').style.display = 'block';
  document.getElementById('componentShowAddBtn').style.display = 'none';
  document.getElementById('componentShowListBtn').style.display = '';
  document.getElementById('componentModalFooter').style.display = 'none';

  if (mode === 'replace') {
    document.getElementById('componentFormTitle').textContent = 'Replace Component';
    document.getElementById('componentDateLabel').textContent = 'Replacement / Install Date';
    document.getElementById('componentSubmitBtn').textContent = 'Save Replacement';
    document.getElementById('componentReplaceId').value = String(componentId || '');
    const existing = componentModalState.components.find((c) => Number(c.id) === Number(componentId));
    if (existing) {
      document.getElementById('componentName').value = existing.component_name || '';
      document.getElementById('componentBrand').placeholder = existing.brand ? `Previous: ${existing.brand}` : 'Optional';
      document.getElementById('componentModel').placeholder = existing.model ? `Previous: ${existing.model}` : 'Optional';
    }
  } else {
    document.getElementById('componentFormTitle').textContent = 'Add Component';
    document.getElementById('componentDateLabel').textContent = 'Date Installed';
    document.getElementById('componentSubmitBtn').textContent = 'Save Component';
  }
}

function renderComponentActiveTable(components = []) {
  const container = document.getElementById('componentActiveList');
  if (!container) return;
  if (!components.length) {
    container.innerHTML = '<p style="font-size:13px;color:var(--text-muted);margin:0;">No components registered yet.</p>';
    return;
  }
  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Component Name</th>
          <th>Property Tag</th>
          <th>Brand</th>
          <th>Model</th>
          <th>Status</th>
          <th>Date Added</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${components.map((c) => `
          <tr>
            <td>${displayCell(c.component_name)}</td>
            <td>${displayCell(c.component_property_tag)}</td>
            <td>${displayCell(c.brand)}</td>
            <td>${displayCell(c.model)}</td>
            <td>${getStatusBadge(c.inventory_status || c.status || 'Active')}</td>
            <td>${formatDetailDate(c.inventory_created_at || c.date_installed || c.created_at)}</td>
            <td style="white-space:nowrap;">
              <button type="button" class="btn-outline-custom btn-sm-custom" onclick="showComponentForm('replace', ${c.id})">
                Replace
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderComponentHistoryTable(history = []) {
  const container = document.getElementById('componentHistoryList');
  if (!container) return;
  if (!history.length) {
    container.innerHTML = '<p style="font-size:13px;color:var(--text-muted);margin:0;">No component replacement history yet.</p>';
    return;
  }
  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Previous Component</th>
          <th>New Component</th>
          <th>Replacement Date</th>
          <th>Replaced By</th>
          <th>Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${history.map((h) => `
          <tr>
            <td>${displayCell(h.old_component_name)}</td>
            <td>${displayCell(h.new_component_name)}</td>
            <td>${formatDetailDate(h.replacement_date)}</td>
            <td>${displayCell(h.replaced_by_name)}</td>
            <td>${displayCell(h.notes)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function refreshComponentModalData() {
  const parentId = componentModalState.parentId;
  if (!parentId) return;
  const res = await API.getComponents(parentId);
  const data = res?.data || {};
  componentModalState.components = Array.isArray(data.components) ? data.components : [];
  componentModalState.history = Array.isArray(data.history) ? data.history : [];
  renderComponentActiveTable(componentModalState.components);
  renderComponentHistoryTable(componentModalState.history);
}

async function openComponentModal(id) {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  if (!canManageInventory(currentUser)) {
    showToast('Administrator or Property Manager access required', 'error');
    return;
  }
  if (!canReplaceComponent(item.asset_classification)) {
    showToast('Components management is only available for Durable assets', 'error');
    return;
  }

  componentModalState.parentId = id;
  document.getElementById('componentParentId').value = id;
  document.getElementById('componentParentName').value = item.item_name || '';
  document.getElementById('componentPropertyTag').value = item.property_tag || '-';
  showComponentListPanel();
  openModal('componentModal');

  try {
    await refreshComponentModalData();
  } catch (err) {
    showToast(err.message || 'Unable to load components', 'error');
  }
}

async function submitComponent(e) {
  e.preventDefault();
  const parentId = parseInt(document.getElementById('componentParentId').value, 10);
  const classification = document.getElementById('componentClassification').value;
  const payload = {
    component_name: document.getElementById('componentName').value.trim(),
    asset_classification: classification,
    brand: document.getElementById('componentBrand').value.trim() || null,
    model: document.getElementById('componentModel').value.trim() || null,
    serial_number: document.getElementById('componentSerial').value.trim() || null,
    date_installed: document.getElementById('componentDate').value || null,
    condition: document.getElementById('componentCondition').value || null,
    remarks: document.getElementById('componentNotes').value.trim() || null
  };

  if (!payload.component_name) {
    showToast('Component name is required', 'error');
    return;
  }
  if (!payload.asset_classification) {
    showToast('Classification is required', 'error');
    return;
  }

  try {
    if (componentModalState.mode === 'replace') {
      const replaceId = parseInt(document.getElementById('componentReplaceId').value, 10);
      if (!replaceId) {
        showToast('Component to replace was not found', 'error');
        return;
      }
      await API.replaceAssetComponent(replaceId, {
        ...payload,
        replacement_date: payload.date_installed,
        notes: payload.remarks
      });
      showToast('Component replaced successfully');
    } else {
      await API.createAssetComponent({
        parent_asset_id: parentId,
        ...payload
      });
      showToast('Component added successfully');
    }
    await refreshComponentModalData();
    showComponentListPanel();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function displayCell(value) {
  if (value == null || String(value).trim() === '') return '—';
  return value;
}

function displayDetailValue(value) {
  if (value == null || String(value).trim() === '') return '—';
  return String(value);
}

function formatDetailDate(dateStr) {
  if (!dateStr) return '—';
  return formatDate(dateStr) || '—';
}

function formatDetailCurrency(value) {
  if (value == null || value === '') return '—';
  const num = parseFloat(value);
  if (Number.isNaN(num)) return '—';
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderDetailRow(fields) {
  return `
    <div class="form-row">
      ${fields.map((field) => `
        <div class="form-group">
          <label>${field.label}</label>
          <div${field.wrap ? ' style="word-break:break-word;overflow-wrap:break-word;line-height:1.45;"' : ''}>${field.html ?? displayDetailValue(field.value)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderDetailSection(title, fields) {
  const blocks = [];
  let pair = [];

  fields.forEach((field) => {
    if (field.fullWidth) {
      if (pair.length) {
        blocks.push(renderDetailRow(pair));
        pair = [];
      }
      blocks.push(`
        <div class="form-group">
          <label>${field.label}</label>
          <div${field.wrap ? ' style="word-break:break-word;overflow-wrap:break-word;line-height:1.45;"' : ''}>${field.html ?? displayDetailValue(field.value)}</div>
        </div>
      `);
      return;
    }

    pair.push(field);
    if (pair.length === 2) {
      blocks.push(renderDetailRow(pair));
      pair = [];
    }
  });

  if (pair.length) {
    blocks.push(renderDetailRow(pair));
  }

  return `
    <div class="asset-detail-section" style="margin-bottom:20px;">
      <h4 style="font-size:14px;font-weight:600;margin:0 0 12px;">${title}</h4>
      ${blocks.join('')}
    </div>
  `;
}

function renderAssetDetailSummary(item) {
  return `
    <div class="asset-detail-summary" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;padding:14px 16px;background:var(--gray-light,#f5f5f5);border-radius:8px;border:1px solid var(--border-color,#e5e5e5);">
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted,#666);margin-bottom:4px;">Property Tag</div>
        <div style="font-weight:600;font-size:15px;">${displayDetailValue(item.property_tag)}</div>
      </div>
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted,#666);margin-bottom:4px;">Status</div>
        <div>${getStatusBadge(item.status)}</div>
      </div>
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted,#666);margin-bottom:4px;">Department</div>
        <div style="font-weight:500;">${displayDetailValue(item.department_name || item.category_name)}</div>
      </div>
    </div>
  `;
}

const ASSET_DETAIL_TABS = [
  { key: 'overview', panelId: 'assetDetailOverview' },
  { key: 'documents', panelId: 'assetDetailDocuments' },
  { key: 'history', panelId: 'assetDetailHistory' },
  { key: 'maintenance', panelId: 'assetDetailMaintenance' },
  { key: 'transfers', panelId: 'assetDetailTransfers' },
  { key: 'borrows', panelId: 'assetDetailBorrowHistory' },
  { key: 'disposals', panelId: 'assetDetailDisposal' }
];

const ASSET_INVENTORY_DOCUMENT_TYPES = ['PAR', 'GRN'];

function renderAssetDetailOverview(item, replacements = [], linkedParts = [], activeComponents = []) {
  const showComponents = canManageInventory(currentUser) && canReplaceComponent(item.asset_classification);
  const componentsHtml = showComponents
    ? renderComponentHistory(replacements, linkedParts, activeComponents)
    : '';

  const itemInformation = renderDetailSection('Item Information', [
    { label: 'Item Name', value: item.item_name },
    { label: 'Classification', value: formatClassificationDisplay(item.asset_classification) },
    { label: 'Condition', value: item.condition },
    { label: 'Material', value: item.material },
    { label: 'Department', value: item.department_name || item.category_name },
    { label: 'Location', value: item.location_name },
    { label: 'Supplier', value: item.supplier_name },
    { label: 'Custodian', value: item.custodian_name },
    { label: 'Serial Number', value: item.serial_number },
    { label: 'Brand', value: item.brand },
    { label: 'Model', value: item.model },
    { label: 'Unit Cost', value: formatDetailCurrency(item.unit_cost) },
    { label: 'Acquisition Date', value: formatDetailDate(item.acquisition_date) },
    { label: 'Purchase Request (PR)', value: item.purchase_request_number },
    { label: 'Purchase Order (PO)', value: item.purchase_order_number },
    { label: 'Invoice Number', value: item.invoice_number },
    { label: 'Maintenance Schedule', value: item.maintenance_schedule },
    { label: 'Next Maintenance Date', value: formatDetailDate(item.next_maintenance_date) },
    { label: 'Service Provider', value: item.service_provider },
    { label: 'Description', value: item.description, fullWidth: true, wrap: true }
  ]);

  const systemInformation = renderDetailSection('System Information', [
    { label: 'Inventory ID', value: item.id },
    { label: 'Item Code', value: item.item_code },
    { label: 'Property Tag', value: item.property_tag },
    { label: 'Batch ID', value: item.batch_id },
    { label: 'Status', html: getStatusBadge(item.status) },
    { label: 'Created At', value: formatDetailDate(item.created_at) },
    { label: 'Updated At', value: formatDetailDate(item.updated_at) },
    { label: 'Archived At', value: formatDetailDate(item.archived_at) },
    { label: 'Archived By', value: item.archived_by_name || item.archived_by }
  ]);

  return `
    ${itemInformation}
    <hr style="border:none;border-top:1px solid var(--border-color,#e5e5e5);margin:8px 0 20px;">
    ${systemInformation}
    ${componentsHtml}
  `;
}

const ASSET_WORKFLOW_DOCUMENT_TYPES = [
  { type: 'ABL', module: 'borrow', recordsKey: 'borrows' },
  { type: 'RTF', module: 'transfer', recordsKey: 'transfers' },
  { type: 'TRF', module: 'transfer', recordsKey: 'transfers' },
  { type: 'RDF', module: 'disposal', recordsKey: 'disposals' }
];

async function lookupDocumentSafe(type, module, transactionId) {
  if (!transactionId) return null;
  try {
    const res = await API.lookupDocument(type, module, transactionId);
    return res?.data || null;
  } catch {
    return null;
  }
}

function getWorkflowDocumentTransactionId(record, module) {
  if (!record) return null;
  if (module === 'transfer') return record.transfer_request_id || record.id;
  return record.id;
}

function uniqueDocuments(documents = []) {
  const seen = new Set();
  return documents
    .filter((doc) => {
      if (!doc?.id || seen.has(doc.id)) return false;
      seen.add(doc.id);
      return true;
    })
    .sort((a, b) => new Date(b.generated_at || 0) - new Date(a.generated_at || 0));
}

async function fetchAssetDocuments(itemId, borrows = [], transfers = [], disposals = []) {
  try {
    const res = await API.getDocumentsByInventory(itemId);
    if (Array.isArray(res?.data)) {
      return uniqueDocuments(res.data);
    }
  } catch {
    // Fall back to per-type lookups if the aggregate endpoint is unavailable
  }

  const lookups = ASSET_INVENTORY_DOCUMENT_TYPES.map((type) =>
    lookupDocumentSafe(type, 'inventory', itemId)
  );

  for (const spec of ASSET_WORKFLOW_DOCUMENT_TYPES) {
    const records = spec.recordsKey === 'borrows'
      ? borrows
      : spec.recordsKey === 'transfers'
        ? transfers
        : disposals;
    const transactionIds = [...new Set(
      records
        .map((record) => getWorkflowDocumentTransactionId(record, spec.module))
        .filter(Boolean)
    )];
    for (const transactionId of transactionIds) {
      lookups.push(lookupDocumentSafe(spec.type, spec.module, transactionId));
    }
  }

  const results = await Promise.all(lookups);
  return uniqueDocuments(results.filter(Boolean));
}

function renderAssetDocumentActions(docId) {
  return `
    <button class="btn-icon" onclick="API.openDocumentPreview(${docId})" title="Preview" aria-label="Preview"><i class="bi bi-eye"></i></button>
    <button class="btn-icon" onclick="API.downloadDocumentPdf(${docId})" title="Download PDF" aria-label="Download PDF"><i class="bi bi-file-pdf"></i></button>
  `;
}

function renderAssetDocuments(documents = []) {
  if (!documents.length) {
    return renderEmptyHistory('No official documents generated for this asset yet.');
  }

  return `<div class="table-responsive"><table class="data-table"><thead><tr>
    <th>Document No.</th><th>Type</th><th>Related Module</th><th>Status</th><th>Generated By</th><th>Generated Date</th><th>Actions</th>
  </tr></thead><tbody>
    ${documents.map((doc) => `<tr>
      <td>${doc.document_number || '—'}</td>
      <td>${doc.document_type || '—'}</td>
      <td>${doc.related_module || '—'}${doc.related_transaction_id ? ` #${doc.related_transaction_id}` : ''}</td>
      <td>${doc.status || '—'}</td>
      <td>${doc.generated_by_name || '—'}</td>
      <td>${formatDate(doc.generated_at)}</td>
      <td style="white-space:nowrap;">${renderAssetDocumentActions(doc.id)}</td>
    </tr>`).join('')}
  </tbody></table></div>`;
}

function renderEmptyHistory(message) {
  return `<p style="font-size:13px;color:#666;margin:0;">${message}</p>`;
}

function renderComponentHistory(replacements = [], _linkedParts = [], activeComponents = []) {
  const activeHtml = activeComponents.length
    ? `<div class="table-responsive"><table class="data-table"><thead><tr>
        <th>Component Name</th><th>Brand</th><th>Model</th><th>Serial Number</th>
        <th>Date Installed</th><th>Condition</th><th>Status</th><th>Remarks</th>
      </tr></thead><tbody>
        ${activeComponents.map((c) => `<tr>
          <td>${displayCell(c.component_name)}</td>
          <td>${displayCell(c.brand)}</td>
          <td>${displayCell(c.model)}</td>
          <td>${displayCell(c.serial_number)}</td>
          <td>${formatDetailDate(c.date_installed)}</td>
          <td>${displayCell(c.condition)}</td>
          <td>${getStatusBadge(c.status || 'Active')}</td>
          <td>${displayCell(c.remarks)}</td>
        </tr>`).join('')}
      </tbody></table></div>`
    : '<p style="font-size:13px;color:#666;">No active components registered yet.</p>';

  const historyHtml = replacements.length
    ? `<div class="table-responsive"><table class="data-table"><thead><tr>
        <th>Previous Component</th><th>New Component</th><th>Replacement Date</th><th>Replaced By</th><th>Remarks</th>
      </tr></thead><tbody>
        ${replacements.map((c) => `<tr>
          <td>${displayCell(c.old_component_name)}</td>
          <td>${displayCell(c.new_component_name || c.new_item_name)}</td>
          <td>${formatDetailDate(c.replacement_date)}</td>
          <td>${displayCell(c.replaced_by_name)}</td>
          <td>${displayCell(c.notes)}</td>
        </tr>`).join('')}
      </tbody></table></div>`
    : '<p style="font-size:13px;color:#666;">No component replacement history yet.</p>';

  return `
    <h4 style="font-size:14px;margin:20px 0 8px;">Current Components</h4>
    ${activeHtml}
    <h4 style="font-size:14px;margin:16px 0 8px;">Replacement History</h4>
    ${historyHtml}
  `;
}

function renderAssetTimeline(events = []) {
  if (!events.length) {
    return renderEmptyHistory('No asset history recorded yet.');
  }

  return `<div class="table-responsive"><table class="data-table"><thead><tr>
    <th>Date</th><th>Action</th><th>Performed By</th><th>Reference</th><th>Property Tag</th><th>Department</th><th>Location</th>
  </tr></thead><tbody>
    ${events.map((event) => `<tr>
      <td>${formatDate(event.date)}</td>
      <td>${event.action || '—'}</td>
      <td>${event.performed_by || '—'}</td>
      <td>${event.reference_code || '—'}</td>
      <td>${event.property_tag || '—'}</td>
      <td>${event.department || '—'}</td>
      <td>${event.location || '—'}</td>
    </tr>`).join('')}
  </tbody></table></div>`;
}

async function viewAssetDetails(id) {
  try {
    const itemRes = await API.getInventoryItem(id);
    const item = itemRes?.data;
    if (!item) {
      showToast('Item not found', 'error');
      return;
    }

    const canLoadComponents = canManageInventory(currentUser) && canReplaceComponent(item.asset_classification);
    const [maintRes, transferRes, borrowRes, disposalRes, compRes, timelineRes] = await Promise.allSettled([
      API.getMaintenanceByAsset(id),
      API.getTransferHistory(id),
      API.getBorrowHistory(id),
      API.getDisposalsByAsset(id),
      canLoadComponents ? API.getComponents(id) : Promise.resolve({ data: { components: [], history: [] } }),
      API.getInventoryTimeline(id)
    ]);

    const maintenance = maintRes.status === 'fulfilled' ? (maintRes.value?.data || []) : [];
    const transfers = transferRes.status === 'fulfilled' ? (transferRes.value?.data || []) : [];
    const borrows = borrowRes.status === 'fulfilled' ? (borrowRes.value?.data || []) : [];
    const disposals = disposalRes.status === 'fulfilled' ? (disposalRes.value?.data || []) : [];
    const componentPayload = compRes.status === 'fulfilled' ? (compRes.value?.data || {}) : {};
    const activeComponents = Array.isArray(componentPayload.components) ? componentPayload.components : [];
    const replacements = Array.isArray(componentPayload.history) ? componentPayload.history : [];
    const timeline = timelineRes.status === 'fulfilled' ? (timelineRes.value?.data || []) : [];
    const documents = await fetchAssetDocuments(id, borrows, transfers, disposals);

    document.getElementById('assetDetailTitle').textContent = item.item_name;
    document.getElementById('assetDetailSummary').innerHTML = renderAssetDetailSummary(item);
    document.getElementById('assetDetailOverview').innerHTML = renderAssetDetailOverview(item, replacements, [], activeComponents);
    document.getElementById('assetDetailDocuments').innerHTML = renderAssetDocuments(documents);
    document.getElementById('assetDetailHistory').innerHTML = renderAssetTimeline(timeline);

    const upcoming = maintenance.filter(m => ['Pending', 'Approved', 'Scheduled', 'Ongoing', 'In Progress'].includes(m.status));
    const completed = maintenance.filter(m => m.status === 'Completed');

    document.getElementById('assetDetailMaintenance').innerHTML = `
      <h4 style="font-size:14px;margin-bottom:8px;">Upcoming / Current</h4>
      ${upcoming.length ? `<div class="table-responsive"><table class="data-table"><thead><tr><th>Code</th><th>Type</th><th>Priority</th><th>Scheduled</th><th>Status</th><th>Technician</th></tr></thead><tbody>
        ${upcoming.map(m => `<tr><td>${m.transaction_code || '-'}</td><td>${m.maintenance_type}</td><td>${m.priority || '-'}</td><td>${formatDate(m.scheduled_date)}</td><td>${getStatusBadge(m.status)}</td><td>${m.technician || m.service_provider || '-'}</td></tr>`).join('')}
      </tbody></table></div>` : renderEmptyHistory('No upcoming maintenance.')}
      <h4 style="font-size:14px;margin:16px 0 8px;">Previous Maintenance</h4>
      ${completed.length ? `<div class="table-responsive"><table class="data-table"><thead><tr><th>Code</th><th>Type</th><th>Completed</th><th>Technician</th><th>Remarks</th></tr></thead><tbody>
        ${completed.map(m => `<tr><td>${m.transaction_code || '-'}</td><td>${m.maintenance_type}</td><td>${formatDate(m.completed_date)}</td><td>${m.technician || m.service_provider || '-'}</td><td>${m.completion_remarks || m.description || '-'}</td></tr>`).join('')}
      </tbody></table></div>` : renderEmptyHistory('No maintenance history yet.')}
    `;

    document.getElementById('assetDetailTransfers').innerHTML = transfers.length
      ? `<div class="table-responsive"><table class="data-table"><thead><tr><th>Code</th><th>From Dept</th><th>To Dept</th><th>From Location</th><th>To Location</th><th>Date</th><th>Approved By</th></tr></thead><tbody>
        ${transfers.map(t => `<tr><td>${t.transaction_code}</td><td>${t.from_department_name || '-'}</td><td>${t.to_department_name || '-'}</td><td>${t.from_location_name || '-'}</td><td>${t.to_location_name || '-'}</td><td>${formatDate(t.transfer_date)}</td><td>${t.approved_by_name || '-'}</td></tr>`).join('')}
      </tbody></table></div>`
      : renderEmptyHistory('No transfer history yet.');

    document.getElementById('assetDetailBorrowHistory').innerHTML = borrows.length
      ? `<div class="table-responsive"><table class="data-table"><thead><tr><th>Code</th><th>Property Tag</th><th>Borrower</th><th>Department</th><th>Borrow Date</th><th>Expected Return</th><th>Status</th><th>Return Date</th><th>Condition</th></tr></thead><tbody>
        ${borrows.map(b => `<tr><td>${b.transaction_code}</td><td>${b.property_tag || item.property_tag || '-'}</td><td>${b.borrower_name || '-'}</td><td>${b.borrower_department || '-'}</td><td>${formatDate(b.borrow_date)}</td><td>${formatDate(b.expected_return_date)}</td><td>${getStatusBadge(b.status)}</td><td>${formatDate(b.return_date)}</td><td>${b.return_condition || '-'}</td></tr>`).join('')}
      </tbody></table></div>`
      : renderEmptyHistory('No borrow history yet.');

    document.getElementById('assetDetailDisposal').innerHTML = disposals.length
      ? `<div class="table-responsive"><table class="data-table"><thead><tr><th>Code</th><th>Property Tag</th><th>Reason</th><th>Method</th><th>Status</th><th>Requested By</th><th>Disposal Date</th></tr></thead><tbody>
        ${disposals.map(d => `<tr><td>${d.transaction_code}</td><td>${d.property_tag || item.property_tag || '-'}</td><td>${d.reason || '-'}</td><td>${d.disposal_method || '-'}</td><td>${getStatusBadge(d.status)}</td><td>${d.requested_by_name || '-'}</td><td>${formatDate(d.disposal_date)}</td></tr>`).join('')}
      </tbody></table></div>`
      : renderEmptyHistory('No disposal history yet.');

    switchAssetDetailTab('overview');
    finishTableRender(document.getElementById('assetDetailModal'));
    openModal('assetDetailModal');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function switchAssetDetailTab(tab) {
  const activeTab = ASSET_DETAIL_TABS.some((entry) => entry.key === tab) ? tab : 'overview';

  document.querySelectorAll('#assetDetailModal .nav-tab-custom').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.detailTab === activeTab);
  });

  ASSET_DETAIL_TABS.forEach((entry) => {
    const panel = document.getElementById(entry.panelId);
    if (panel) panel.style.display = entry.key === activeTab ? 'block' : 'none';
  });
}

let inventoryImportPreviewToken = null;
let inventoryImportPreviewData = null;

function resetInventoryImportModal() {
  inventoryImportPreviewToken = null;
  inventoryImportPreviewData = null;
  // Recover from a stuck Validate lock (e.g. hung prior request never released guardLocks).
  if (typeof clearGuardLock === 'function') {
    clearGuardLock('inventory-import-preview');
  }
  const fileInput = document.getElementById('inventoryImportFile');
  if (fileInput) fileInput.value = '';
  const uploadStep = document.getElementById('inventoryImportUploadStep');
  const previewStep = document.getElementById('inventoryImportPreviewStep');
  const resultStep = document.getElementById('inventoryImportResultStep');
  if (uploadStep) uploadStep.style.display = 'block';
  if (previewStep) previewStep.style.display = 'none';
  if (resultStep) resultStep.style.display = 'none';
  const footer = document.getElementById('inventoryImportFooter');
  if (footer) {
    footer.innerHTML = `
      <button type="button" class="btn-outline-custom" onclick="closeInventoryImportModal()">Cancel</button>
      <button type="button" class="btn-primary-custom" id="inventoryImportValidateBtn">
        <i class="bi bi-file-earmark-check"></i> Validate File
      </button>
    `;
    document.getElementById('inventoryImportValidateBtn')?.addEventListener('click', validateInventoryImportFile);
  }
}

function openInventoryImportModal() {
  if (!canManageInventory(currentUser)) {
    showToast('Administrator or Property Manager access required', 'error');
    return;
  }
  resetInventoryImportModal();
  openModal('inventoryImportModal');
}

function closeInventoryImportModal() {
  closeModal('inventoryImportModal');
  resetInventoryImportModal();
}

async function downloadInventoryImportTemplate() {
  if (!canManageInventory(currentUser)) {
    showToast('Administrator or Property Manager access required', 'error');
    return;
  }
  try {
    const blob = await API.downloadInventoryImportTemplate();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'inventory-import-template.xlsx';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Template downloaded');
  } catch (err) {
    showToast(err.message || 'Unable to download template', 'error');
  }
}

function renderInventoryImportPreview(data) {
  const summary = data.summary || {};
  const reasons = summary.reason_summary || [];
  const invalidRows = data.invalid_rows || [];

  document.getElementById('inventoryImportUploadStep').style.display = 'none';
  document.getElementById('inventoryImportResultStep').style.display = 'none';
  document.getElementById('inventoryImportPreviewStep').style.display = 'block';

  document.getElementById('inventoryImportSummary').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;">
      <div><strong>Total Records</strong><div>${summary.total_rows || 0}</div></div>
      <div><strong>Valid Records</strong><div>${summary.valid_records || 0}</div></div>
      <div><strong>Invalid Records</strong><div>${summary.invalid_records || 0}</div></div>
    </div>
  `;

  document.getElementById('inventoryImportReasons').innerHTML = reasons.length
    ? `<strong>Reasons</strong><ul style="margin:8px 0 0;padding-left:18px;">${reasons.map((r) => `<li>${r.reason} (${r.count})</li>`).join('')}</ul>`
    : '<p style="margin:0;color:var(--text-secondary);font-size:13px;">All rows passed validation.</p>';

  if (!(summary.valid_records > 0) && (summary.invalid_records > 0)) {
    document.getElementById('inventoryImportReasons').insertAdjacentHTML(
      'beforeend',
      `<p style="margin:10px 0 0;color:var(--danger);font-size:13px;">
        No valid rows to import. Fix the issues above (for Durable items, set a Custodian name or use Semi-Durable), then validate again.
      </p>`
    );
  }

  document.getElementById('inventoryImportInvalidTable').innerHTML = invalidRows.length
    ? `<table class="data-table"><thead><tr><th>Row</th><th>Item Name</th><th>Reasons</th></tr></thead><tbody>
        ${invalidRows.map((row) => `<tr><td>${row.row_number}</td><td>${row.item_name || '—'}</td><td>${(row.reasons || []).join('; ')}</td></tr>`).join('')}
      </tbody></table>`
    : '';

  const footer = document.getElementById('inventoryImportFooter');
  const canImport = (summary.valid_records || 0) > 0;
  footer.innerHTML = `
    <button type="button" class="btn-outline-custom" onclick="closeInventoryImportModal()">Cancel</button>
    <button type="button" class="btn-primary-custom" id="inventoryImportConfirmBtn" ${canImport ? '' : 'disabled'}>
      <i class="bi bi-cloud-upload"></i> Import Valid Records
    </button>
  `;
  document.getElementById('inventoryImportConfirmBtn')?.addEventListener('click', confirmInventoryImport);
}

function renderInventoryImportResult(data) {
  document.getElementById('inventoryImportUploadStep').style.display = 'none';
  document.getElementById('inventoryImportPreviewStep').style.display = 'none';
  document.getElementById('inventoryImportResultStep').style.display = 'block';

  const reasons = data.reason_summary || [];
  document.getElementById('inventoryImportResultSummary').innerHTML = `
    <h4 style="margin:0 0 12px;">Import Completed</h4>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:12px;">
      <div><strong>Total Rows</strong><div>${data.total_rows || 0}</div></div>
      <div><strong>Successfully Imported</strong><div>${data.successfully_imported || 0}</div></div>
      <div><strong>PAR Documents Generated</strong><div>${data.pars_generated || 0}</div></div>
      <div><strong>Skipped</strong><div>${data.skipped || 0}</div></div>
    </div>
    ${reasons.length
      ? `<strong>Reason Summary</strong><ul style="margin:8px 0 0;padding-left:18px;">${reasons.map((r) => `<li>${r.reason} (${r.count})</li>`).join('')}</ul>`
      : ''}
  `;

  document.getElementById('inventoryImportFooter').innerHTML = `
    <button type="button" class="btn-primary-custom" onclick="closeInventoryImportModal()">Done</button>
  `;
}

async function validateInventoryImportFile() {
  if (!canManageInventory(currentUser)) {
    showToast('Administrator or Property Manager access required', 'error');
    return;
  }

  const fileInput = document.getElementById('inventoryImportFile');
  const file = fileInput?.files?.[0];
  if (!file) {
    showToast('Please choose an Excel file first', 'error');
    return;
  }

  const name = String(file.name || '').toLowerCase();
  if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
    showToast('Only .xlsx or .xls files are allowed', 'error');
    return;
  }

  const button = document.getElementById('inventoryImportValidateBtn');
  // Use button guard (not lockKey Map) so Validate cannot stay permanently locked after a hung request.
  // Duplicate clicks while running are ignored by withSubmitGuard; button is restored in finally.
  await withSubmitGuard(button, async () => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), 120000)
      : null;
    try {
      const res = await API.previewInventoryImport(
        file,
        controller ? { signal: controller.signal } : {}
      );
      if (!res?.data) {
        showToast('Unable to validate file. Please try again.', 'error');
        return;
      }
      inventoryImportPreviewToken = res.data.preview_token;
      inventoryImportPreviewData = res.data;
      renderInventoryImportPreview(res.data);
    } catch (err) {
      const aborted = err?.name === 'AbortError'
        || (typeof err?.message === 'string' && /abort/i.test(err.message));
      showToast(
        aborted
          ? 'Validation timed out. Please try again.'
          : (err.message || 'Unable to validate file. Please try again.'),
        'error'
      );
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }, { loadingText: 'Validating...' });
}

async function confirmInventoryImport() {
  if (!canManageInventory(currentUser)) {
    showToast('Administrator or Property Manager access required', 'error');
    return;
  }
  if (!inventoryImportPreviewToken) {
    showToast('Please validate a file first', 'error');
    return;
  }

  await guardAsyncAction(async () => {
    const res = await API.confirmInventoryImport(inventoryImportPreviewToken);
    inventoryImportPreviewToken = null;
    renderInventoryImportResult(res.data || {});
    showToast(res.message || 'Import completed');
    await loadItems();
  }, { loadingText: 'Importing...', lockKey: 'inventory-import-confirm' });
}

let componentImportPreviewToken = null;
let componentImportPreviewData = null;

function resetComponentImportModal() {
  componentImportPreviewToken = null;
  componentImportPreviewData = null;
  if (typeof clearGuardLock === 'function') {
    clearGuardLock('component-import-preview');
  }
  const fileInput = document.getElementById('componentImportFile');
  if (fileInput) fileInput.value = '';
  const uploadStep = document.getElementById('componentImportUploadStep');
  const previewStep = document.getElementById('componentImportPreviewStep');
  const resultStep = document.getElementById('componentImportResultStep');
  if (uploadStep) uploadStep.style.display = 'block';
  if (previewStep) previewStep.style.display = 'none';
  if (resultStep) resultStep.style.display = 'none';
  const footer = document.getElementById('componentImportFooter');
  if (footer) {
    footer.innerHTML = `
      <button type="button" class="btn-outline-custom" onclick="closeComponentImportModal()">Cancel</button>
      <button type="button" class="btn-primary-custom" id="componentImportValidateBtn">
        <i class="bi bi-file-earmark-check"></i> Validate File
      </button>
    `;
    document.getElementById('componentImportValidateBtn')?.addEventListener('click', validateComponentImportFile);
  }
}

function openComponentImportModal() {
  if (!canManageInventory(currentUser)) {
    showToast('Administrator or Property Manager access required', 'error');
    return;
  }
  resetComponentImportModal();
  openModal('componentImportModal');
}

function closeComponentImportModal() {
  closeModal('componentImportModal');
  resetComponentImportModal();
}

async function downloadComponentImportTemplate() {
  if (!canManageInventory(currentUser)) {
    showToast('Administrator or Property Manager access required', 'error');
    return;
  }
  try {
    const blob = await API.downloadComponentImportTemplate();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'asset-components-import-template.xlsx';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Asset Components template downloaded');
  } catch (err) {
    showToast(err.message || 'Unable to download template', 'error');
  }
}

function renderComponentImportPreview(data) {
  const summary = data.summary || {};
  const reasons = summary.reason_summary || [];
  const invalidRows = data.invalid_rows || [];

  document.getElementById('componentImportUploadStep').style.display = 'none';
  document.getElementById('componentImportResultStep').style.display = 'none';
  document.getElementById('componentImportPreviewStep').style.display = 'block';

  document.getElementById('componentImportSummary').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;">
      <div><strong>Total Records</strong><div>${summary.total_rows || 0}</div></div>
      <div><strong>Valid Records</strong><div>${summary.valid_records || 0}</div></div>
      <div><strong>Invalid Records</strong><div>${summary.invalid_records || 0}</div></div>
    </div>
  `;

  document.getElementById('componentImportReasons').innerHTML = reasons.length
    ? `<strong>Reasons</strong><ul style="margin:8px 0 0;padding-left:18px;">${reasons.map((r) => `<li>${r.reason} (${r.count})</li>`).join('')}</ul>`
    : '<p style="margin:0;color:var(--text-secondary);font-size:13px;">All rows passed validation.</p>';

  if (!(summary.valid_records > 0) && (summary.invalid_records > 0)) {
    document.getElementById('componentImportReasons').insertAdjacentHTML(
      'beforeend',
      `<p style="margin:10px 0 0;color:var(--danger);font-size:13px;">
        No valid rows to import. Fix Property Tag / Component Type issues, then validate again.
      </p>`
    );
  }

  document.getElementById('componentImportInvalidTable').innerHTML = invalidRows.length
    ? `<table class="data-table"><thead><tr><th>Row</th><th>Property Tag</th><th>Reasons</th></tr></thead><tbody>
        ${invalidRows.map((row) => `<tr><td>${row.row_number}</td><td>${row.property_tag || '—'}</td><td>${(row.reasons || []).join('; ')}</td></tr>`).join('')}
      </tbody></table>`
    : '';

  const footer = document.getElementById('componentImportFooter');
  const canImport = (summary.valid_records || 0) > 0;
  footer.innerHTML = `
    <button type="button" class="btn-outline-custom" onclick="closeComponentImportModal()">Cancel</button>
    <button type="button" class="btn-primary-custom" id="componentImportConfirmBtn" ${canImport ? '' : 'disabled'}>
      <i class="bi bi-cloud-upload"></i> Import Valid Records
    </button>
  `;
  document.getElementById('componentImportConfirmBtn')?.addEventListener('click', confirmComponentImport);
}

function renderComponentImportResult(data) {
  document.getElementById('componentImportUploadStep').style.display = 'none';
  document.getElementById('componentImportPreviewStep').style.display = 'none';
  document.getElementById('componentImportResultStep').style.display = 'block';

  const reasons = data.reason_summary || [];
  const failures = data.import_failures || [];
  document.getElementById('componentImportResultSummary').innerHTML = `
    <h4 style="margin:0 0 12px;">Import Completed</h4>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:12px;">
      <div><strong>Total Rows</strong><div>${data.total_rows || 0}</div></div>
      <div><strong>Successfully Imported</strong><div>${data.successfully_imported || 0}</div></div>
      <div><strong>Skipped</strong><div>${data.skipped || 0}</div></div>
    </div>
    ${reasons.length
      ? `<strong>Reason Summary</strong><ul style="margin:8px 0 0;padding-left:18px;">${reasons.map((r) => `<li>${r.reason} (${r.count})</li>`).join('')}</ul>`
      : ''}
    ${failures.length
      ? `<div style="margin-top:12px;"><strong>Import Failures</strong>
          <div class="table-responsive" style="max-height:180px;overflow:auto;margin-top:8px;">
            <table class="data-table"><thead><tr><th>Row</th><th>Property Tag</th><th>Reason</th></tr></thead><tbody>
              ${failures.map((f) => `<tr><td>${f.row_number}</td><td>${f.property_tag || '—'}</td><td>${f.reason || '—'}</td></tr>`).join('')}
            </tbody></table>
          </div>
        </div>`
      : ''}
  `;

  document.getElementById('componentImportFooter').innerHTML = `
    <button type="button" class="btn-primary-custom" onclick="closeComponentImportModal()">Done</button>
  `;
}

async function validateComponentImportFile() {
  if (!canManageInventory(currentUser)) {
    showToast('Administrator or Property Manager access required', 'error');
    return;
  }

  const fileInput = document.getElementById('componentImportFile');
  const file = fileInput?.files?.[0];
  if (!file) {
    showToast('Please choose an Excel file first', 'error');
    return;
  }

  const name = String(file.name || '').toLowerCase();
  if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
    showToast('Only .xlsx or .xls files are allowed', 'error');
    return;
  }

  const button = document.getElementById('componentImportValidateBtn');
  await withSubmitGuard(button, async () => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), 120000)
      : null;
    try {
      const res = await API.previewComponentImport(
        file,
        controller ? { signal: controller.signal } : {}
      );
      if (!res?.data) {
        showToast('Unable to validate file. Please try again.', 'error');
        return;
      }
      componentImportPreviewToken = res.data.preview_token;
      componentImportPreviewData = res.data;
      renderComponentImportPreview(res.data);
    } catch (err) {
      const aborted = err?.name === 'AbortError'
        || (typeof err?.message === 'string' && /abort/i.test(err.message));
      showToast(
        aborted
          ? 'Validation timed out. Please try again.'
          : (err.message || 'Unable to validate file. Please try again.'),
        'error'
      );
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }, { loadingText: 'Validating...' });
}

async function confirmComponentImport() {
  if (!canManageInventory(currentUser)) {
    showToast('Administrator or Property Manager access required', 'error');
    return;
  }
  if (!componentImportPreviewToken) {
    showToast('Please validate a file first', 'error');
    return;
  }

  await guardAsyncAction(async () => {
    const res = await API.confirmComponentImport(componentImportPreviewToken);
    componentImportPreviewToken = null;
    renderComponentImportResult(res.data || {});
    showToast(res.message || 'Import completed');
  }, { loadingText: 'Importing...', lockKey: 'component-import-confirm' });
}

function closeToolbarDropdowns() {
  ['downloadToolbarMenu', 'importToolbarMenu'].forEach((id) => {
    document.getElementById(id)?.classList.remove('show');
  });
  ['downloadToolbarBtn', 'importToolbarBtn'].forEach((id) => {
    document.getElementById(id)?.setAttribute('aria-expanded', 'false');
  });
}

function toggleToolbarDropdown(menuId, buttonId) {
  const menu = document.getElementById(menuId);
  const button = document.getElementById(buttonId);
  if (!menu || !button) return;
  const willOpen = !menu.classList.contains('show');
  closeToolbarDropdowns();
  if (willOpen) {
    menu.classList.add('show');
    button.setAttribute('aria-expanded', 'true');
  }
}

async function downloadAssetWithComponentsTemplate() {
  if (!canManageInventory(currentUser)) {
    showToast('Administrator or Property Manager access required', 'error');
    return;
  }
  try {
    const blob = await API.downloadAssetWithComponentsTemplate();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'asset-with-components-import-template.xlsx';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Asset with Components template downloaded');
  } catch (err) {
    showToast(err.message || 'Unable to download template', 'error');
  }
}

let awcImportPreviewToken = null;

function resetAssetWithComponentsImportModal() {
  awcImportPreviewToken = null;
  if (typeof clearGuardLock === 'function') {
    clearGuardLock('awc-import-preview');
  }
  const fileInput = document.getElementById('awcImportFile');
  if (fileInput) fileInput.value = '';
  const uploadStep = document.getElementById('awcImportUploadStep');
  const previewStep = document.getElementById('awcImportPreviewStep');
  const resultStep = document.getElementById('awcImportResultStep');
  if (uploadStep) uploadStep.style.display = 'block';
  if (previewStep) previewStep.style.display = 'none';
  if (resultStep) resultStep.style.display = 'none';
  const footer = document.getElementById('awcImportFooter');
  if (footer) {
    footer.innerHTML = `
      <button type="button" class="btn-outline-custom" onclick="closeAssetWithComponentsImportModal()">Cancel</button>
      <button type="button" class="btn-primary-custom" id="awcImportValidateBtn">
        <i class="bi bi-file-earmark-check"></i> Validate File
      </button>
    `;
    document.getElementById('awcImportValidateBtn')?.addEventListener('click', validateAssetWithComponentsImportFile);
  }
}

function openAssetWithComponentsImportModal() {
  if (!canManageInventory(currentUser)) {
    showToast('Administrator or Property Manager access required', 'error');
    return;
  }
  resetAssetWithComponentsImportModal();
  openModal('awcImportModal');
}

function closeAssetWithComponentsImportModal() {
  closeModal('awcImportModal');
  resetAssetWithComponentsImportModal();
}

function renderAssetWithComponentsImportPreview(data) {
  const summary = data.summary || {};
  const reasons = summary.reason_summary || [];
  const invalidRows = data.invalid_rows || [];

  document.getElementById('awcImportUploadStep').style.display = 'none';
  document.getElementById('awcImportResultStep').style.display = 'none';
  document.getElementById('awcImportPreviewStep').style.display = 'block';

  document.getElementById('awcImportSummary').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;">
      <div><strong>Total Records</strong><div>${summary.total_rows || 0}</div></div>
      <div><strong>Valid Records</strong><div>${summary.valid_records || 0}</div></div>
      <div><strong>Invalid Records</strong><div>${summary.invalid_records || 0}</div></div>
      <div><strong>Components Planned</strong><div>${summary.components_planned || 0}</div></div>
    </div>
  `;

  document.getElementById('awcImportReasons').innerHTML = reasons.length
    ? `<strong>Reasons</strong><ul style="margin:8px 0 0;padding-left:18px;">${reasons.map((r) => `<li>${r.reason} (${r.count})</li>`).join('')}</ul>`
    : '<p style="margin:0;color:var(--text-secondary);font-size:13px;">All rows passed validation.</p>';

  document.getElementById('awcImportInvalidTable').innerHTML = invalidRows.length
    ? `<table class="data-table"><thead><tr><th>Row</th><th>Item Name</th><th>Reasons</th></tr></thead><tbody>
        ${invalidRows.map((row) => `<tr><td>${row.row_number}</td><td>${row.item_name || '—'}</td><td>${(row.reasons || []).join('; ')}</td></tr>`).join('')}
      </tbody></table>`
    : '';

  const footer = document.getElementById('awcImportFooter');
  const canImport = (summary.valid_records || 0) > 0;
  footer.innerHTML = `
    <button type="button" class="btn-outline-custom" onclick="closeAssetWithComponentsImportModal()">Cancel</button>
    <button type="button" class="btn-primary-custom" id="awcImportConfirmBtn" ${canImport ? '' : 'disabled'}>
      <i class="bi bi-cloud-upload"></i> Import Valid Records
    </button>
  `;
  document.getElementById('awcImportConfirmBtn')?.addEventListener('click', confirmAssetWithComponentsImport);
}

function renderAssetWithComponentsImportResult(data) {
  document.getElementById('awcImportUploadStep').style.display = 'none';
  document.getElementById('awcImportPreviewStep').style.display = 'none';
  document.getElementById('awcImportResultStep').style.display = 'block';

  const reasons = data.reason_summary || [];
  const failures = data.import_failures || [];
  document.getElementById('awcImportResultSummary').innerHTML = `
    <h4 style="margin:0 0 12px;">Import Completed</h4>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:12px;">
      <div><strong>Total Rows</strong><div>${data.total_rows || 0}</div></div>
      <div><strong>Assets Imported</strong><div>${data.successfully_imported || 0}</div></div>
      <div><strong>Components Imported</strong><div>${data.components_imported || 0}</div></div>
      <div><strong>PAR Documents Generated</strong><div>${data.pars_generated || 0}</div></div>
      <div><strong>Skipped</strong><div>${data.skipped || 0}</div></div>
    </div>
    ${reasons.length
      ? `<strong>Reason Summary</strong><ul style="margin:8px 0 0;padding-left:18px;">${reasons.map((r) => `<li>${r.reason} (${r.count})</li>`).join('')}</ul>`
      : ''}
    ${failures.length
      ? `<div style="margin-top:12px;"><strong>Import Failures</strong>
          <div class="table-responsive" style="max-height:180px;overflow:auto;margin-top:8px;">
            <table class="data-table"><thead><tr><th>Row</th><th>Item</th><th>Reason</th></tr></thead><tbody>
              ${failures.map((f) => `<tr><td>${f.row_number}</td><td>${f.item_name || '—'}</td><td>${f.reason || '—'}</td></tr>`).join('')}
            </tbody></table>
          </div>
        </div>`
      : ''}
  `;

  document.getElementById('awcImportFooter').innerHTML = `
    <button type="button" class="btn-primary-custom" onclick="closeAssetWithComponentsImportModal()">Done</button>
  `;
}

async function validateAssetWithComponentsImportFile() {
  if (!canManageInventory(currentUser)) {
    showToast('Administrator or Property Manager access required', 'error');
    return;
  }

  const fileInput = document.getElementById('awcImportFile');
  const file = fileInput?.files?.[0];
  if (!file) {
    showToast('Please choose an Excel file first', 'error');
    return;
  }

  const name = String(file.name || '').toLowerCase();
  if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
    showToast('Only .xlsx or .xls files are allowed', 'error');
    return;
  }

  const button = document.getElementById('awcImportValidateBtn');
  await withSubmitGuard(button, async () => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), 120000)
      : null;
    try {
      const res = await API.previewAssetWithComponentsImport(
        file,
        controller ? { signal: controller.signal } : {}
      );
      if (!res?.data) {
        showToast('Unable to validate file. Please try again.', 'error');
        return;
      }
      awcImportPreviewToken = res.data.preview_token;
      renderAssetWithComponentsImportPreview(res.data);
    } catch (err) {
      const aborted = err?.name === 'AbortError'
        || (typeof err?.message === 'string' && /abort/i.test(err.message));
      showToast(
        aborted
          ? 'Validation timed out. Please try again.'
          : (err.message || 'Unable to validate file. Please try again.'),
        'error'
      );
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }, { loadingText: 'Validating...' });
}

async function confirmAssetWithComponentsImport() {
  if (!canManageInventory(currentUser)) {
    showToast('Administrator or Property Manager access required', 'error');
    return;
  }
  if (!awcImportPreviewToken) {
    showToast('Please validate a file first', 'error');
    return;
  }

  await guardAsyncAction(async () => {
    const res = await API.confirmAssetWithComponentsImport(awcImportPreviewToken);
    awcImportPreviewToken = null;
    renderAssetWithComponentsImportResult(res.data || {});
    showToast(res.message || 'Import completed');
    await loadItems();
  }, { loadingText: 'Importing...', lockKey: 'awc-import-confirm' });
}

document.addEventListener('DOMContentLoaded', initInventoryPage);
