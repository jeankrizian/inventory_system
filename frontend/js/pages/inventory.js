let categories = [], suppliers = [], locations = [], items = [], users = [];
let currentUser = null;
let inventoryActionsListenersBound = false;
let inventoryTableSelection = null;

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
  });
  document.querySelectorAll('.inventory-actions-overflow[aria-expanded="true"]').forEach(btn => {
    btn.setAttribute('aria-expanded', 'false');
  });
}

function showBorrowInInventoryMenu(classification) {
  return canBorrowAsset(classification);
}

function getInventoryDocumentOptions(item, classification) {
  const options = [{ type: 'GRN', module: 'inventory', label: 'View GRN', icon: 'bi-file-earmark-text' }];
  if (isFixedAssetClassification(classification) && item.custodian_id) {
    options.push({ type: 'PAR', module: 'inventory', label: 'View PAR', icon: 'bi-file-earmark-check' });
  }
  if (normalizeAssetClassification(classification) === 'Semi-Durable' && item.department_id) {
    options.push({ type: 'SAL', module: 'inventory', label: 'View SAL', icon: 'bi-journal-check' });
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
  await openDocumentForTransaction(docType, module, itemId);
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

  submenu.classList.add('is-fixed');
  const triggerRect = trigger.getBoundingClientRect();
  const submenuWidth = submenu.offsetWidth || 180;
  const submenuHeight = submenu.offsetHeight || 120;
  const margin = 8;

  let left = triggerRect.right + 4;
  let flipLeft = false;
  if (left + submenuWidth > window.innerWidth - margin) {
    left = triggerRect.left - submenuWidth - 4;
    flipLeft = true;
  }
  left = Math.max(margin, Math.min(left, window.innerWidth - submenuWidth - margin));

  let top = triggerRect.top;
  if (top + submenuHeight > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - submenuHeight - margin);
  }

  submenu.classList.toggle('flip-left', flipLeft);
  submenu.style.left = `${left}px`;
  submenu.style.top = `${top}px`;
}

function toggleInventoryDocumentsSubmenu(itemId, event) {
  event.preventDefault();
  event.stopPropagation();

  const wrap = document.getElementById(`inventory-actions-${itemId}`);
  const submenu = wrap?.querySelector('.inventory-actions-submenu');
  if (!submenu) return;

  const wasOpen = submenu.classList.contains('show');
  if (wasOpen) {
    submenu.classList.remove('show', 'flip-left', 'is-fixed');
    submenu.style.top = '';
    submenu.style.left = '';
    return;
  }

  requestAnimationFrame(() => {
    submenu.classList.add('show');
    positionInventoryDocumentsSubmenu(wrap);
  });
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

  document.addEventListener('click', (event) => {
    if (event.target.closest('.inventory-actions-wrap')) return;
    closeAllInventoryActionsMenus();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllInventoryActionsMenus();
  });
  window.addEventListener('resize', closeAllInventoryActionsMenus);
  document.getElementById('inventoryTable')?.addEventListener('scroll', closeAllInventoryActionsMenus, true);
}

function renderInventoryActionsCell(item, classification, permissions) {
  const id = item.id;
  const isDisposed = item.status === 'Disposed';
  const canBorrowType = showBorrowInInventoryMenu(classification);
  const itemBorrowable = isItemAvailableForBorrow(item);
  const showBorrow = permissions.canSubmitBorrow && canBorrowType && itemBorrowable;
  const showBorrowUnavailable = permissions.canSubmitBorrow && canBorrowType && !itemBorrowable && !isDisposed;
  const showTransfer = permissions.canSubmitTransfer && item.status === 'Available' && canTransferAsset(classification);
  const showMaintain = permissions.canSubmitMaintenance && !isDisposed && canMaintainAsset(classification);
  const showReplace = permissions.canManageInventory && !isDisposed && canReplaceComponent(classification);
  const showDispose = permissions.canSubmitDisposal && !isDisposed;
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
      { label: 'Acquisition Date', getValue: (row) => formatDetailDate(row.acquisition_date || row.purchase_date) }
    ]
  );
  showToast(`Exported ${rows.length} item(s)`);
}

