let categories = [], locations = [];
let activeTab = 'categories';

async function initManageStore() {
  const user = await initLayout('manage-store');
  if (!user) return;

  document.getElementById('pageContent').innerHTML = `
    <div class="page-header">
      <h1>Manage Store</h1>
      <p>Manage categories and storage locations</p>
    </div>
    <div class="nav-tabs-custom">
      <button class="nav-tab-custom active" data-tab="categories">Categories</button>
      <button class="nav-tab-custom" data-tab="locations">Locations</button>
    </div>
    <div id="storeContent"></div>
  `;

  document.querySelectorAll('.nav-tab-custom').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll('.nav-tab-custom').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTab();
    });
  });

  document.getElementById('categoryForm').addEventListener('submit', saveCategory);
  document.getElementById('locationForm').addEventListener('submit', saveLocation);

  await loadData();
}

async function loadData() {
  const [catRes, locRes] = await Promise.all([API.getCategories(), API.getLocations()]);
  categories = catRes?.data || [];
  locations = locRes?.data || [];
  renderTab();
}

function renderTab() {
  if (activeTab === 'categories') renderCategories();
  else renderLocations();
}

function renderCategories() {
  document.getElementById('storeContent').innerHTML = `
    <div class="content-card">
      <div class="content-card-header">
        <h3>Categories</h3>
        <button class="btn-primary-custom" onclick="openAddCategory()"><i class="bi bi-plus-lg"></i> Add Category</button>
      </div>
      <div class="table-responsive">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Description</th><th>Actions</th></tr></thead>
        <tbody>
          ${categories.length ? categories.map(c => `
            <tr>
              <td>${c.name}</td>
              <td>${c.description || '-'}</td>
              <td>
                <button class="btn-icon" onclick="editCategory(${c.id})" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>
                <button class="btn-icon danger" onclick="archiveCategory(${c.id})" title="Archive"><i class="bi bi-archive"></i></button>
              </td>
            </tr>
          `).join('') : '<tr><td colspan="3" class="empty-state">No categories</td></tr>'}
        </tbody>
      </table>
      </div>
    </div>
  `;
}

function renderLocations() {
  document.getElementById('storeContent').innerHTML = `
    <div class="content-card">
      <div class="content-card-header">
        <h3>Locations</h3>
        <button class="btn-primary-custom" onclick="openAddLocation()"><i class="bi bi-plus-lg"></i> Add Location</button>
      </div>
      <div class="table-responsive">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Description</th><th>Actions</th></tr></thead>
        <tbody>
          ${locations.length ? locations.map(l => `
            <tr>
              <td>${l.name}</td>
              <td>${l.description || '-'}</td>
              <td>
                <button class="btn-icon" onclick="editLocation(${l.id})" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>
                <button class="btn-icon danger" onclick="archiveLocation(${l.id})" title="Archive"><i class="bi bi-archive"></i></button>
              </td>
            </tr>
          `).join('') : '<tr><td colspan="3" class="empty-state">No locations</td></tr>'}
        </tbody>
      </table>
      </div>
    </div>
  `;
}

function openAddCategory() {
  document.getElementById('categoryModalTitle').textContent = 'Add Category';
  document.getElementById('categoryForm').reset();
  document.getElementById('categoryId').value = '';
  openModal('categoryModal');
}

function editCategory(id) {
  const c = categories.find(x => x.id === id);
  document.getElementById('categoryModalTitle').textContent = 'Edit Category';
  document.getElementById('categoryId').value = c.id;
  document.getElementById('categoryName').value = c.name;
  document.getElementById('categoryDesc').value = c.description || '';
  openModal('categoryModal');
}

async function saveCategory(e) {
  e.preventDefault();
  const id = document.getElementById('categoryId').value;
  const data = { name: document.getElementById('categoryName').value, description: document.getElementById('categoryDesc').value };
  try {
    if (id) { await API.updateCategory(id, data); showToast('Category updated'); }
    else { await API.createCategory(data); showToast('Category created'); }
    closeModal('categoryModal');
    loadData();
  } catch (err) { showToast(err.message, 'error'); }
}

async function archiveCategory(id) {
  if (!confirmAction('Archive this category? It will remain in the Archive for 30 days before being permanently deleted.')) return;
  try {
    const res = await API.archiveCategory(id);
    showToast(res?.message || 'The record has been archived successfully. It will remain in the Archive for 30 days before being permanently deleted.');
    loadData();
  } catch (err) { showToast(err.message, 'error'); }
}

async function archiveLocation(id) {
  if (!confirmAction('Archive this location? It will remain in the Archive for 30 days before being permanently deleted.')) return;
  try {
    const res = await API.archiveLocation(id);
    showToast(res?.message || 'The record has been archived successfully. It will remain in the Archive for 30 days before being permanently deleted.');
    loadData();
  } catch (err) { showToast(err.message, 'error'); }
}

function openAddLocation() {
  document.getElementById('locationModalTitle').textContent = 'Add Location';
  document.getElementById('locationForm').reset();
  document.getElementById('locationId').value = '';
  openModal('locationModal');
}

function editLocation(id) {
  const l = locations.find(x => x.id === id);
  document.getElementById('locationModalTitle').textContent = 'Edit Location';
  document.getElementById('locationId').value = l.id;
  document.getElementById('locationName').value = l.name;
  document.getElementById('locationDesc').value = l.description || '';
  openModal('locationModal');
}

async function saveLocation(e) {
  e.preventDefault();
  const id = document.getElementById('locationId').value;
  const data = { name: document.getElementById('locationName').value, description: document.getElementById('locationDesc').value };
  try {
    if (id) { await API.updateLocation(id, data); showToast('Location updated'); }
    else { await API.createLocation(data); showToast('Location created'); }
    closeModal('locationModal');
    loadData();
  } catch (err) { showToast(err.message, 'error'); }
}

document.addEventListener('DOMContentLoaded', initManageStore);
