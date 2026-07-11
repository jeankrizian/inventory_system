let currentUser = null;
let inventoryItems = [];
let borrows = [];
let returns = [];
let activeTab = 'borrow';
let pendingBorrowPayload = null;

async function initOrdersPage() {
  currentUser = await initLayout('orders');
  if (!currentUser) return;

  const params = new URLSearchParams(window.location.search);
  if (params.get('tab') === 'returns') activeTab = 'returns';

  const showBorrowBtn = canSubmitBorrow(currentUser);
  const showReturnTab = canViewReturnHistory(currentUser);
  document.getElementById('pageContent').innerHTML = `
    <div class="page-header">
      <h1>Borrow Requests</h1>
      <p>Create, review, approve, and process borrow requests.</p>
    </div>
    <div class="content-card">
      <div class="content-card-header">
        <div class="nav-tabs-custom" style="border:none;margin:0;">
          <button class="nav-tab-custom ${activeTab === 'borrow' ? 'active' : ''}" data-tab="borrow">Borrow Transactions</button>
          ${showReturnTab ? `<button class="nav-tab-custom ${activeTab === 'returns' ? 'active' : ''}" data-tab="returns">Process Return History</button>` : ''}
        </div>
        ${showBorrowBtn ? `<button type="button" class="btn-primary-custom" id="borrowItemBtn"><i class="bi bi-plus-lg"></i> Borrow Item</button>` : ''}
      </div>
      <div class="filters-bar" id="borrowFilters">
        <input type="text" class="form-control-custom" id="searchInput" placeholder="Search transactions...">
        <select class="form-control-custom" id="filterStatus">
          <option value="">All Status</option>
          <option>Pending</option><option>Approved</option><option>Borrowed</option>
          <option>Returned</option><option>Rejected</option><option>Overdue</option>
        </select>
      </div>
      <div class="table-responsive" id="ordersContent"><div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div></div>
    </div>
  `;

  document.getElementById('borrowItemBtn')?.addEventListener('click', openBorrowModal);

  document.querySelectorAll('.nav-tab-custom').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll('.nav-tab-custom').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('borrowFilters').style.display = activeTab === 'borrow' ? 'flex' : 'none';
      loadData();
    });
  });

  document.getElementById('searchInput')?.addEventListener('input', debounce(loadBorrows, 300));
  document.getElementById('filterStatus')?.addEventListener('change', loadBorrows);
  bindGuardedFormSubmit(document.getElementById('borrowForm'), submitBorrow, { loadingText: 'Submitting...' });
  bindGuardedFormSubmit(document.getElementById('returnForm'), submitReturn, { loadingText: 'Processing...' });
  document.getElementById('borrowConfirmSubmitBtn')?.addEventListener('click', (e) => {
    guardClick(e, confirmBorrowSubmission, 'Submitting...');
  });
  initActionMenus();
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.borrow-item-combobox')) closeBorrowItemDropdowns();
  });

  if (showBorrowBtn) {
    const invRes = await API.getBorrowableItems();
    inventoryItems = (invRes?.data || []).filter((i) => canBorrowAsset(i.asset_classification));
  }

  if (!showReturnTab && activeTab === 'returns') activeTab = 'borrow';

  const statusFilter = params.get('status');
  if (statusFilter && document.getElementById('filterStatus')) {
    document.getElementById('filterStatus').value = statusFilter;
  }

  await loadData();

  const deepLinkId = params.get('id');
  if (deepLinkId) viewBorrow(parseInt(deepLinkId, 10));

  initSearchableSelects(document.getElementById('pageContent'));
}

async function loadData() {
  if (activeTab === 'borrow') await loadBorrows();
  else await loadReturns();
}

