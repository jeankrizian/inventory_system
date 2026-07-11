function formatBackupSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatBackupDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function renderBackupSection(user) {
  if (!canViewBackups(user)) return '';

  const canManage = canManageBackups(user);
  return `
    <div class="content-card" id="backupRestoreSection">
      <h3 style="font-size:16px;margin-bottom:20px;">Backup & Restore</h3>
      ${canManage ? `
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:20px;">
        <button class="btn-primary-custom btn-sm-custom" type="button" id="createBackupBtn">
          <i class="bi bi-database-down"></i> Create Backup
        </button>
        <label class="btn-outline-custom btn-sm-custom" style="margin:0;cursor:pointer;">
          <i class="bi bi-upload"></i> Restore From File
          <input type="file" id="restoreBackupFile" accept=".sql" hidden>
        </label>
      </div>` : ''}
      <div class="table-responsive">
        <table class="data-table" id="backupHistoryTable">
          <thead>
            <tr>
              <th>Backup File Name</th>
              <th>Date & Time Created</th>
              <th>File Size</th>
              <th>Created By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="backupHistoryBody">
            <tr><td colspan="5">Loading backup history...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function loadBackupHistory() {
  const body = document.getElementById('backupHistoryBody');
  if (!body) return;

  try {
    const res = await API.getBackups();
    const backups = res?.data || [];
    const canManage = canManageBackups(currentSettingsUser);

    if (!backups.length) {
      body.innerHTML = '<tr><td colspan="5">No backups available.</td></tr>';
      return;
    }

    body.innerHTML = backups.map((backup) => `
      <tr>
        <td>${backup.file_name}</td>
        <td>${formatBackupDate(backup.created_at)}</td>
        <td>${formatBackupSize(backup.file_size)}</td>
        <td>${backup.created_by_name || '-'}</td>
        <td class="col-actions" style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn-outline-custom btn-sm-custom" type="button" onclick="downloadBackupFile(${backup.id})">
            <i class="bi bi-download"></i> Download
          </button>
          ${canManage ? `
          <button class="btn-outline-custom btn-sm-custom" type="button" onclick="restoreBackupFile(${backup.id}, '${backup.file_name.replace(/'/g, "\\'")}')">
            <i class="bi bi-arrow-counterclockwise"></i> Restore
          </button>
          <button class="btn-outline-custom btn-sm-custom" type="button" onclick="deleteBackupFile(${backup.id}, '${backup.file_name.replace(/'/g, "\\'")}')">
            <i class="bi bi-trash"></i> Delete
          </button>` : ''}
        </td>
      </tr>
    `).join('');
    finishTableRender(body.closest('.table-responsive'));
  } catch (err) {
    body.innerHTML = `<tr><td colspan="5">${err.message || 'Unable to load backup history.'}</td></tr>`;
  }
}

let currentSettingsUser = null;

async function createBackup() {
  const btn = document.getElementById('createBackupBtn');
  await withSubmitGuard(btn, async () => {
    try {
      const res = await API.createBackup();
      showToast(res?.message || 'Backup created successfully.');
      await loadBackupHistory();
      if (res?.data?.id) {
        API.downloadBackup(res.data.id);
      }
    } catch (err) {
      showToast(err.message || 'Unable to create backup.', 'error');
    }
  }, { loadingText: 'Processing...' });
}

function downloadBackupFile(id) {
  API.downloadBackup(id);
}

async function deleteBackupFile(id, fileName) {
  if (!await confirmAction(`Delete backup "${fileName}"?`, { variant: 'danger', title: 'Delete Backup', confirmText: 'Delete' })) return;

  await guardAsyncAction(async () => {
    try {
      const res = await API.deleteBackup(id);
      showToast(res?.message || 'Backup deleted successfully.');
      await loadBackupHistory();
    } catch (err) {
      showToast(err.message || 'Unable to delete backup.', 'error');
    }
  }, { loadingText: 'Deleting...', lockKey: `delete-backup-${id}` });
}

async function restoreBackupFile(id, fileName) {
  if (!await confirmAction(`Restore database from "${fileName}"? This will overwrite current data.`, { variant: 'danger', title: 'Restore Database', confirmText: 'Restore' })) return;

  await guardAsyncAction(async () => {
    try {
      const res = await API.restoreBackup(id);
      showToast(res?.message || 'Database restored successfully.');
      await loadBackupHistory();
    } catch (err) {
      showToast(err.message || 'Unable to restore backup.', 'error');
    }
  }, { loadingText: 'Processing...', lockKey: `restore-backup-${id}` });
}

async function restoreBackupFromUpload(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.sql')) {
    showToast('Please select a valid .sql backup file.', 'error');
    return;
  }

  if (!await confirmAction(`Restore database from "${file.name}"? This will overwrite current data.`, { variant: 'danger', title: 'Restore Database', confirmText: 'Restore' })) {
    document.getElementById('restoreBackupFile').value = '';
    return;
  }

  await guardAsyncAction(async () => {
    try {
      const content = await file.text();
      const res = await API.restoreBackupUpload(content);
      showToast(res?.message || 'Database restored successfully.');
      await loadBackupHistory();
    } catch (err) {
      showToast(err.message || 'Unable to restore backup.', 'error');
    } finally {
      const input = document.getElementById('restoreBackupFile');
      if (input) input.value = '';
    }
  }, { loadingText: 'Processing...', lockKey: 'restore-backup-upload' });
}

function bindBackupEvents(user) {
  if (!canViewBackups(user)) return;

  document.getElementById('createBackupBtn')?.addEventListener('click', createBackup);
  document.getElementById('restoreBackupFile')?.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (file) restoreBackupFromUpload(file);
  });
}

async function initSettingsPage() {
  const user = await initLayout('settings');
  if (!user) return;
  currentSettingsUser = user;

  document.getElementById('pageContent').innerHTML = `
    <div class="page-header">
      <h1>Settings</h1>
      <p>Account and system settings</p>
    </div>
    <div class="content-card">
      <h3 style="font-size:16px;margin-bottom:20px;">Profile Information</h3>
      <div style="display:flex;align-items:center;gap:20px;margin-bottom:24px;">
        <div class="profile-avatar" style="width:64px;height:64px;font-size:22px;">${getInitials(user.full_name)}</div>
        <div>
          <h4 style="font-size:16px;">${user.full_name}</h4>
          <p style="color:var(--text-secondary);font-size:13px;">${user.email}</p>
          <span class="badge badge-available" style="margin-top:4px;">${formatRoleDisplayName(user)}</span>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Username</label><input type="text" class="form-control-custom" value="${user.username}" disabled></div>
        <div class="form-group"><label>Email</label><input type="email" class="form-control-custom" value="${user.email}" disabled></div>
      </div>
    </div>
    ${renderBackupSection(user)}
  `;

  bindBackupEvents(user);
  await loadBackupHistory();
}

document.addEventListener('DOMContentLoaded', initSettingsPage);
