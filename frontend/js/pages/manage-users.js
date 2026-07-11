let users = [];
let roles = [];
let departments = [];
let currentUser = null;
let usersTableSelection = null;

async function initManageUsers() {
  currentUser = await initLayout('manage-users');
  if (!currentUser) return;

  document.getElementById('pageContent').innerHTML = `
    <div class="page-header">
      <h1>Users</h1>
      <p>Manage system user accounts</p>
    </div>
    <div class="content-card">
      <div class="content-card-header">
        <h3>All Users</h3>
        <button class="btn-primary-custom" onclick="openAddUser()"><i class="bi bi-plus-lg"></i> Add User</button>
      </div>
      <div class="filters-bar">
        <input type="text" class="form-control-custom" id="searchInput" placeholder="Search users...">
        <select class="form-control-custom" id="filterRole">
          <option value="">All Roles</option>
        </select>
        <select class="form-control-custom" id="filterStatus">
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>
      <div class="table-responsive" id="usersTable">
        <div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div>
      </div>
    </div>
  `;

  document.getElementById('searchInput').addEventListener('input', debounce(loadUsers, 300));
  document.getElementById('filterRole').addEventListener('change', loadUsers);
  document.getElementById('filterStatus').addEventListener('change', loadUsers);
  bindGuardedFormSubmit(document.getElementById('userForm'), saveUser, { loadingText: 'Saving...' });
  document.getElementById('userRole').addEventListener('change', updateAssignmentFields);
  initActionMenus();
  initUsersTableSelection();

  await Promise.all([loadRoles(), loadDepartments()]);
  await loadUsers();
  initSearchableSelects(document);

  const deepLinkId = new URLSearchParams(window.location.search).get('id');
  if (deepLinkId) {
    const userId = parseInt(deepLinkId, 10);
    if (!Number.isNaN(userId)) editUser(userId);
  }
}