async function loadBorrows() {
  const params = {};
  const search = document.getElementById('searchInput')?.value;
  const status = document.getElementById('filterStatus')?.value;
  if (search) params.search = search;
  if (status) params.status = status;

  try {
    const res = await API.getBorrows(params);
    borrows = res?.data || [];
    renderBorrows();
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadReturns() {
  try {
    const res = await API.getReturns();
    returns = res?.data || [];
    renderReturns();
  } catch (err) { showToast(err.message, 'error'); }
}

function formatPurpose(value, maxLength = 60) {
  const text = (value || '').trim();
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function renderBorrowActions(b) {
  const canReturn = canProcessReturn(currentUser);
  const canApprove = canApproveBorrow(currentUser);
  const code = (b.transaction_code || '').replace(/'/g, "\\'");
  const borrower = (b.borrower_name || '').replace(/'/g, "\\'");

  const items = [
    { label: 'View Details', icon: 'bi-eye', handler: `viewBorrow(${b.id})` }
  ];

  if (['Borrowed', 'Approved', 'Overdue'].includes(b.status) && canReturn) {
    items.push({
      label: 'Process Return',
      icon: 'bi-arrow-return-left',
      handler: `openReturnModal(${b.id}, '${code}', '${borrower}')`
    });
  }

  if (['Borrowed', 'Approved', 'Overdue', 'Returned'].includes(b.status)) {
    items.push({
      label: 'View ABL',
      icon: 'bi-journal-text',
      handler: `openBorrowDocument(${b.id})`
    });
  }

  if (b.status === 'Pending' && canApprove) {
    items.push({
      label: 'Review in Pending Approvals',
      icon: 'bi-clipboard-check',
      href: '/pages/pending-approvals.html?tab=borrow'
    });
  }

  return renderActionMenuCell(`borrow-actions-${b.id}`, items);
}

function renderBorrows() {
  const el = document.getElementById('ordersContent');

  if (!borrows.length) {
    el.innerHTML = '<div class="empty-state"><i class="bi bi-cart3"></i>No borrow requests found.</div>';
    return;
  }

  el.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Code</th><th>Borrower</th><th>Department</th><th>Purpose</th><th>Borrow Date</th><th>Expected Return</th><th>Status</th><th>Actions</th></tr>
      </thead>
      <tbody>
        ${borrows.map(b => `
          <tr>
            <td>${b.transaction_code}</td>
            <td>${b.borrower_name}</td>
            <td>${b.borrower_department || '-'}</td>
            <td title="${(b.purpose || '').replace(/"/g, '&quot;')}">${formatPurpose(b.purpose)}</td>
            <td>${formatDate(b.borrow_date)}</td>
            <td>${formatDate(b.expected_return_date)}</td>
            <td>${getStatusBadge(b.status)}</td>
            <td>${renderBorrowActions(b)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  finishTableRender(el);
}

function renderReturns() {
  const el = document.getElementById('ordersContent');
  if (!returns.length) {
    el.innerHTML = '<div class="empty-state"><i class="bi bi-arrow-return-left"></i>No process return transactions</div>';
    return;
  }
  el.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Code</th><th>Borrow Code</th><th>Processed By</th><th>Process Return Date</th><th>Condition</th><th>Notes</th></tr></thead>
      <tbody>
        ${returns.map(r => `
          <tr>
            <td>${r.transaction_code}</td>
            <td>${r.borrow_code}</td>
            <td>${r.returned_by_name}</td>
            <td>${formatDate(r.return_date)}</td>
            <td>${getStatusBadge(r.condition)}</td>
            <td>${r.notes || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  finishTableRender(el);
}

function getBorrowItemLabel(item) {
  return item.item_name;
}

function updateBorrowItemAvailable(row, item) {
  const el = row?.querySelector('.borrow-item-available');
  if (!el) return;
  if (!item) {
    el.textContent = 'Available: —';
    return;
  }
  if (item.is_borrowable === false) {
    el.textContent = `Available: 0 (${item.unavailable_reason || 'Unavailable'})`;
    return;
  }
  const count = item.available_count ?? item.available_quantity ?? 0;
  el.textContent = `Available: ${count}`;
}

function filterBorrowItems(term) {
  const t = term.trim().toLowerCase();
  if (!t) return inventoryItems;
  return inventoryItems.filter(i =>
    i.item_name.toLowerCase().includes(t) || String(i.item_code || '').toLowerCase().includes(t)
  );
}

function borrowItemRowHtml(withRemove = false) {
  return `
    <div class="form-group" style="flex:2"><label>Item</label>
      <div class="borrow-item-combobox">
        <input type="text" class="form-control-custom borrow-item-select" placeholder="Select item..." autocomplete="off" required>
        <input type="hidden" class="borrow-item-code">
        <div class="borrow-item-dropdown"></div>
      </div>
      <div class="borrow-item-available" style="font-size:12px;color:#666;margin-top:4px;">Available: —</div>
    </div>
    <div class="form-group"><label>Quantity</label><input type="number" class="form-control-custom borrow-item-qty" value="1" min="1" required></div>
    ${withRemove ? `<div class="form-group" style="display:flex;align-items:flex-end;"><button type="button" class="btn-icon danger" onclick="this.closest('.borrow-item-row').remove()" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></div>` : ''}
  `;
}

function closeBorrowItemDropdowns(except) {
  document.querySelectorAll('.borrow-item-dropdown.show').forEach(dropdown => {
    if (!except || !except.contains(dropdown)) dropdown.classList.remove('show');
  });
}

function renderBorrowItemDropdown(dropdown, items, onSelect) {
  if (!items.length) {
    dropdown.innerHTML = '<div class="borrow-item-option borrow-item-empty">No items found</div>';
    return;
  }
  dropdown.innerHTML = items.map(item => `
    <div class="borrow-item-option ${item.is_borrowable === false ? 'borrow-item-unavailable' : ''}" data-code="${item.item_code}" data-borrowable="${item.is_borrowable !== false}">
      ${item.item_name}
      <small>${item.is_borrowable === false ? (item.unavailable_reason || 'Unavailable') : `${item.available_count ?? item.available_quantity ?? 0} available`}</small>
    </div>
  `).join('');
  dropdown.querySelectorAll('.borrow-item-option:not(.borrow-item-empty)').forEach(opt => {
    opt.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (opt.dataset.borrowable === 'false') return;
      const item = items.find(i => i.item_code === opt.dataset.code);
      if (item) onSelect(item);
    });
  });
}

function initBorrowItemCombobox(combobox) {
  if (combobox.dataset.initialized) return;
  combobox.dataset.initialized = '1';

  const row = combobox.closest('.borrow-item-row');
  const input = combobox.querySelector('.borrow-item-select');
  const hidden = combobox.querySelector('.borrow-item-code');
  const dropdown = combobox.querySelector('.borrow-item-dropdown');

  function showDropdown() {
    closeBorrowItemDropdowns(combobox);
    const items = filterBorrowItems(input.value);
    renderBorrowItemDropdown(dropdown, items, (item) => {
      input.value = getBorrowItemLabel(item);
      hidden.value = item.item_code;
      dropdown.classList.remove('show');
      updateBorrowItemAvailable(row, item);
    });
    dropdown.classList.add('show');
  }

  input.addEventListener('focus', showDropdown);
  input.addEventListener('click', showDropdown);
  input.addEventListener('input', () => {
    hidden.value = '';
    updateBorrowItemAvailable(row, null);
    showDropdown();
  });
}

function initBorrowItemComboboxes() {
  document.querySelectorAll('.borrow-item-combobox').forEach(initBorrowItemCombobox);
}

function openBorrowModal() {
  document.getElementById('borrowForm').reset();
  document.getElementById('borrowDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('borrowerName').value = currentUser.full_name || '';
  document.getElementById('borrowItemsList').innerHTML = `
    <div class="form-row borrow-item-row">${borrowItemRowHtml()}</div>
  `;
  initBorrowItemComboboxes();
  refreshSearchableSelects(document.getElementById('borrowModal'));
  openModal('borrowModal');
}

function addBorrowItemRow() {
  const row = document.createElement('div');
  row.className = 'form-row borrow-item-row';
  row.innerHTML = borrowItemRowHtml(true);
  document.getElementById('borrowItemsList').appendChild(row);
  initBorrowItemComboboxes();
}

function collectBorrowItems() {
  const items = [];
  for (const row of document.querySelectorAll('.borrow-item-row')) {
    const itemCode = row.querySelector('.borrow-item-code')?.value;
    const qty = parseInt(row.querySelector('.borrow-item-qty')?.value, 10);
    if (!itemCode || !qty) continue;

    const selected = inventoryItems.find((item) => String(item.item_code) === String(itemCode));
    if (selected && selected.is_borrowable === false) {
      throw new Error(`${selected.item_name} is unavailable for borrowing`);
    }

    if (selected && qty > (selected.available_count ?? 0)) {
      throw new Error(`Only ${selected.available_count} ${selected.item_name} asset(s) are available.`);
    }

    items.push({ item_code: itemCode, quantity: qty });
  }
  return items;
}

function buildBorrowPayload() {
  const purpose = document.getElementById('borrowPurpose').value.trim();
  if (!purpose) throw new Error('Purpose is required');

  const items = collectBorrowItems();
  if (!items.length) throw new Error('Please select at least one item from the list');

  return {
    purpose,
    borrow_date: document.getElementById('borrowDate').value,
    expected_return_date: document.getElementById('expectedReturn').value || null,
    items
  };
}

function groupBorrowItemsForDisplay(items = []) {
  const groups = new Map();
  for (const item of items) {
    const key = item.item_code || item.item_name;
    if (!groups.has(key)) {
      groups.set(key, { item_name: item.item_name, quantity: 0, assets: [] });
    }
    const group = groups.get(key);
    group.quantity += Number(item.quantity) || 1;
    if (item.property_tag) group.assets.push(item.property_tag);
  }
  return [...groups.values()];
}

function renderBorrowConfirmItems(payload) {
  const el = document.getElementById('borrowConfirmTags');
  if (!el) return;

  const grouped = groupBorrowItemsForDisplay(
    (payload.items || []).map((line) => {
      const selected = inventoryItems.find((item) => String(item.item_code) === String(line.item_code));
      return {
        item_code: line.item_code,
        item_name: selected?.item_name || line.item_code,
        quantity: line.quantity
      };
    })
  );

  if (!grouped.length) {
    el.innerHTML = '<p style="margin:0;color:#666;">No items selected.</p>';
    return;
  }

  el.innerHTML = grouped.map((item) => `
    <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #e5e7eb;">
      <strong>${item.item_name}</strong><br>
      <span style="color:#666;">Quantity: ${item.quantity}</span>
    </div>
  `).join('');
}

function renderBorrowDetailBody(borrow) {
  const grouped = groupBorrowItemsForDisplay(borrow.items || []);
  const showAssets = borrow.show_assigned_assets || ['Borrowed', 'Approved', 'Returned', 'Overdue'].includes(borrow.status);

  const itemsHtml = grouped.map((item) => {
    const assetsBlock = showAssets && item.assets.length
      ? `<div style="margin-top:8px;">
          <div style="font-weight:500;margin-bottom:4px;">Assigned Assets</div>
          <ul style="margin:0;padding-left:18px;list-style:none;">
            ${item.assets.map((tag) => `<li style="margin-bottom:2px;">✓ ${tag}</li>`).join('')}
          </ul>
        </div>`
      : '';

    return `
      <div style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e5e7eb;">
        <div style="font-weight:600;">${item.item_name}</div>
        <div style="color:#666;margin-top:4px;">Quantity: ${item.quantity}</div>
        ${assetsBlock}
      </div>
    `;
  }).join('');

  return `
    <p><strong>Transaction:</strong> ${borrow.transaction_code}</p>
    <p><strong>Borrower:</strong> ${borrow.borrower_name}</p>
    <p><strong>Department:</strong> ${borrow.borrower_department || '—'}</p>
    <p><strong>Purpose:</strong> ${borrow.purpose || '—'}</p>
    <p><strong>Status:</strong> ${getStatusBadge(borrow.status)}</p>
    <p><strong>Borrow Date:</strong> ${formatDate(borrow.borrow_date)}</p>
    <p><strong>Expected Return:</strong> ${formatDate(borrow.expected_return_date)}</p>
    <hr style="margin:16px 0;">
    <h4 style="font-size:14px;margin-bottom:12px;">Items Borrowed</h4>
    ${itemsHtml || '<p style="color:#666;">No items listed.</p>'}
  `;
}

async function submitBorrow(e) {
  e.preventDefault();
  try {
    const payload = buildBorrowPayload();
    pendingBorrowPayload = payload;
    renderBorrowConfirmItems(payload);
    openModal('borrowConfirmModal');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function confirmBorrowSubmission() {
  if (!pendingBorrowPayload) return;
  try {
    await API.createBorrow(pendingBorrowPayload);
    showToast('Borrow request submitted');
    pendingBorrowPayload = null;
    closeModal('borrowConfirmModal');
    closeModal('borrowModal');
    loadBorrows();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openReturnModal(id, code, borrower) {
  document.getElementById('returnBorrowId').value = id;
  document.getElementById('returnBorrowInfo').textContent = `Process Return for ${code} — ${borrower}`;
  document.getElementById('returnDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('returnForm').reset();
  document.getElementById('returnBorrowId').value = id;
  refreshSearchableSelects(document.getElementById('returnModal'));
  openModal('returnModal');
}

async function submitReturn(e) {
  e.preventDefault();
  const id = document.getElementById('returnBorrowId').value;
  try {
    await API.returnBorrow(id, {
      return_date: document.getElementById('returnDate').value,
      condition: document.getElementById('returnCondition').value,
      notes: document.getElementById('returnNotes').value
    });
    showToast('Process Return completed successfully');
    closeModal('returnModal');
    loadBorrows();
  } catch (err) { showToast(err.message, 'error'); }
}

async function viewBorrow(id) {
  try {
    const res = await API.getBorrow(id);
    const b = res.data;
    document.getElementById('borrowDetailBody').innerHTML = renderBorrowDetailBody(b);
    openModal('borrowDetailModal');
  } catch (err) { showToast(err.message, 'error'); }
}

document.addEventListener('DOMContentLoaded', initOrdersPage);