async function initInventoryPage() {
  currentUser = await initLayout('inventory');
  if (!currentUser) return;

  const permissions = getInventoryPermissions(currentUser);

  document.getElementById('pageContent').innerHTML = `
    <div class="page-header">
      <h1>Inventory Management</h1>
      <p>Manage school inventory items, stock levels, and item details</p>
    </div>
    <div class="content-card">
      <div class="content-card-header">
        <h3>All Items</h3>
        ${permissions.canManageInventory ? `<button type="button" class="btn-primary-custom" id="addItemBtn"><i class="bi bi-plus-lg"></i> Add Item</button>` : ''}
      </div>
      <div class="filters-bar">
        <input type="text" class="form-control-custom" id="searchInput" placeholder="Search items...">
        <select class="form-control-custom" id="filterCategory"><option value="">All Departments</option></select>
        <select class="form-control-custom" id="filterClassification">
          <option value="">All Classifications</option>
        </select>
        <select class="form-control-custom" id="filterStatus">
          <option value="">All Status</option>
          <option>Available</option><option>Borrowed</option>
          <option>Under Maintenance</option><option>Disposed</option>
        </select>
      </div>
      <div class="table-responsive" id="inventoryTable">
        <div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div>
      </div>
    </div>
  `;

  document.getElementById('addItemBtn')?.addEventListener('click', openAddModal);

  await loadDropdowns();
  populateClassificationFilter();
  initItemFormSearchableSelects();
  initSearchableSelects(document.getElementById('pageContent'));
  initInventoryTableSelection(permissions);
  await loadItems();
  bindInventoryActionsListeners();

  document.getElementById('searchInput').addEventListener('input', debounce(loadItems, 300));
  document.getElementById('filterCategory').addEventListener('change', loadItems);
  document.getElementById('filterClassification').addEventListener('change', loadItems);
  document.getElementById('filterStatus').addEventListener('change', loadItems);
  document.getElementById('itemClassification').addEventListener('change', applyClassificationFormState);
  document.getElementById('itemQuantity').addEventListener('input', syncCreatePreviewDisplay);
  document.getElementById('itemCategory').addEventListener('change', updateItemCodePreview);
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

async function loadItems() {
  const params = {};
  const search = document.getElementById('searchInput')?.value;
  const category = document.getElementById('filterCategory')?.value;
  const classification = document.getElementById('filterClassification')?.value;
  const status = document.getElementById('filterStatus')?.value;

  if (search) params.search = search;
  if (category) params.category_id = category;
  if (classification) params.asset_classification = classification;
  if (status) params.status = status;

  try {
    const res = await API.getInventory(params);
    items = res?.data || [];
    renderTable();
    closeAllInventoryActionsMenus();
  } catch (err) {
    showToast(err.message, 'error');
  }
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
    <table class="data-table">
      <thead>
        <tr>
          ${inventoryTableSelection?.renderCheckboxHeader() || ''}
          <th>Item Code</th>
          <th>Property Tag</th>
          <th>Item Name</th>
          <th>Department</th>
          <th>Location</th>
          <th>Condition</th>
          <th>Status</th>
          <th>Acquisition Date</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr${inventoryTableSelection?.renderRowAttrs(item) || ''}>
            ${inventoryTableSelection?.renderCheckboxCell(item) || ''}
            <td>${displayCell(item.item_code)}</td>
            <td>${displayCell(item.property_tag)}</td>
            <td>${displayCell(item.item_name)}</td>
            <td>${displayCell(item.department_name || item.category_name)}</td>
            <td>${displayCell(item.location_name)}</td>
            <td>${displayCell(item.condition)}</td>
            <td>${getStatusBadge(item.status)}</td>
            <td>${displayCell(formatDetailDate(item.acquisition_date || item.purchase_date))}</td>
            <td class="inventory-actions-td">${renderInventoryActionsCell(item, formatClassificationDisplay(item.asset_classification), permissions)}</td>
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

  const propertyTagInfo = document.getElementById('autoPropertyTagInfo');
  const custodianRow = document.getElementById('custodianRow');
  const maintenanceRow = document.getElementById('maintenanceRow');
  const serviceProviderRow = document.getElementById('serviceProviderRow');
  const isEdit = Boolean(document.getElementById('itemId')?.value);

  if (propertyTagInfo) propertyTagInfo.style.display = (isEdit || isConsumable) ? 'none' : '';
  if (custodianRow) custodianRow.style.display = isFixed ? '' : 'none';
  if (maintenanceRow) maintenanceRow.style.display = isFixed ? '' : 'none';
  if (serviceProviderRow) serviceProviderRow.style.display = isFixed ? '' : 'none';

  if (isConsumable) {
    document.getElementById('itemCustodian').value = '';
    document.getElementById('itemMaintenanceSchedule').value = '';
    document.getElementById('itemNextMaintenance').value = '';
    document.getElementById('itemServiceProvider').value = '';
  } else if (!isFixed) {
    document.getElementById('itemCustodian').value = '';
    document.getElementById('itemMaintenanceSchedule').value = '';
    document.getElementById('itemNextMaintenance').value = '';
    document.getElementById('itemServiceProvider').value = '';
  }
}

function setItemCodeFieldState(isEdit) {
  const itemCodeInput = document.getElementById('itemCode');
  if (!itemCodeInput) return;

  itemCodeInput.readOnly = true;
  if (!isEdit) {
    itemCodeInput.value = '';
    itemCodeInput.placeholder = 'Auto-generated from category';
  }
}

async function updateItemCodePreview() {
  const itemId = document.getElementById('itemId').value;
  if (itemId) return;

  const departmentId = document.getElementById('itemCategory').value;
  const itemCodeInput = document.getElementById('itemCode');
  if (!itemCodeInput) return;

  if (!departmentId) {
    itemCodeInput.value = '';
    itemCodeInput.placeholder = 'Auto-generated from category';
    return;
  }

  try {
    const res = await API.getNextItemCode(departmentId);
    itemCodeInput.value = res?.data?.item_code || '';
    itemCodeInput.placeholder = '';
  } catch (err) {
    itemCodeInput.value = '';
    itemCodeInput.placeholder = 'Unable to preview item code';
    showToast(err.message || 'Unable to preview item code', 'error');
  }
}

function setAssetFormMode(isEdit) {
  const assetCountRow = document.getElementById('assetCountRow');
  const editPropertyTagRow = document.getElementById('editPropertyTagRow');
  const editBatchIdRow = document.getElementById('editBatchIdRow');
  const editSerialNumberRow = document.getElementById('editSerialNumberRow');
  const autoPropertyTagInfo = document.getElementById('autoPropertyTagInfo');
  const quantityInput = document.getElementById('itemQuantity');

  if (assetCountRow) assetCountRow.style.display = isEdit ? 'none' : '';
  if (editPropertyTagRow) editPropertyTagRow.style.display = isEdit ? '' : 'none';
  if (editBatchIdRow) editBatchIdRow.style.display = isEdit ? '' : 'none';
  if (editSerialNumberRow) editSerialNumberRow.style.display = isEdit ? '' : 'none';
  if (autoPropertyTagInfo) autoPropertyTagInfo.style.display = isEdit ? 'none' : '';
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
    previewEl.value = 'Each asset = one inventory record; one batch ID per save';
    return;
  }

  previewEl.value = qty === 1
    ? '1 asset record (new batch ID on save)'
    : `${qty} asset records (shared batch ID on save)`;
}

