let categories = [], suppliers = [], locations = [], items = [], users = [];
let currentUser = null;
let inventoryActionsListenersBound = false;

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

function showInventoryDocumentsSubmenu(itemId) {
  const wrap = document.getElementById(`inventory-actions-${itemId}`);
  const submenu = wrap?.querySelector('.inventory-actions-submenu');
  if (!submenu) return;
  submenu.classList.add('show');
  positionInventoryDocumentsSubmenu(wrap);
}

function hideInventoryDocumentsSubmenu(itemId, event) {
  const wrap = document.getElementById(`inventory-actions-${itemId}`);
  const submenu = wrap?.querySelector('.inventory-actions-submenu');
  if (!submenu) return;
  const related = event?.relatedTarget;
  if (related && (submenu.contains(related) || wrap?.contains(related))) return;
  submenu.classList.remove('show', 'flip-left');
  submenu.style.top = '';
  submenu.style.left = '';
}

function toggleInventoryDocumentsSubmenu(itemId, event) {
  event.preventDefault();
  event.stopPropagation();

  const wrap = document.getElementById(`inventory-actions-${itemId}`);
  const submenu = wrap?.querySelector('.inventory-actions-submenu');
  if (!submenu) return;

  const wasOpen = submenu.classList.contains('show');
  wrap.querySelectorAll('.inventory-actions-submenu').forEach(el => {
    el.classList.remove('show', 'flip-left');
    el.style.top = '';
    el.style.left = '';
  });
  if (wasOpen) return;

  submenu.classList.add('show');
  positionInventoryDocumentsSubmenu(wrap);
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

  menu.classList.add('show');
  trigger.setAttribute('aria-expanded', 'true');
  positionInventoryActionsMenu(wrap);
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

  document.addEventListener('click', closeAllInventoryActionsMenus);
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
  const showTransfer = permissions.canSubmitTransfer && !isDisposed && canTransferAsset(classification);
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
      <div class="inventory-actions-submenu-wrap"
        onmouseenter="showInventoryDocumentsSubmenu(${id})"
        onmouseleave="hideInventoryDocumentsSubmenu(${id}, event)">
        <button type="button" class="inventory-actions-submenu-trigger" role="menuitem"
          onclick="toggleInventoryDocumentsSubmenu(${id}, event)">
          <span class="inventory-actions-submenu-label"><i class="bi bi-folder2-open"></i> Documents</span>
          <i class="bi bi-chevron-right inventory-actions-submenu-caret"></i>
        </button>
        <div class="inventory-actions-submenu" role="menu" onclick="event.stopPropagation()"
          onmouseenter="showInventoryDocumentsSubmenu(${id})"
          onmouseleave="hideInventoryDocumentsSubmenu(${id}, event)">
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
        ${permissions.canManageInventory ? `<button class="btn-primary-custom" onclick="openAddModal()"><i class="bi bi-plus-lg"></i> Add Item</button>` : ''}
      </div>
      <div class="filters-bar">
        <input type="text" class="form-control-custom" id="searchInput" placeholder="Search items...">
        <select class="form-control-custom" id="filterCategory"><option value="">All Departments</option></select>
        <select class="form-control-custom" id="filterClassification">
          <option value="">All Classifications</option>
        </select>
        <select class="form-control-custom" id="filterStatus">
          <option value="">All Status</option>
          <option>Available</option><option>Borrowed</option><option>Low Stock</option><option>Out of Stock</option>
          <option>Under Maintenance</option><option>Disposed</option>
        </select>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;">
          <input type="checkbox" id="filterLowStock"> Low Stock Only
        </label>
      </div>
      <div class="table-responsive" id="inventoryTable">
        <div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div>
      </div>
    </div>
  `;

  await loadDropdowns();
  populateClassificationFilter();
  initItemFormSearchableSelects();
  await loadItems();
  bindInventoryActionsListeners();

  document.getElementById('searchInput').addEventListener('input', debounce(loadItems, 300));
  document.getElementById('filterCategory').addEventListener('change', loadItems);
  document.getElementById('filterClassification').addEventListener('change', loadItems);
  document.getElementById('filterStatus').addEventListener('change', loadItems);
  document.getElementById('filterLowStock').addEventListener('change', loadItems);
  document.getElementById('itemClassification').addEventListener('change', applyClassificationFormState);
  document.getElementById('itemQuantity').addEventListener('input', updateAcquisitionCost);
  document.getElementById('itemUnitCost').addEventListener('input', updateAcquisitionCost);
  document.getElementById('itemCategory').addEventListener('change', updateItemCodePreview);
  document.getElementById('itemForm').addEventListener('submit', saveItem);
  document.getElementById('transferForm')?.addEventListener('submit', submitTransfer);
  document.getElementById('disposalForm')?.addEventListener('submit', submitDisposal);
  document.getElementById('maintenanceForm')?.addEventListener('submit', submitMaintenance);
  document.getElementById('componentForm')?.addEventListener('submit', submitComponent);

  const params = new URLSearchParams(window.location.search);
  if (params.get('low_stock') === 'true') {
    document.getElementById('filterLowStock').checked = true;
    loadItems();
  }
}

function populateClassificationFilter() {
  const select = document.getElementById('filterClassification');
  if (!select) return;
  const options = getFilterClassifications();
  select.innerHTML = '<option value="">All Classifications</option>'
    + options.map((option) => `<option>${option}</option>`).join('');
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
  const lowStock = document.getElementById('filterLowStock')?.checked;

  if (search) params.search = search;
  if (category) params.category_id = category;
  if (classification) params.asset_classification = classification;
  if (status) params.status = status;
  if (lowStock) params.low_stock = 'true';

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

  if (!items.length) {
    el.innerHTML = '<div class="empty-state"><i class="bi bi-box"></i>No inventory items found.</div>';
    return;
  }

  el.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Item Code</th><th>Item Name</th><th>Department</th><th>Classification</th>
          <th>Qty</th><th>Available</th><th>Location</th><th>Status</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => {
          const classification = formatClassificationDisplay(item.asset_classification);
          return `
          <tr>
            <td>${item.item_code}</td>
            <td>${item.item_name}</td>
            <td>${item.department_name || item.category_name || '-'}</td>
            <td>${classification}</td>
            <td>${item.quantity}</td>
            <td>${item.available_quantity}</td>
            <td>${item.location_name || '-'}</td>
            <td>${getStatusBadge(item.status)}</td>
            <td class="inventory-actions-td">${renderInventoryActionsCell(item, classification, permissions)}</td>
          </tr>
        `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function updateAcquisitionCost() {
  const qty = parseInt(document.getElementById('itemQuantity')?.value, 10);
  const unitCost = parseFloat(document.getElementById('itemUnitCost')?.value);
  const acquisitionEl = document.getElementById('itemAcquisitionCost');
  if (!acquisitionEl || Number.isNaN(qty) || Number.isNaN(unitCost)) return;
  acquisitionEl.value = (qty * unitCost).toFixed(2);
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

  const propertyTagGroup = document.getElementById('propertyTagGroup');
  const custodianRow = document.getElementById('custodianRow');
  const maintenanceRow = document.getElementById('maintenanceRow');
  const serviceProviderRow = document.getElementById('serviceProviderRow');

  if (propertyTagGroup) propertyTagGroup.style.display = isConsumable ? 'none' : '';
  if (custodianRow) custodianRow.style.display = isFixed ? '' : 'none';
  if (maintenanceRow) maintenanceRow.style.display = isFixed ? '' : 'none';
  if (serviceProviderRow) serviceProviderRow.style.display = isFixed ? '' : 'none';

  if (isConsumable) {
    document.getElementById('itemPropertyTag').value = '';
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

function openAddModal() {
  document.getElementById('itemModalTitle').textContent = 'Add Item';
  document.getElementById('itemForm').reset();
  document.getElementById('itemId').value = '';
  document.getElementById('itemUnit').value = 'pcs';
  document.getElementById('itemThreshold').value = '5';
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
    document.getElementById('itemQuantity').value = item.quantity;
    document.getElementById('itemAvailable').value = item.available_quantity;
    document.getElementById('itemUnit').value = item.unit;
    document.getElementById('itemLocation').value = item.location_id || '';
    document.getElementById('itemPurchaseDate').value = item.purchase_date ? item.purchase_date.split('T')[0] : '';
    document.getElementById('itemPR').value = item.purchase_request_number || '';
    document.getElementById('itemPO').value = item.purchase_order_number || '';
    document.getElementById('itemInvoice').value = item.invoice_number || '';
    document.getElementById('itemAcquisitionDate').value = item.acquisition_date ? item.acquisition_date.split('T')[0] : '';
    document.getElementById('itemUnitCost').value = item.unit_cost != null ? item.unit_cost : '';
    document.getElementById('itemAcquisitionCost').value = item.acquisition_cost != null ? item.acquisition_cost : '';
    document.getElementById('itemCondition').value = item.condition;
    document.getElementById('itemThreshold').value = item.low_stock_threshold;
    document.getElementById('itemStatus').value = item.status;
    syncClassificationOptions(item.asset_classification);
    document.getElementById('itemMaterial').value = item.material || '';
    document.getElementById('itemPropertyTag').value = item.property_tag || '';
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
  const data = {
    item_name: document.getElementById('itemName').value,
    description: document.getElementById('itemDescription').value.trim() || null,
    department_id: parseInt(document.getElementById('itemCategory').value),
    category_id: parseInt(document.getElementById('itemCategory').value),
    supplier_id: document.getElementById('itemSupplier').value ? parseInt(document.getElementById('itemSupplier').value) : null,
    brand: document.getElementById('itemBrand').value,
    model: document.getElementById('itemModel').value,
    quantity: parseInt(document.getElementById('itemQuantity').value),
    available_quantity: parseInt(document.getElementById('itemAvailable').value) || parseInt(document.getElementById('itemQuantity').value),
    unit: document.getElementById('itemUnit').value,
    location_id: document.getElementById('itemLocation').value ? parseInt(document.getElementById('itemLocation').value) : null,
    purchase_date: document.getElementById('itemPurchaseDate').value || null,
    acquisition_date: document.getElementById('itemAcquisitionDate').value || null,
    purchase_request_number: document.getElementById('itemPR').value.trim() || null,
    purchase_order_number: document.getElementById('itemPO').value.trim() || null,
    invoice_number: document.getElementById('itemInvoice').value.trim() || null,
    unit_cost: document.getElementById('itemUnitCost').value !== '' ? document.getElementById('itemUnitCost').value : null,
    acquisition_cost: document.getElementById('itemAcquisitionCost').value !== '' ? document.getElementById('itemAcquisitionCost').value : null,
    condition: document.getElementById('itemCondition').value,
    low_stock_threshold: parseInt(document.getElementById('itemThreshold').value),
    status: document.getElementById('itemStatus').value,
    asset_classification: document.getElementById('itemClassification').value,
    material: document.getElementById('itemMaterial').value || null,
    property_tag: normalizePropertyTag(document.getElementById('itemPropertyTag').value),
    custodian_id: document.getElementById('itemCustodian').value ? parseInt(document.getElementById('itemCustodian').value) : null,
    maintenance_schedule: document.getElementById('itemMaintenanceSchedule').value || null,
    next_maintenance_date: document.getElementById('itemNextMaintenance').value || null,
    service_provider: document.getElementById('itemServiceProvider').value || null
  };
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

  if (isFixedAssetClassification(classification) && !data.property_tag) {
    showToast('Property tag is required for Non-Consumable (Fixed Asset) items', 'error');
    return;
  }

  if (data.property_tag && !isValidPropertyTagFormat(data.property_tag)) {
    showToast('Property tag format is invalid. Use values like 2025-0001 or 2025/0001.', 'error');
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
      showToast('Item created successfully');
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
  if (!confirmAction('Archive this item? It will remain in the Archive for 30 days before being permanently deleted.')) return;
  try {
    const res = await API.archiveInventoryItem(id);
    showToast(res?.message || 'The record has been archived successfully. It will remain in the Archive for 30 days before being permanently deleted.');
    loadItems();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openTransferModal(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  if (!canTransferAsset(item.asset_classification)) {
    showToast('This item cannot be transferred', 'error');
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
  document.getElementById('disposalQuantity').value = '1';
  document.getElementById('disposalQuantity').max = item?.available_quantity || 1;
  document.getElementById('disposalReason').value = '';
  openModal('disposalModal');
}

async function submitDisposal(e) {
  e.preventDefault();
  try {
    const res = await API.createDisposal({
      inventory_item_id: parseInt(document.getElementById('disposalItemId').value),
      quantity: parseInt(document.getElementById('disposalQuantity').value),
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

async function viewAssetDetails(id) {
  try {
    const [itemRes, maintRes, transferRes, compRes, partsRes] = await Promise.all([
      API.getInventoryItem(id),
      API.getMaintenanceByAsset(id),
      API.getTransferHistory(id),
      API.getComponents(id),
      API.getInventory({ parent_asset_id: id })
    ]);
    const item = itemRes.data;
    const maintenance = maintRes?.data || [];
    const transfers = transferRes?.data || [];
    const replacements = compRes?.data || [];
    const linkedParts = partsRes?.data || [];

    document.getElementById('assetDetailTitle').textContent = `${item.item_name} (${item.item_code})`;
    document.getElementById('assetDetailInfo').innerHTML = `
      <div class="form-group"><label>Description</label><div>${item.description || '-'}</div></div>
      <div class="form-row">
        <div class="form-group"><label>Material</label><div>${item.material || '-'}</div></div>
        <div class="form-group"><label>Property Tag</label><div>${item.property_tag || '-'}</div></div>
        <div class="form-group"><label>Department</label><div>${item.department_name || '-'}</div></div>
        <div class="form-group"><label>Location</label><div>${item.location_name || '-'}</div></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Status</label><div>${getStatusBadge(item.status)}</div></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Next Maintenance</label><div>${formatDate(item.next_maintenance_date)}</div></div>
        <div class="form-group"><label>Maintenance Status</label><div>${item.maintenance_status || '-'}</div></div>
        <div class="form-group"><label>Technician / Provider</label><div>${item.service_provider || '-'}</div></div>
      </div>
    `;

    const upcoming = maintenance.filter(m => ['Pending', 'Approved', 'Scheduled', 'Ongoing', 'In Progress'].includes(m.status));
    const completed = maintenance.filter(m => m.status === 'Completed');

    document.getElementById('assetDetailMaintenance').innerHTML = `
      <h4 style="font-size:14px;margin-bottom:8px;">Upcoming / Current</h4>
      ${upcoming.length ? `<div class="table-responsive"><table class="data-table"><thead><tr><th>Code</th><th>Type</th><th>Priority</th><th>Scheduled</th><th>Status</th><th>Technician</th></tr></thead><tbody>
        ${upcoming.map(m => `<tr><td>${m.transaction_code || '-'}</td><td>${m.maintenance_type}</td><td>${m.priority || '-'}</td><td>${formatDate(m.scheduled_date)}</td><td>${getStatusBadge(m.status)}</td><td>${m.technician || m.service_provider || '-'}</td></tr>`).join('')}
      </tbody></table></div>` : '<p style="font-size:13px;color:#666;">No upcoming maintenance.</p>'}
      <h4 style="font-size:14px;margin:16px 0 8px;">Previous Maintenance</h4>
      ${completed.length ? `<div class="table-responsive"><table class="data-table"><thead><tr><th>Code</th><th>Type</th><th>Completed</th><th>Technician</th><th>Remarks</th></tr></thead><tbody>
        ${completed.map(m => `<tr><td>${m.transaction_code || '-'}</td><td>${m.maintenance_type}</td><td>${formatDate(m.completed_date)}</td><td>${m.technician || m.service_provider || '-'}</td><td>${m.completion_remarks || m.description || '-'}</td></tr>`).join('')}
      </tbody></table></div>` : '<p style="font-size:13px;color:#666;">No maintenance history yet.</p>'}
    `;

    document.getElementById('assetDetailTransfers').innerHTML = transfers.length
      ? `<div class="table-responsive"><table class="data-table"><thead><tr><th>Code</th><th>From Dept</th><th>To Dept</th><th>From Location</th><th>To Location</th><th>Date</th><th>Approved By</th></tr></thead><tbody>
        ${transfers.map(t => `<tr><td>${t.transaction_code}</td><td>${t.from_department_name || '-'}</td><td>${t.to_department_name || '-'}</td><td>${t.from_location_name || '-'}</td><td>${t.to_location_name || '-'}</td><td>${formatDate(t.transfer_date)}</td><td>${t.approved_by_name || '-'}</td></tr>`).join('')}
      </tbody></table></div>`
      : '<p style="font-size:13px;color:#666;">No transfer history yet.</p>';

    document.getElementById('assetDetailComponents').innerHTML = canReplaceComponent(item.asset_classification)
      ? renderComponentHistory(replacements, linkedParts)
      : '<p style="font-size:13px;color:#666;">Component tracking is available for Non-Consumable (Fixed Asset) items only.</p>';

    switchAssetDetailTab('maintenance');
    openModal('assetDetailModal');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function switchAssetDetailTab(tab) {
  document.querySelectorAll('#assetDetailModal .nav-tab-custom').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.detailTab === tab);
  });
  document.getElementById('assetDetailMaintenance').style.display = tab === 'maintenance' ? 'block' : 'none';
  document.getElementById('assetDetailTransfers').style.display = tab === 'transfers' ? 'block' : 'none';
  document.getElementById('assetDetailComponents').style.display = tab === 'components' ? 'block' : 'none';
}

document.addEventListener('DOMContentLoaded', initInventoryPage);
