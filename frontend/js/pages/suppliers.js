let suppliers = [];
let currentUser = null;

async function initSuppliersPage() {
  currentUser = await initLayout('suppliers');
  if (!currentUser) return;

  const canManage = canManageSuppliers(currentUser);

  document.getElementById('pageContent').innerHTML = `
    <div class="page-header">
      <h1>Suppliers</h1>
      <p>Manage supplier information and contacts</p>
    </div>
    <div class="content-card">
      <div class="content-card-header">
        <h3>All Suppliers</h3>
        ${canManage ? `<button class="btn-primary-custom" onclick="openAddSupplier()"><i class="bi bi-plus-lg"></i> Add Supplier</button>` : ''}
      </div>
      <div class="filters-bar">
        <input type="text" class="form-control-custom" id="searchInput" placeholder="Search suppliers...">
      </div>
      <div class="table-responsive" id="suppliersTable">
        <div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div>
      </div>
    </div>
  `;

  await loadSuppliers();
  document.getElementById('searchInput').addEventListener('input', debounce(filterSuppliers, 300));
  if (canManage) {
    document.getElementById('supplierForm').addEventListener('submit', saveSupplier);
  }
}

async function loadSuppliers() {
  try {
    const res = await API.getSuppliers();
    suppliers = res?.data || [];
    renderSuppliers(suppliers);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function filterSuppliers() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(q) ||
    (s.contact_person && s.contact_person.toLowerCase().includes(q)) ||
    (s.email && s.email.toLowerCase().includes(q))
  );
  renderSuppliers(filtered);
}

function renderSuppliers(list) {
  const el = document.getElementById('suppliersTable');
  const canManage = canManageSuppliers(currentUser);
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><i class="bi bi-truck"></i>No suppliers found</div>';
    return;
  }
  el.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Name</th><th>Contact Person</th><th>Phone</th><th>Email</th><th>Address</th>${canManage ? '<th>Actions</th>' : ''}</tr></thead>
      <tbody>
        ${list.map(s => `
          <tr>
            <td>${s.name}</td>
            <td>${s.contact_person || '-'}</td>
            <td>${s.phone || '-'}</td>
            <td>${s.email || '-'}</td>
            <td>${s.address || '-'}</td>
            ${canManage ? `<td>
              <button class="btn-icon" onclick="editSupplier(${s.id})" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>
              <button class="btn-icon danger" onclick="archiveSupplier(${s.id})" title="Archive"><i class="bi bi-archive"></i></button>
            </td>` : ''}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function openAddSupplier() {
  document.getElementById('supplierModalTitle').textContent = 'Add Supplier';
  document.getElementById('supplierForm').reset();
  document.getElementById('supplierId').value = '';
  openModal('supplierModal');
}

function editSupplier(id) {
  const s = suppliers.find(x => x.id === id);
  if (!s) return;
  document.getElementById('supplierModalTitle').textContent = 'Edit Supplier';
  document.getElementById('supplierId').value = s.id;
  document.getElementById('supplierName').value = s.name;
  document.getElementById('supplierContact').value = s.contact_person || '';
  document.getElementById('supplierPhone').value = s.phone || '';
  document.getElementById('supplierEmail').value = s.email || '';
  document.getElementById('supplierAddress').value = s.address || '';
  openModal('supplierModal');
}

async function saveSupplier(e) {
  e.preventDefault();
  const id = document.getElementById('supplierId').value;
  const data = {
    name: document.getElementById('supplierName').value,
    contact_person: document.getElementById('supplierContact').value,
    phone: document.getElementById('supplierPhone').value,
    email: document.getElementById('supplierEmail').value,
    address: document.getElementById('supplierAddress').value
  };
  try {
    if (id) { await API.updateSupplier(id, data); showToast('Supplier updated'); }
    else { await API.createSupplier(data); showToast('Supplier created'); }
    closeModal('supplierModal');
    loadSuppliers();
  } catch (err) { showToast(err.message, 'error'); }
}

async function archiveSupplier(id) {
  if (!confirmAction('Archive this supplier? It will remain in the Archive for 30 days before being permanently deleted.')) return;
  try {
    const res = await API.archiveSupplier(id);
    showToast(res?.message || 'The record has been archived successfully. It will remain in the Archive for 30 days before being permanently deleted.');
    loadSuppliers();
  } catch (err) { showToast(err.message, 'error'); }
}

document.addEventListener('DOMContentLoaded', initSuppliersPage);