async function loadDepartments() {
  try {
    const res = await API.getCategories();
    departments = res?.data || [];
    populateSelect(document.getElementById('userAssignedDepartment'), departments, 'id', 'name', 'Select department...');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function updateAssignmentFields() {
  const role = (document.getElementById('userRole').value || '').toLowerCase().trim();
  const assignmentFields = document.getElementById('assignmentFields');
  const deptGroup = document.getElementById('departmentAssignmentGroup');
  const deptSelect = document.getElementById('userAssignedDepartment');

  const isCustodianRole = role === 'custodian';

  assignmentFields.style.display = isCustodianRole ? 'flex' : 'none';
  deptGroup.style.display = isCustodianRole ? 'block' : 'none';

  if (deptSelect) {
    deptSelect.required = isCustodianRole;
    if (!isCustodianRole) deptSelect.value = '';
  }
}

async function loadRoles() {
  try {
    const res = await API.getUserRoles();
    roles = res?.data || [];
    const filterEl = document.getElementById('filterRole');
    const roleEl = document.getElementById('userRole');
    roles.forEach(r => {
      const label = r.display_name || formatRoleDisplayName(r.name);
      filterEl.innerHTML += `<option value="${r.name}">${label}</option>`;
      roleEl.innerHTML += `<option value="${r.name}">${label}</option>`;
    });
    if (typeof refreshSearchableSelects === 'function') {
      refreshSearchableSelects([filterEl, roleEl]);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadUsers() {
  const params = {};
  const search = document.getElementById('searchInput')?.value;
  const role = document.getElementById('filterRole')?.value;
  const status = document.getElementById('filterStatus')?.value;
  if (search) params.search = search;
  if (role) params.role = role;
  if (status) params.status = status;

  try {
    const res = await API.getManagedUsers(params);
    users = res?.data || [];
    renderUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function initUsersTableSelection() {
  usersTableSelection = createTableSelection({
    container: 'usersTable',
    getRowId: (user) => user.id,
    getVisibleRows: () => users,
    isRowSelectable: (user) => user.id !== currentUser.id,
    bulkActions: [
      {
        id: 'archive',
        label: 'Archive Selected',
        icon: 'bi-archive',
        danger: true,
        onClick: bulkArchiveUsers
      }
    ]
  });
}

async function bulkArchiveUsers(ids) {
  const archivableIds = ids.filter((id) => id !== currentUser.id);
  if (!archivableIds.length) {
    showToast('No archivable users selected.', 'error');
    return;
  }

  if (!await confirmAction(
    `Archive ${archivableIds.length} selected user(s)? They will remain in the Archive for 30 days before being permanently deleted.`,
    { variant: 'danger', title: 'Archive Users', confirmText: 'Archive' }
  )) return;

  await guardAsyncAction(async () => {
    let success = 0;
    let failed = 0;
    for (const id of archivableIds) {
      try {
        await API.archiveManagedUser(id);
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success) {
      showToast(success === 1 ? '1 user archived.' : `${success} users archived.`);
    }
    if (failed) {
      showToast(failed === 1 ? '1 user could not be archived.' : `${failed} users could not be archived.`, 'error');
    }
    usersTableSelection?.clearSelection();
    loadUsers();
  }, { loadingText: 'Archiving...', lockKey: 'bulk-archive-users' });
}

function formatAssignment(value) {
  return value && String(value).trim() ? value : '—';
}

function renderUserActions(u) {
  const items = [
    { label: 'Edit', icon: 'bi-pencil', handler: `editUser(${u.id})` }
  ];
  if (u.id !== currentUser.id) {
    items.push({ label: 'Archive', icon: 'bi-archive', danger: true, handler: `archiveUser(${u.id})` });
  }
  return renderActionMenuCell(`user-actions-${u.id}`, items);
}

function renderUsers() {
  const el = document.getElementById('usersTable');
  usersTableSelection?.pruneHiddenSelections();

  if (!users.length) {
    el.innerHTML = '<div class="empty-state"><i class="bi bi-people"></i>No users found</div>';
    usersTableSelection?.bindAfterRender(el);
    return;
  }

  el.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          ${usersTableSelection?.renderCheckboxHeader() || ''}
          <th>Full Name</th><th>Username</th><th>Email</th><th>Role</th>
          <th>Assigned Department</th>
          <th>Status</th><th>Date Created</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(u => `
          <tr${usersTableSelection?.renderRowAttrs(u) || ''}>
            ${usersTableSelection?.renderCheckboxCell(u) || ''}
            <td>${u.full_name}</td>
            <td>${u.username}</td>
            <td>${u.email}</td>
            <td>${formatRoleDisplayName(u.role_name)}</td>
            <td>${formatAssignment(u.assigned_department_name)}</td>
            <td>${u.is_active ? 'Active' : 'Inactive'}</td>
            <td>${formatDate(u.created_at)}</td>
            <td>${renderUserActions(u)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  finishTableRender(el);
  usersTableSelection?.bindAfterRender(el);
}

function openAddUser() {
  document.getElementById('userModalTitle').textContent = 'Add User';
  document.getElementById('userForm').reset();
  document.getElementById('userId').value = '';
  document.getElementById('userPassword').required = true;
  document.getElementById('passwordLabel').textContent = 'Password *';
  document.getElementById('passwordHint').style.display = 'none';
  updateAssignmentFields();
  refreshSearchableSelects(document.getElementById('userModal'));
  openModal('userModal');
}

function editUser(id) {
  const u = users.find(x => x.id === id);
  if (!u) return;
  document.getElementById('userModalTitle').textContent = 'Edit User';
  document.getElementById('userId').value = u.id;
  document.getElementById('userFullName').value = u.full_name;
  document.getElementById('userUsername').value = u.username;
  document.getElementById('userEmail').value = u.email;
  document.getElementById('userRole').value = u.role_name || '';
  document.getElementById('userAssignedDepartment').value = u.assigned_department_id || '';
  document.getElementById('userStatus').value = u.is_active ? 'Active' : 'Inactive';
  document.getElementById('userPassword').value = '';
  document.getElementById('userPassword').required = false;
  document.getElementById('passwordLabel').textContent = 'Password';
  document.getElementById('passwordHint').style.display = 'block';
  updateAssignmentFields();
  refreshSearchableSelects(document.getElementById('userModal'));
  openModal('userModal');
}

function validateCustodianAssignments(role) {
  const roleLower = (role || '').toLowerCase().trim();
  const deptId = document.getElementById('userAssignedDepartment').value;

  if (roleLower === 'custodian' && !deptId) {
    return 'Custodian requires an assigned department.';
  }
  return null;
}

async function saveUser(e) {
  e.preventDefault();
  const id = document.getElementById('userId').value;
  const role = document.getElementById('userRole').value;
  const assignmentError = validateCustodianAssignments(role);
  if (assignmentError) {
    showToast(assignmentError, 'error');
    return;
  }

  const isCustodianRole = (role || '').toLowerCase().trim() === 'custodian';
  const data = {
    full_name: document.getElementById('userFullName').value,
    username: document.getElementById('userUsername').value,
    email: document.getElementById('userEmail').value,
    role,
    is_active: document.getElementById('userStatus').value,
    assigned_department_id: isCustodianRole
      ? (document.getElementById('userAssignedDepartment').value || null)
      : null,
    assigned_location_id: null
  };
  const password = document.getElementById('userPassword').value;
  if (password) data.password = password;

  try {
    if (id) {
      await API.updateManagedUser(id, data);
      showToast('User updated');
    } else {
      if (!password) {
        showToast('Password is required for new users', 'error');
        return;
      }
      await API.createManagedUser(data);
      showToast('User created');
    }
    closeModal('userModal');
    loadUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function archiveUser(id) {
  if (!await confirmAction('Archive this user? It will remain in the Archive for 30 days before being permanently deleted.', { variant: 'danger', title: 'Archive User', confirmText: 'Archive' })) return;
  await guardAsyncAction(async () => {
    try {
      const res = await API.archiveManagedUser(id);
      showToast(res?.message || 'The record has been archived successfully. It will remain in the Archive for 30 days before being permanently deleted.');
      loadUsers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, { loadingText: 'Archiving...', lockKey: `archive-user-${id}` });
}

document.addEventListener('DOMContentLoaded', initManageUsers);
