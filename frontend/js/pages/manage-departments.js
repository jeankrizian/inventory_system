let departments = [];
let users = [];
let departmentsTableSelection = null;

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
  bindGuardedFormSubmit(document.getElementById('departmentForm'), saveDepartment, { loadingText: 'Saving...' });
  initActionMenus();
  initDepartmentsTableSelection();
  await loadUsers();
  await loadDepartments();
  initSearchableSelects(document);
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
  departmentsTableSelection?.pruneHiddenSelections();
  renderDepartments(filtered);
}

function initDepartmentsTableSelection() {
  departmentsTableSelection = createTableSelection({
    container: 'departmentsTable',
    getRowId: (department) => department.id,
    getVisibleRows: () => {
      const q = document.getElementById('searchInput')?.value.toLowerCase() || '';
      return departments.filter(d =>
        d.name.toLowerCase().includes(q) ||
        (d.code && d.code.toLowerCase().includes(q)) ||
        (d.department_head && d.department_head.toLowerCase().includes(q)) ||
        (d.custodian_name && d.custodian_name.toLowerCase().includes(q)) ||
        (d.description && d.description.toLowerCase().includes(q))
      );
    },
    bulkActions: [
      {
        id: 'archive',
        label: 'Archive Selected',
        icon: 'bi-archive',
        danger: true,
        onClick: bulkArchiveDepartments
      }
    ]
  });
}

async function bulkArchiveDepartments(ids) {
  if (!await confirmAction(
    `Archive ${ids.length} selected department(s)? They will remain in the Archive for 30 days before being permanently deleted.`,
    { variant: 'danger', title: 'Archive Departments', confirmText: 'Archive' }
  )) return;

  await guardAsyncAction(async () => {
    let success = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await API.archiveCategory(id);
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success) {
      showToast(success === 1 ? '1 department archived.' : `${success} departments archived.`);
    }
    if (failed) {
      showToast(failed === 1 ? '1 department could not be archived.' : `${failed} departments could not be archived.`, 'error');
    }
    departmentsTableSelection?.clearSelection();
    loadDepartments();
  }, { loadingText: 'Archiving...', lockKey: 'bulk-archive-departments' });
}

function renderDepartmentActions(d) {
  return renderActionMenuCell(`department-actions-${d.id}`, [
    { label: 'Edit', icon: 'bi-pencil', handler: `editDepartment(${d.id})` },
    { label: 'Archive', icon: 'bi-archive', danger: true, handler: `archiveDepartment(${d.id})` }
  ]);
}

function renderDepartments(list) {
  const el = document.getElementById('departmentsTable');
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><i class="bi bi-building"></i>No departments found</div>';
    departmentsTableSelection?.bindAfterRender(el);
    return;
  }
  el.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          ${departmentsTableSelection?.renderCheckboxHeader() || ''}
          <th>Code</th><th>Name</th><th>Department Head</th><th>Assigned Custodian</th><th>Status</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(d => `
          <tr${departmentsTableSelection?.renderRowAttrs(d) || ''}>
            ${departmentsTableSelection?.renderCheckboxCell(d) || ''}
            <td>${d.code || '-'}</td>
            <td>${d.name}</td>
            <td>${d.department_head || '-'}</td>
            <td>${d.custodian_name || '-'}</td>
            <td>${getStatusBadge(d.status || 'Active')}</td>
            <td>${renderDepartmentActions(d)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  finishTableRender(el);
  departmentsTableSelection?.bindAfterRender(el);
}

function openAddDepartment() {
  document.getElementById('departmentModalTitle').textContent = 'Add Department';
  document.getElementById('departmentForm').reset();
  document.getElementById('departmentId').value = '';
  document.getElementById('departmentStatus').value = 'Active';
  document.getElementById('departmentCode').disabled = false;
  refreshSearchableSelects(document.getElementById('departmentModal'));
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
  document.getElementById('departmentCustodian').value = d.custodian_id || '';
  document.getElementById('departmentStatus').value = d.status || 'Active';
  document.getElementById('departmentDesc').value = d.description || '';
  refreshSearchableSelects(document.getElementById('departmentModal'));
  openModal('departmentModal');
}

function getDepartmentFormData() {
  const custodianId = document.getElementById('departmentCustodian').value;
  return {
    name: document.getElementById('departmentName').value.trim(),
    code: document.getElementById('departmentCode').value.trim(),
    department_head: document.getElementById('departmentHead').value.trim() || null,
    custodian_id: custodianId ? parseInt(custodianId, 10) : null,
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
  if (!await confirmAction('Archive this department? It will remain in the Archive for 30 days before being permanently deleted.', { variant: 'danger', title: 'Archive Department', confirmText: 'Archive' })) return;
  await guardAsyncAction(async () => {
    try {
      const res = await API.archiveCategory(id);
      showToast(res?.message || 'The record has been archived successfully. It will remain in the Archive for 30 days before being permanently deleted.');
      loadDepartments();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, { loadingText: 'Archiving...', lockKey: `archive-dept-${id}` });
}

document.addEventListener('DOMContentLoaded', initManageDepartments);
