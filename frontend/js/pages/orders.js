let currentUser = null;
let inventoryItems = [];
let borrows = [];
let returns = [];
let activeTab = 'borrow';

async function initOrdersPage() {
  currentUser = await initLayout('orders');
  if (!currentUser) return;

  const params = new URLSearchParams(window.location.search);
  if (params.get('tab') === 'returns') activeTab = 'returns';

  const showBorrowBtn = canSubmitBorrow(currentUser);
  const showReturnTab = canViewReturnHistory(currentUser);

  document.getElementById('pageContent').innerHTML = `
    <div class="page-header">
      <h1>Orders & Borrowing</h1>
      <p>Manage borrow requests, approvals, and process returns</p>
    </div>
    <div class="content-card">
      <div class="content-card-header">
        <div class="nav-tabs-custom" style="border:none;margin:0;">
          <button class="nav-tab-custom ${activeTab === 'borrow' ? 'active' : ''}" data-tab="borrow">Borrow Transactions</button>
          ${showReturnTab ? `<button class="nav-tab-custom ${activeTab === 'returns' ? 'active' : ''}" data-tab="returns">Process Return History</button>` : ''}
        </div>
        ${showBorrowBtn ? `<button class="btn-primary-custom" onclick="openBorrowModal()"><i class="bi bi-plus-lg"></i> Borrow Item</button>` : ''}
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
  document.getElementById('borrowForm').addEventListener('submit', submitBorrow);
  document.getElementById('returnForm').addEventListener('submit', submitReturn);
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.borrow-item-combobox')) closeBorrowItemDropdowns();
  });

  if (showBorrowBtn) {
    const invRes = await API.getBorrowableItems();
    inventoryItems = (invRes?.data || []).filter(i => i.available_quantity > 0 && canBorrowAsset(i.asset_classification));
  }

  if (!showReturnTab && activeTab === 'returns') activeTab = 'borrow';
  await loadData();
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

function renderBorrows() {
  const el = document.getElementById('ordersContent');
  const canApprove = canApproveBorrow(currentUser);
  const canReturn = canProcessReturn(currentUser);

  if (!borrows.length) {
    el.innerHTML = '<div class="empty-state"><i class="bi bi-cart3"></i>No borrow requests found.</div>';
    return;
  }

  el.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Code</th><th>Borrower</th><th>Department</th><th>Borrow Date</th><th>Expected Return</th><th>Status</th><th>Actions</th></tr>
      </thead>
      <tbody>
        ${borrows.map(b => `
          <tr>
            <td>${b.transaction_code}</td>
            <td>${b.borrower_name}</td>
            <td>${b.borrower_department || '-'}</td>
            <td>${formatDate(b.borrow_date)}</td>
            <td>${formatDate(b.expected_return_date)}</td>
            <td>${getStatusBadge(b.status)}</td>
            <td style="white-space:nowrap;">
              ${b.status === 'Pending' && canApprove ? `
                <button class="btn-success-custom btn-sm-custom" onclick="approveBorrow(${b.id})">Approve</button>
                <button class="btn-danger-custom btn-sm-custom" onclick="rejectBorrow(${b.id})">Reject</button>
              ` : ''}
              ${['Borrowed','Approved','Overdue'].includes(b.status) && canReturn ? `
                <button class="btn-primary-custom btn-sm-custom" onclick="openReturnModal(${b.id}, '${b.transaction_code}', '${b.borrower_name}')">Process Return</button>
              ` : ''}
              <button class="btn-icon" onclick="viewBorrow(${b.id})" title="View"><i class="bi bi-eye"></i></button>
              ${['Borrowed','Approved','Overdue','Returned'].includes(b.status) ? `
                <button class="btn-icon" onclick="openBorrowDocument(${b.id})" title="View ABL" aria-label="View ABL"><i class="bi bi-journal-text"></i></button>
              ` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
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
}

function getBorrowItemLabel(item) {
  return `${item.item_name} (${item.available_quantity} avail.)`;
}

function filterBorrowItems(term) {
  const t = term.trim().toLowerCase();
  if (!t) return inventoryItems;
  return inventoryItems.filter(i => i.item_name.toLowerCase().includes(t));
}

function borrowItemRowHtml(withRemove = false) {
  return `
    <div class="form-group" style="flex:2"><label>Item</label>
      <div class="borrow-item-combobox">
        <input type="text" class="form-control-custom borrow-item-select" placeholder="Select item..." autocomplete="off" required>
        <input type="hidden" class="borrow-item-id">
        <div class="borrow-item-dropdown"></div>
      </div>
    </div>
    <div class="form-group"><label>Qty</label><input type="number" class="form-control-custom borrow-item-qty" value="1" min="1" required></div>
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
    <div class="borrow-item-option" data-id="${item.id}">
      ${item.item_name}<small>${item.available_quantity} available</small>
    </div>
  `).join('');
  dropdown.querySelectorAll('.borrow-item-option:not(.borrow-item-empty)').forEach(opt => {
    opt.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const item = items.find(i => i.id == opt.dataset.id);
      if (item) onSelect(item);
    });
  });
}

