let locations = [];

async function initManageLocations() {
  const user = await initLayout('manage-locations');
  if (!user) return;

  document.getElementById('pageContent').innerHTML = `
    <div class="page-header">
      <h1>Locations</h1>
      <p>Manage storage and facility locations</p>
    </div>
    <div class="content-card">
      <div class="content-card-header">
        <h3>All Locations</h3>
        <button class="btn-primary-custom" onclick="openAddLocation()"><i class="bi bi-plus-lg"></i> Add Location</button>
      </div>
      <div class="filters-bar">
        <input type="text" class="form-control-custom" id="searchInput" placeholder="Search locations...">
      </div>
      <div class="table-responsive" id="locationsTable">
        <div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div>
      </div>
    </div>
  `;

  document.getElementById('searchInput').addEventListener('input', debounce(filterLocations, 300));
  document.getElementById('locationForm').addEventListener('submit', saveLocation);
  await loadLocations();
}

async function loadLocations() {
  try {
    const res = await API.getLocations();
    locations = res?.data || [];
    filterLocations();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function filterLocations() {
  const q = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const filtered = locations.filter(l =>
    l.name.toLowerCase().includes(q) ||
    (l.description && l.description.toLowerCase().includes(q))
  );
  renderLocations(filtered);
}

function renderLocations(list) {
  const el = document.getElementById('locationsTable');
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><i class="bi bi-geo-alt"></i>No locations found</div>';
    return;
  }
  el.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Name</th><th>Description</th><th>Actions</th></tr></thead>
      <tbody>
        ${list.map(l => `
          <tr>
            <td>${l.name}</td>
            <td>${l.description || '-'}</td>
            <td>
              <button class="btn-icon" onclick="editLocation(${l.id})" title="Edit"><i class="bi bi-pencil"></i></button>
              <button class="btn-icon danger" onclick="archiveLocation(${l.id})" title="Archive"><i class="bi bi-archive"></i></button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function openAddLocation() {
  document.getElementById('locationModalTitle').textContent = 'Add Location';
  document.getElementById('locationForm').reset();
  document.getElementById('locationId').value = '';
  openModal('locationModal');
}

function editLocation(id) {
  const l = locations.find(x => x.id === id);
  if (!l) return;
  document.getElementById('locationModalTitle').textContent = 'Edit Location';
  document.getElementById('locationId').value = l.id;
  document.getElementById('locationName').value = l.name;
  document.getElementById('locationDesc').value = l.description || '';
  openModal('locationModal');
}

async function saveLocation(e) {
  e.preventDefault();
  const id = document.getElementById('locationId').value;
  const data = {
    name: document.getElementById('locationName').value,
    description: document.getElementById('locationDesc').value
  };
  try {
    if (id) {
      await API.updateLocation(id, data);
      showToast('Location updated');
    } else {
      await API.createLocation(data);
      showToast('Location created');
    }
    closeModal('locationModal');
    loadLocations();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function archiveLocation(id) {
  if (!confirmAction('Archive this location? It will remain in the Archive for 30 days before being permanently deleted.')) return;
  try {
    const res = await API.archiveLocation(id);
    showToast(res?.message || 'The record has been archived successfully. It will remain in the Archive for 30 days before being permanently deleted.');
    loadLocations();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', initManageLocations);
