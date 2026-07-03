let users = [];
let roles = [];
let currentUser = null;

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
  document.getElementById('userForm').addEventListener('submit', saveUser);

  await loadRoles();
  await loadUsers();
}

async function loadRoles() {
  try {
    const res = await API.getUserRoles();
    roles = res?.data || [];
    const filterEl = document.getElementById('filterRole');
    const roleEl = document.getElementById('userRole');
    roles.forEach(r => {
      filterEl.innerHTML += `<option value="${r.name}">${r.name}</option>`;
      roleEl.innerHTML += `<option value="${r.name}">${r.name}</option>`;
    });
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

function renderUsers() {
  const el = document.getElementById('usersTable');
  if (!users.length) {
    el.innerHTML = '<div class="empty-state"><i class="bi bi-people"></i>No users found</div>';
    return;
  }

  el.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Full Name</th><th>Username</th><th>Email</th><th>Role</th>
          <th>Status</th><th>Date Created</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(u => `
          <tr>
            <td>${u.full_name}</td>
            <td>${u.username}</td>
            <td>${u.email}</td>
            <td>${u.role_name || '-'}</td>
            <td>${u.is_active ? 'Active' : 'Inactive'}</td>
            <td>${formatDate(u.created_at)}</td>
            <td>
              <button class="btn-icon" onclick="editUser(${u.id})" title="Edit"><i class="bi bi-pencil"></i></button>
              ${u.id !== currentUser.id ? `<button class="btn-icon danger" onclick="archiveUser(${u.id})" title="Archive"><i class="bi bi-archive"></i></button>` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function openAddUser() {
  document.getElementById('userModalTitle').textContent = 'Add User';
  document.getElementById('userForm').reset();
  document.getElementById('userId').value = '';
  document.getElementById('userPassword').required = true;
  document.getElementById('passwordLabel').textContent = 'Password *';
  document.getElementById('passwordHint').style.display = 'none';
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
  document.getElementById('userStatus').value = u.is_active ? 'Active' : 'Inactive';
  document.getElementById('userPassword').value = '';
  document.getElementById('userPassword').required = false;
  document.getElementById('passwordLabel').textContent = 'Password';
  document.getElementById('passwordHint').style.display = 'block';
  openModal('userModal');
}

async function saveUser(e) {
  e.preventDefault();
  const id = document.getElementById('userId').value;
  const data = {
    full_name: document.getElementById('userFullName').value,
    username: document.getElementById('userUsername').value,
    email: document.getElementById('userEmail').value,
    role: document.getElementById('userRole').value,
    is_active: document.getElementById('userStatus').value
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
  if (!confirmAction('Archive this user? It will remain in the Archive for 30 days before being permanently deleted.')) return;
  try {
    const res = await API.archiveManagedUser(id);
    showToast(res?.message || 'The record has been archived successfully. It will remain in the Archive for 30 days before being permanently deleted.');
    loadUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', initManageUsers);