function initBorrowItemCombobox(combobox) {
  if (combobox.dataset.initialized) return;
  combobox.dataset.initialized = '1';

  const input = combobox.querySelector('.borrow-item-select');
  const hidden = combobox.querySelector('.borrow-item-id');
  const dropdown = combobox.querySelector('.borrow-item-dropdown');

  function showDropdown() {
    closeBorrowItemDropdowns(combobox);
    const items = filterBorrowItems(input.value);
    renderBorrowItemDropdown(dropdown, items, (item) => {
      input.value = getBorrowItemLabel(item);
      hidden.value = item.id;
      dropdown.classList.remove('show');
    });
    dropdown.classList.add('show');
  }

  input.addEventListener('focus', showDropdown);
  input.addEventListener('click', showDropdown);
  input.addEventListener('input', () => {
    hidden.value = '';
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
  openModal('borrowModal');
}

function addBorrowItemRow() {
  const row = document.createElement('div');
  row.className = 'form-row borrow-item-row';
  row.innerHTML = borrowItemRowHtml(true);
  document.getElementById('borrowItemsList').appendChild(row);
  initBorrowItemComboboxes();
}

async function submitBorrow(e) {
  e.preventDefault();
  const items = [];
  document.querySelectorAll('.borrow-item-row').forEach(row => {
    const id = row.querySelector('.borrow-item-id').value;
    const qty = parseInt(row.querySelector('.borrow-item-qty').value);
    if (id) items.push({ inventory_item_id: parseInt(id), quantity: qty });
  });
  if (!items.length) {
    showToast('Please select at least one item from the list', 'error');
    return;
  }

  try {
    await API.createBorrow({
      borrower_department: document.getElementById('borrowerDept').value,
      purpose: document.getElementById('borrowPurpose').value,
      borrow_date: document.getElementById('borrowDate').value,
      expected_return_date: document.getElementById('expectedReturn').value || null,
      items
    });
    showToast('Borrow request submitted');
    closeModal('borrowModal');
    loadBorrows();
  } catch (err) { showToast(err.message, 'error'); }
}

async function approveBorrow(id) {
  if (!confirmAction('Approve this borrow request?')) return;
  try {
    const res = await API.approveBorrow(id);
    showToast('Borrow approved');
    openGeneratedDocument(res?.data?.generated_document, 'ABL');
    loadBorrows();
  } catch (err) { showToast(err.message, 'error'); }
}

async function rejectBorrow(id) {
  if (!confirmAction('Reject this borrow request?')) return;
  try {
    await API.rejectBorrow(id);
    showToast('Borrow rejected');
    loadBorrows();
  } catch (err) { showToast(err.message, 'error'); }
}

function openReturnModal(id, code, borrower) {
  document.getElementById('returnBorrowId').value = id;
  document.getElementById('returnBorrowInfo').textContent = `Process Return for ${code} — ${borrower}`;
  document.getElementById('returnDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('returnForm').reset();
  document.getElementById('returnBorrowId').value = id;
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
    const items = (b.items || []).map(i => `• ${i.item_name} (x${i.quantity})`).join('\n');
    alert(`Transaction: ${b.transaction_code}\nBorrower: ${b.borrower_name}\nDepartment: ${b.borrower_department || 'N/A'}\nPurpose: ${b.purpose || 'N/A'}\nStatus: ${b.status}\n\nItems:\n${items}`);
  } catch (err) { showToast(err.message, 'error'); }
}

document.addEventListener('DOMContentLoaded', initOrdersPage);