function openAddModal() {
  document.getElementById('itemModalTitle').textContent = 'Add Item';
  document.getElementById('itemForm').reset();
  document.getElementById('itemId').value = '';
  document.getElementById('itemQuantity').value = '1';
  document.getElementById('itemStatus').value = 'Auto-computed';
  const previewEl = document.getElementById('itemCreatePreview');
  if (previewEl) previewEl.value = '1 asset record';
  setAssetFormMode(false);
  syncClassificationOptions('');
  setItemCodeFieldState(false);
  applyClassificationFormState();
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
    document.getElementById('itemCode').value = item.item_code;
    setItemCodeFieldState(true);
    document.getElementById('itemName').value = item.item_name;
    document.getElementById('itemDescription').value = item.description || '';
    document.getElementById('itemCategory').value = item.department_id || item.category_id;
    document.getElementById('itemSupplier').value = item.supplier_id || '';
    document.getElementById('itemBrand').value = item.brand || '';
    document.getElementById('itemModel').value = item.model || '';
    document.getElementById('itemEditPropertyTag').value = item.property_tag || '';
    document.getElementById('itemEditBatchId').value = item.batch_id || '';
    document.getElementById('itemEditSerialNumber').value = item.serial_number || '';
    setAssetFormMode(true);
    document.getElementById('itemLocation').value = item.location_id || '';
    document.getElementById('itemPurchaseDate').value = item.purchase_date ? item.purchase_date.split('T')[0] : '';
    document.getElementById('itemPR').value = item.purchase_request_number || '';
    document.getElementById('itemPO').value = item.purchase_order_number || '';
    document.getElementById('itemInvoice').value = item.invoice_number || '';
    const acquisitionDate = item.acquisition_date || item.purchase_date;
    document.getElementById('itemAcquisitionDate').value = acquisitionDate ? String(acquisitionDate).split('T')[0] : '';
    document.getElementById('itemUnitCost').value = item.unit_cost != null ? item.unit_cost : '';
    document.getElementById('itemCondition').value = item.condition;
    document.getElementById('itemStatus').value = item.status || 'Auto-computed';
    syncClassificationOptions(item.asset_classification);
    document.getElementById('itemMaterial').value = item.material || '';
    document.getElementById('itemCustodian').value = item.custodian_id || '';
    document.getElementById('itemMaintenanceSchedule').value = item.maintenance_schedule || '';
    document.getElementById('itemNextMaintenance').value = item.next_maintenance_date ? item.next_maintenance_date.split('T')[0] : '';
    document.getElementById('itemServiceProvider').value = item.service_provider || '';
    applyClassificationFormState();
    syncItemFormSearchableSelects();
    openModal('itemModal');
  } catch (err) {
    showToast(err.message, 'error');
  }
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
    purchase_date: document.getElementById('itemPurchaseDate').value || null,
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
    showToast('Assigned custodian is required for Non-Consumable (Fixed Asset) items', 'error');
    return;
  }

  try {
    if (id) {
      const res = await API.updateInventoryItem(id, data);
      showToast('Item updated successfully');
      if (res?.data?.custodian_par) {
        openGeneratedDocument(res.data.custodian_par, 'PAR');
      }
      if (res?.data?.semi_durable_sal) {
        openGeneratedDocument(res.data.semi_durable_sal, 'SAL');
      }
    } else {
      const res = await API.createInventoryItem(data);
      const createdCount = res?.data?.created_count || 1;
      showToast(res?.message || (createdCount > 1 ? `${createdCount} assets created successfully` : 'Item created successfully'));
      openGeneratedDocument(res?.data?.generated_document, 'GRN');
      if (res?.data?.custodian_par) {
        openGeneratedDocument(res.data.custodian_par, 'PAR');
      }
      if (res?.data?.semi_durable_sal) {
        openGeneratedDocument(res.data.semi_durable_sal, 'SAL');
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
    openGeneratedDocument(res?.data?.generated_document, 'RDF');
    closeModal('disposalModal');
  } catch (err) { showToast(err.message, 'error'); }
}

function openMaintenanceModal(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  if (!canMaintainAsset(item.asset_classification)) {
    showToast('Maintenance is only available for Non-Consumable (Fixed Asset) items', 'error');
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

function getReplacementPartOptions(parentId) {
  return items.filter(i =>
    i.id !== parentId &&
    i.status !== 'Disposed' &&
    !isFixedAssetClassification(i.asset_classification) &&
    !i.parent_asset_id
  );
}

function populateReplacementPartSelect(parentId) {
  const select = document.getElementById('componentNewItem');
  if (!select) return;
  const parts = getReplacementPartOptions(parentId);
  select.innerHTML = '<option value="">Manual entry / not in stock</option>';
  parts.forEach(part => {
    const opt = document.createElement('option');
    opt.value = part.id;
    opt.textContent = `${part.item_name} (${part.item_code})`;
    select.appendChild(opt);
  });
  if (typeof refreshSearchableSelects === 'function') {
    refreshSearchableSelects(select);
  }
}

function openComponentModal(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  if (!canReplaceComponent(item.asset_classification)) {
    showToast('Component replacement is only available for Non-Consumable (Fixed Asset) items', 'error');
    return;
  }
  document.getElementById('componentParentId').value = id;
  document.getElementById('componentParentName').value = item.item_name || '';
  document.getElementById('componentPropertyTag').value = item.property_tag || '-';
  document.getElementById('componentOldName').value = '';
  document.getElementById('componentNewName').value = '';
  document.getElementById('componentNotes').value = '';
  document.getElementById('componentDate').value = new Date().toISOString().split('T')[0];
  populateReplacementPartSelect(id);
  openModal('componentModal');
}

async function submitComponent(e) {
  e.preventDefault();
  const parentId = parseInt(document.getElementById('componentParentId').value, 10);
  const oldName = document.getElementById('componentOldName').value.trim();
  const replacementDate = document.getElementById('componentDate').value;
  const newItemId = document.getElementById('componentNewItem').value;
  const newName = document.getElementById('componentNewName').value.trim();

  if (!oldName) {
    showToast('Old component name is required', 'error');
    return;
  }
  if (!replacementDate) {
    showToast('Replacement date is required', 'error');
    return;
  }
  if (!newItemId && !newName) {
    showToast('Select a replacement part from inventory or enter a new component name', 'error');
    return;
  }

  try {
    await API.createComponentReplacement({
      parent_asset_id: parentId,
      old_component_name: oldName,
      new_inventory_item_id: newItemId ? parseInt(newItemId, 10) : null,
      new_component_name: newName || null,
      replacement_date: replacementDate,
      notes: document.getElementById('componentNotes').value.trim() || null
    });
    showToast('Component replacement recorded');
    closeModal('componentModal');
    await loadItems();
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
  const category = item.department_name || item.category_name;
  return `
    <div class="asset-detail-summary" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;padding:14px 16px;background:var(--gray-light,#f5f5f5);border-radius:8px;border:1px solid var(--border-color,#e5e5e5);">
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted,#666);margin-bottom:4px;">Property Tag</div>
        <div style="font-weight:600;font-size:15px;">${displayDetailValue(item.property_tag)}</div>
      </div>
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted,#666);margin-bottom:4px;">Batch ID</div>
        <div style="font-weight:500;">${displayDetailValue(item.batch_id)}</div>
      </div>
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted,#666);margin-bottom:4px;">Serial Number</div>
        <div style="font-weight:500;">${displayDetailValue(item.serial_number)}</div>
      </div>
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted,#666);margin-bottom:4px;">Status</div>
        <div>${getStatusBadge(item.status)}</div>
      </div>
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted,#666);margin-bottom:4px;">Department</div>
        <div style="font-weight:500;">${displayDetailValue(category)}</div>
      </div>
    </div>
  `;
}

const ASSET_DETAIL_TABS = [
  { key: 'general', panelId: 'assetDetailGeneral' },
  { key: 'inventory', panelId: 'assetDetailInventory' },
  { key: 'purchase', panelId: 'assetDetailPurchase' },
  { key: 'assignment', panelId: 'assetDetailAssignment' },
  { key: 'documents', panelId: 'assetDetailDocuments' },
  { key: 'history', panelId: 'assetDetailHistory' },
  { key: 'maintenance', panelId: 'assetDetailMaintenance' },
  { key: 'transfers', panelId: 'assetDetailTransfers' },
  { key: 'borrows', panelId: 'assetDetailBorrowHistory' },
  { key: 'disposals', panelId: 'assetDetailDisposal' }
];

const ASSET_INVENTORY_DOCUMENT_TYPES = ['PAR', 'GRN', 'SAL'];

function renderAssetDetailGeneral(item) {
  return `
    ${renderDetailSection('General Information', [
      { label: 'Item Code (Model)', value: item.item_code },
      { label: 'Item Name', value: item.item_name },
      { label: 'Classification', value: formatClassificationDisplay(item.asset_classification) },
      { label: 'Department', value: item.department_name || item.category_name }
    ])}
    ${renderDetailSection('Description', [
      { label: 'Description', value: item.description, fullWidth: true, wrap: true }
    ])}
  `;
}

function renderAssetDetailInventory(item, replacements = [], linkedParts = []) {
  const componentsHtml = canReplaceComponent(item.asset_classification)
    ? renderComponentHistory(replacements, linkedParts)
    : renderEmptyHistory('Component tracking is available for Non-Consumable (Fixed Asset) items only.');

  return `
    ${renderDetailSection('Inventory Details', [
      { label: 'Property Tag', value: item.property_tag },
      { label: 'Batch ID', value: item.batch_id },
      { label: 'Serial Number', value: item.serial_number },
      { label: 'Material', value: item.material },
      { label: 'Condition', value: item.condition },
      { label: 'Status', html: getStatusBadge(item.status) }
    ])}
    ${componentsHtml}
  `;
}

function renderAssetDetailPurchase(item) {
  return renderDetailSection('Purchase Information', [
    { label: 'Supplier', value: item.supplier_name },
    { label: 'Brand', value: item.brand },
    { label: 'Model', value: item.model },
    { label: 'Purchase Date', value: formatDetailDate(item.purchase_date) },
    { label: 'Acquisition Date', value: formatDetailDate(item.acquisition_date || item.purchase_date) },
    { label: 'Purchase Request (PR)', value: item.purchase_request_number },
    { label: 'Purchase Order (PO)', value: item.purchase_order_number },
    { label: 'Invoice Number', value: item.invoice_number },
    { label: 'Unit Cost', value: formatDetailCurrency(item.unit_cost) }
  ]);
}

function renderAssetDetailAssignment(item) {
  return renderDetailSection('Assignment & Maintenance', [
    { label: 'Department', value: item.department_name || item.category_name },
    { label: 'Location', value: item.location_name },
    { label: 'Assigned Custodian', value: item.custodian_name },
    { label: 'Maintenance Schedule', value: item.maintenance_schedule },
    { label: 'Next Maintenance Date', value: formatDetailDate(item.next_maintenance_date) },
    { label: 'Service Provider', value: item.service_provider }
  ]);
}

const ASSET_WORKFLOW_DOCUMENT_TYPES = [
  { type: 'ABL', module: 'borrow', recordsKey: 'borrows' },
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

function renderComponentHistory(replacements, linkedParts) {
  const historyHtml = replacements.length
    ? `<div class="table-responsive"><table class="data-table"><thead><tr><th>Date</th><th>Old Component</th><th>New Component</th><th>Replaced By</th><th>Notes</th></tr></thead><tbody>
        ${replacements.map(c => `<tr>
          <td>${formatDate(c.replacement_date)}</td>
          <td>${c.old_component_name}</td>
          <td>${c.new_item_name || c.new_component_name || '-'}</td>
          <td>${c.replaced_by_name || '-'}</td>
          <td>${c.notes || '-'}</td>
        </tr>`).join('')}
      </tbody></table></div>`
    : '<p style="font-size:13px;color:#666;">No component replacement history yet.</p>';

  const linkedHtml = linkedParts.length
    ? `<h4 style="font-size:14px;margin:16px 0 8px;">Installed Parts (Linked Inventory)</h4>
      <div class="table-responsive"><table class="data-table"><thead><tr><th>Code</th><th>Part Name</th><th>Classification</th><th>Status</th></tr></thead><tbody>
        ${linkedParts.map(p => `<tr>
          <td>${p.item_code}</td>
          <td>${p.item_name}</td>
          <td>${formatClassificationDisplay(p.asset_classification)}</td>
          <td>${getStatusBadge(p.status)}</td>
        </tr>`).join('')}
      </tbody></table></div>`
    : '';

  return `<h4 style="font-size:14px;margin-bottom:8px;">Replacement History</h4>${historyHtml}${linkedHtml}`;
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

    const [maintRes, transferRes, borrowRes, disposalRes, compRes, partsRes, timelineRes] = await Promise.allSettled([
      API.getMaintenanceByAsset(id),
      API.getTransferHistory(id),
      API.getBorrowHistory(id),
      API.getDisposalsByAsset(id),
      API.getComponents(id),
      API.getInventory({ parent_asset_id: id }),
      API.getInventoryTimeline(id)
    ]);

    const maintenance = maintRes.status === 'fulfilled' ? (maintRes.value?.data || []) : [];
    const transfers = transferRes.status === 'fulfilled' ? (transferRes.value?.data || []) : [];
    const borrows = borrowRes.status === 'fulfilled' ? (borrowRes.value?.data || []) : [];
    const disposals = disposalRes.status === 'fulfilled' ? (disposalRes.value?.data || []) : [];
    const replacements = compRes.status === 'fulfilled' ? (compRes.value?.data || []) : [];
    const linkedParts = partsRes.status === 'fulfilled' ? (partsRes.value?.data || []) : [];
    const timeline = timelineRes.status === 'fulfilled' ? (timelineRes.value?.data || []) : [];
    const documents = await fetchAssetDocuments(id, borrows, transfers, disposals);

    document.getElementById('assetDetailTitle').textContent = item.item_name;
    document.getElementById('assetDetailSummary').innerHTML = renderAssetDetailSummary(item);
    document.getElementById('assetDetailGeneral').innerHTML = renderAssetDetailGeneral(item);
    document.getElementById('assetDetailInventory').innerHTML = renderAssetDetailInventory(item, replacements, linkedParts);
    document.getElementById('assetDetailPurchase').innerHTML = renderAssetDetailPurchase(item);
    document.getElementById('assetDetailAssignment').innerHTML = renderAssetDetailAssignment(item);
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

    switchAssetDetailTab('general');
    finishTableRender(document.getElementById('assetDetailModal'));
    openModal('assetDetailModal');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function switchAssetDetailTab(tab) {
  const activeTab = ASSET_DETAIL_TABS.some((entry) => entry.key === tab) ? tab : 'general';

  document.querySelectorAll('#assetDetailModal .nav-tab-custom').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.detailTab === activeTab);
  });

  ASSET_DETAIL_TABS.forEach((entry) => {
    const panel = document.getElementById(entry.panelId);
    if (panel) panel.style.display = entry.key === activeTab ? 'block' : 'none';
  });
}

document.addEventListener('DOMContentLoaded', initInventoryPage);
