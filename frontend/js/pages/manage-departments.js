let departments = [];
let users = [];

async function initManageDepartments() {
  const user = await initLayout('manage-departments');
  if (!user) return;

  document.getElementById('pageContent').innerHTML = `
    <div class="page-header">
      <h1>Departments</h1>
      <p>Manage school departments</p>
    </div>
    <div class="content-card">
      <div class="content-card-header">
        <h3>All Departments</h3>
        <button class="btn-primary-custom" onclick="openAddDepartment()"><i class="bi bi-plus-lg"></i> Add Department</button>
      </div>
      <div class="filters-bar">
        <input type="text" class="form-control-custom" id="searchInput" placeholder="Search departments...">
      </div>
      <div class="table-responsive" id="departmentsTable">
        <div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div>
      </div>
    </div>
  `;

  document.getElementById('searchInput').addEventListener('input', debounce(filterDepartments, 300));
  document.getElementById('departmentForm').addEventListener('submit', saveDepartment);
  await loadUsers();
  await loadDepartments();
}

async function loadUsers() {
  try {
    const res = await API.getUsers();
    users = res?.data || [];
    populateSelect(document.getElementById('departmentCustodian'), users, 'id', 'full_name', 'Select custodian...');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadDepartments() {
  try {
    const res = await API.getCategories();
    departments = res?.data || [];
    filterDepartments();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function filterDepartments() {
  const q = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const filtered = departments.filter(d =>
    d.name.toLowerCase().includes(q) ||
    (d.code && d.code.toLowerCase().includes(q)) ||
    (d.department_head && d.department_head.toLowerCase().includes(q)) ||
    (d.custodian_name && d.custodian_name.toLowerCase().includes(q)) ||
    (d.description && d.description.toLowerCase().includes(q))
  );
  renderDepartments(filtered);
}

function renderDepartments(list) {
  const el = document.getElementById('departmentsTable');
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><i class="bi bi-building"></i>No departments found</div>';
    return;
  }
  el.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Code</th><th>Name</th><th>Department Head</th><th>Assigned Custodian</th><th>Status</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(d => `
          <tr>
            <td>${d.code || '-'}</td>
            <td>${d.name}</td>
            <td>${d.department_head || '-'}</td>
            <td>${d.custodian_name ? `${d.custodian_name}${d.custodian_type ? ` (${normalizeAssetCustodianType(d.custodian_type)})` : ''}` : '-'}</td>
            <td>${getStatusBadge(d.status || 'Active')}</td>
            <td>
              <button class="btn-icon" onclick="editDepartment(${d.id})" title="Edit"><i class="bi bi-pencil"></i></button>
              <button class="btn-icon danger" onclick="archiveDepartment(${d.id})" title="Archive"><i class="bi bi-archive"></i></button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function openAddDepartment() {
  document.getElementById('departmentModalTitle').textContent = 'Add Department';
  document.getElementById('departmentForm').reset();
  document.getElementById('departmentId').value = '';
  document.getElementById('departmentStatus').value = 'Active';
  document.getElementById('departmentCode').disabled = false;
  openModal('departmentModal');
}

function editDepartment(id) {
  const d = departments.find(x => x.id === id);
  if (!d) return;
  document.getElementById('departmentModalTitle').textContent = 'Edit Department';
  document.getElementById('departmentId').value = d.id;
  document.getElementById('departmentName').value = d.name;
  document.getElementById('departmentCode').value = d.code || '';
  document.getElementById('departmentCode').disabled = false;
  document.getElementById('departmentHead').value = d.department_head || '';
  document.getElementById('departmentCustodianType').value = normalizeAssetCustodianType(d.custodian_type) || '';
  document.getElementById('departmentCustodian').value = d.custodian_id || '';
  document.getElementById('departmentStatus').value = d.status || 'Active';
  document.getElementById('departmentDesc').value = d.description || '';
  openModal('departmentModal');
}

function getDepartmentFormData() {
  const custodianId = document.getElementById('departmentCustodian').value;
  const custodianType = document.getElementById('departmentCustodianType').value;
  return {
    name: document.getElementById('departmentName').value.trim(),
    code: document.getElementById('departmentCode').value.trim(),
    department_head: document.getElementById('departmentHead').value.trim() || null,
    custodian_id: custodianId ? parseInt(custodianId, 10) : null,
    custodian_type: custodianType || null,
    status: document.getElementById('departmentStatus').value,
    description: document.getElementById('departmentDesc').value.trim() || null
  };
}

async function saveDepartment(e) {
  e.preventDefault();
  const id = document.getElementById('departmentId').value;
  const data = getDepartmentFormData();

  if (!data.code) {
    showToast('Department code is required', 'error');
    return;
  }

  const hasCustodian = Boolean(data.custodian_id);
  const hasType = Boolean(data.custodian_type);
  if (hasCustodian !== hasType) {
    showToast('Both assigned custodian and custodian type are required when assigning a custodian', 'error');
    return;
  }

  try {
    if (id) {
      await API.updateCategory(id, data);
      showToast('Department updated');
    } else {
      await API.createCategory(data);
      showToast('Department created');
    }
    closeModal('departmentModal');
    loadDepartments();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function archiveDepartment(id) {
  if (!confirmAction('Archive this department? It will remain in the Archive for 30 days before being permanently deleted.')) return;
  try {
    const res = await API.archiveCategory(id);
    showToast(res?.message || 'The record has been archived successfully. It will remain in the Archive for 30 days before being permanently deleted.');
    loadDepartments();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', initManageDepartments);
