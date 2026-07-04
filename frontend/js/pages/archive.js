let currentPage = 1;
const pageSize = 10;

async function initArchivePage() {
  const user = await initLayout('archive');
  if (!user) return;

  document.getElementById('pageContent').innerHTML = `
    <div class="page-header">
      <h1>Archive</h1>
      <p>View and restore archived records. Records are permanently removed after 30 days.</p>
    </div>
    <div class="content-card">
      <div class="filters-bar">
        <input type="text" class="form-control-custom" id="archiveSearch" placeholder="Search archived records...">
        <select class="form-control-custom" id="archiveModule">
          <option value="">All Modules</option>
          <option value="inventory">Inventory</option>
          <option value="department">Department</option>
          <option value="location">Location</option>
          <option value="supplier">Supplier</option>
          <option value="user">User</option>
        </select>
      </div>
      <div class="table-responsive" id="archiveList">
        <div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div>
      </div>
      <div class="content-card-header" id="archivePagination" style="margin-top:20px;margin-bottom:0;"></div>
    </div>
  `;

  document.getElementById('archiveSearch').addEventListener('input', debounce(() => { currentPage = 1; loadArchive(); }, 300));
  document.getElementById('archiveModule').addEventListener('change', () => { currentPage = 1; loadArchive(); });

  await loadArchive();
}

async function loadArchive() {
  const el = document.getElementById('archiveList');
  const paginationEl = document.getElementById('archivePagination');

  try {
    const res = await API.getArchive({
      search: document.getElementById('archiveSearch').value,
      module: document.getElementById('archiveModule').value,
      page: currentPage,
      pageSize
    });

    const data = res?.data || {};
    const items = data.items || [];

    if (!items.length) {
      el.innerHTML = '<div class="empty-state"><i class="bi bi-archive"></i>No archived records found</div>';
      paginationEl.innerHTML = '';
      return;
    }

    el.innerHTML = items.map(item => `
      <div class="low-stock-item" style="border-bottom:1px solid var(--gray-light);padding:16px 0;">
        <div class="low-stock-icon"><i class="bi bi-archive"></i></div>
        <div class="low-stock-info" style="flex:1;">
          <div class="name">${item.module}: ${item.title || 'Untitled'}</div>
          <div class="qty">${item.detail ? item.detail + ' · ' : ''}Archived by: ${item.archived_by_name || 'Unknown'}</div>
          <div class="qty" style="margin-top:4px;">Archived: ${formatDate(item.archived_at)}</div>
        </div>
        <button class="btn-outline-custom btn-sm-custom" onclick="restoreRecord('${item.module_key}', ${item.id})" title="Restore" aria-label="Restore">
          <i class="bi bi-arrow-counterclockwise"></i> Restore
        </button>
      </div>
    `).join('');

    const totalPages = data.totalPages || 1;
    paginationEl.innerHTML = `
      <span style="font-size:13px;color:var(--text-secondary);">Page ${data.page} of ${totalPages} (${data.total} records)</span>
      <div style="display:flex;gap:8px;">
        <button class="btn-outline-custom btn-sm-custom" ${currentPage <= 1 ? 'disabled' : ''} onclick="changeArchivePage(${currentPage - 1})">Previous</button>
        <button class="btn-outline-custom btn-sm-custom" ${currentPage >= totalPages ? 'disabled' : ''} onclick="changeArchivePage(${currentPage + 1})">Next</button>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="empty-state">${err.message}</div>`;
    paginationEl.innerHTML = '';
  }
}

function changeArchivePage(page) {
  currentPage = page;
  loadArchive();
}

async function restoreRecord(module, id) {
  if (!confirmAction('Restore this record to its original module?')) return;
  try {
    const res = await API.restoreArchive(module, id);
    showToast(res?.message || 'The record has been restored successfully.');
    loadArchive();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', initArchivePage);
