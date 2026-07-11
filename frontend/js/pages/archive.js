const ARCHIVE_PAGE_SIZE = 500;
let archiveItems = [];
let archiveTableSelection = null;

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
      <div class="table-scroll-container table-responsive" id="archiveList">
        <div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div>
      </div>
      <div class="table-record-count" id="archiveRecordCount" hidden></div>
    </div>
  `;

  document.getElementById('archiveSearch').addEventListener('input', debounce(loadArchive, 300));
  document.getElementById('archiveModule').addEventListener('change', loadArchive);
  initActionMenus();
  initArchiveTableSelection();

  await loadArchive();
  initSearchableSelects(document.getElementById('pageContent'));
}

async function fetchAllArchiveItems(filters) {
  let page = 1;
  let totalPages = 1;
  const items = [];

  do {
    const res = await API.getArchive({
      ...filters,
      page,
      pageSize: ARCHIVE_PAGE_SIZE
    });
    const data = res?.data || {};
    items.push(...(data.items || []));
    totalPages = data.totalPages || 1;
    page += 1;
  } while (page <= totalPages);

  return items;
}

function initArchiveTableSelection() {
  archiveTableSelection = createTableSelection({
    container: 'archiveList',
    getRowId: (item) => `${item.module_key}:${item.id}`,
    getVisibleRows: () => archiveItems,
    bulkActions: [
      {
        id: 'restore',
        label: 'Restore Selected',
        icon: 'bi-arrow-counterclockwise',
        onClick: bulkRestoreArchive
      }
    ]
  });
}

async function bulkRestoreArchive(ids, rows) {
  if (!await confirmAction(`Restore ${ids.length} selected record(s) to their original modules?`)) return;

  await guardAsyncAction(async () => {
    let success = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        await API.restoreArchive(row.module_key, row.id);
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success) {
      showToast(success === 1 ? '1 record restored.' : `${success} records restored.`);
    }
    if (failed) {
      showToast(failed === 1 ? '1 record could not be restored.' : `${failed} records could not be restored.`, 'error');
    }
    archiveTableSelection?.clearSelection();
    loadArchive();
  }, { loadingText: 'Restoring...', lockKey: 'bulk-restore-archive' });
}

function formatArchiveModule(module) {
  if (!module) return '—';
  return String(module).charAt(0).toUpperCase() + String(module).slice(1);
}

function renderArchiveTitle(item) {
  return item.title || 'Untitled';
}

function renderArchiveDetail(item) {
  const parts = [];
  if (item.detail) parts.push(item.detail);
  parts.push(`Archived by: ${item.archived_by_name || 'Unknown'}`);
  return parts.join(' · ');
}

async function loadArchive() {
  const el = document.getElementById('archiveList');
  const countEl = document.getElementById('archiveRecordCount');

  try {
    const filters = {
      search: document.getElementById('archiveSearch').value,
      module: document.getElementById('archiveModule').value
    };
    archiveItems = await fetchAllArchiveItems(filters);
    archiveTableSelection?.pruneHiddenSelections();

    if (!archiveItems.length) {
      el.innerHTML = '<div class="empty-state"><i class="bi bi-archive"></i>No archived records found</div>';
      countEl.hidden = true;
      countEl.textContent = '';
      archiveTableSelection?.bindAfterRender(el);
      return;
    }

    el.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            ${archiveTableSelection?.renderCheckboxHeader() || ''}
            <th class="col-code">Module</th>
            <th>Title</th>
            <th>Details</th>
            <th class="col-date">Archived</th>
            <th class="col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${archiveItems.map((item) => `
            <tr${archiveTableSelection?.renderRowAttrs(item) || ''}>
              ${archiveTableSelection?.renderCheckboxCell(item) || ''}
              <td>${formatArchiveModule(item.module)}</td>
              <td>${renderArchiveTitle(item)}</td>
              <td>${renderArchiveDetail(item)}</td>
              <td>${formatDate(item.archived_at)}</td>
              <td class="col-actions">${renderActionMenuCell(`archive-actions-${item.module_key}-${item.id}`, [
                { label: 'Restore', icon: 'bi-arrow-counterclockwise', handler: `restoreRecord('${item.module_key}', ${item.id})` }
              ])}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    countEl.hidden = false;
    countEl.textContent = `${archiveItems.length} archived record${archiveItems.length === 1 ? '' : 's'}`;
    finishTableRender(el);
    archiveTableSelection?.bindAfterRender(el);
  } catch (err) {
    showToast(err.message, 'error');
    el.innerHTML = '<div class="empty-state"><i class="bi bi-archive"></i>No archived records found</div>';
    countEl.hidden = true;
    countEl.textContent = '';
    archiveTableSelection?.bindAfterRender(el);
  }
}

async function restoreRecord(module, id) {
  if (!await confirmAction('Restore this record to its original module?')) return;
  await guardAsyncAction(async () => {
    try {
      const res = await API.restoreArchive(module, id);
      showToast(res?.message || 'The record has been restored successfully.');
      loadArchive();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, { loadingText: 'Processing...', lockKey: `restore-${module}-${id}` });
}

document.addEventListener('DOMContentLoaded', initArchivePage);
