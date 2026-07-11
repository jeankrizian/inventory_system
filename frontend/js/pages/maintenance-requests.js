let currentUser = null;
let records = [];
let pendingAction = null;
let maintainableItems = [];

async function initMaintenanceRequestsPage() {
  currentUser = await initLayout('maintenance-requests');
  if (!currentUser) return;

  document.getElementById('pageContent').innerHTML = `
    <div class="page-header">
      <h1>Maintenance Requests</h1>
      <p>Submit, review, and track asset maintenance requests</p>
    </div>
    <div class="content-card">
      <div class="content-card-header">
        <h3>All Requests</h3>
        ${canSubmitMaintenance(currentUser) ? `<button type="button" class="btn-primary-custom" id="submitMaintenanceBtn"><i class="bi bi-plus-lg"></i> Submit Request</button>` : ''}
      </div>
      <div class="filters-bar">
        <input type="text" class="form-control-custom" id="searchInput" placeholder="Search requests...">
        <select class="form-control-custom" id="filterStatus">
          <option value="">All Status</option>
          <option>Pending</option><option>Approved</option><option>Scheduled</option>
          <option>Ongoing</option><option>Completed</option><option>Cancelled</option>
        </select>
      </div>
      <div class="table-responsive" id="maintenanceContent"><div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div></div>
    </div>
  `;

  document.getElementById('submitMaintenanceBtn')?.addEventListener('click', openSubmitModal);

  document.getElementById('searchInput').addEventListener('input', debounce(loadRecords, 300));
  document.getElementById('filterStatus').addEventListener('change', loadRecords);
  bindGuardedFormSubmit(document.getElementById('actionForm'), submitAction, { loadingText: 'Processing...' });
  bindGuardedFormSubmit(document.getElementById('submitForm'), submitCreate, { loadingText: 'Submitting...' });
  document.getElementById('submitAssetId')?.addEventListener('change', onSubmitAssetChange);
  initActionMenus();

  if (canSubmitMaintenance(currentUser)) await loadMaintainableItems();

  const params = new URLSearchParams(window.location.search);
  const statusFilter = params.get('status');
  if (statusFilter && document.getElementById('filterStatus')) {
    document.getElementById('filterStatus').value = statusFilter;
  }

  await loadRecords();

  const recordId = params.get('id');
  if (recordId) viewRecord(parseInt(recordId, 10));

  initSearchableSelects(document);
}

async function loadMaintainableItems() {
  try {
    const res = await API.getInventory();
    maintainableItems = (res?.data || []).filter(i =>
      i.status === 'Available' && canMaintainAsset(i.asset_classification)
    );
  } catch (err) {
    showToast(err.message, 'error');
    maintainableItems = [];
  }
}

function onSubmitAssetChange() {
  const item = maintainableItems.find(i => i.id === parseInt(document.getElementById('submitAssetId').value, 10));
  document.getElementById('submitPropertyTag').value = item?.property_tag || '-';
  document.getElementById('submitDepartment').value = item?.department_name || item?.category_name || '-';
  document.getElementById('submitLocation').value = item?.location_name || '-';
}

async function openSubmitModal() {
  if (!canSubmitMaintenance(currentUser)) return;
  await loadMaintainableItems();
  const select = document.getElementById('submitAssetId');
  populateSelect(
    select,
    maintainableItems,
    'id',
    formatAssetOptionLabel,
    maintainableItems.length ? 'Select asset...' : 'No maintainable assets in your scope'
  );
  document.getElementById('submitPropertyTag').value = '';
  document.getElementById('submitDepartment').value = '';
  document.getElementById('submitLocation').value = '';
  document.getElementById('submitProblem').value = '';
  document.getElementById('submitType').value = 'Preventive';
  document.getElementById('submitPriority').value = 'Medium';
  document.getElementById('submitDate').value = '';
  document.getElementById('submitRequestedDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('submitNotes').value = '';
  refreshSearchableSelects(document.getElementById('submitModal'));
  openModal('submitModal');
}

async function submitCreate(e) {
  e.preventDefault();
  if (!canSubmitMaintenance(currentUser)) return;
  const assetId = parseInt(document.getElementById('submitAssetId').value, 10);
  if (!assetId) return showToast('Please select an asset', 'error');

  try {
    await API.createMaintenance({
      inventory_item_id: assetId,
      reported_problem: document.getElementById('submitProblem').value,
      maintenance_type: document.getElementById('submitType').value,
      priority: document.getElementById('submitPriority').value,
      scheduled_date: document.getElementById('submitDate').value,
      requested_date: document.getElementById('submitRequestedDate').value,
      notes: document.getElementById('submitNotes').value,
      description: document.getElementById('submitNotes').value
    });
    showToast('Maintenance request submitted');
    closeModal('submitModal');
    loadRecords();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadRecords() {
  const params = {};
  const search = document.getElementById('searchInput')?.value;
  const status = document.getElementById('filterStatus')?.value;
  if (search) params.search = search;
  if (status) params.status = status;

  try {
    const res = await API.getMaintenance(params);
    records = res?.data || [];
    renderRecords();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function canOperateMaintenanceActions() {
  return canOperateMaintenance(currentUser);
}

function renderMaintenanceActions(r) {
  const canOperate = canOperateMaintenanceActions();
  const items = [
    { label: 'View Details', icon: 'bi-eye', handler: `viewRecord(${r.id})` }
  ];

  if (canOperate && ['Pending', 'Approved', 'Scheduled'].includes(r.status)) {
    items.push({
      label: 'Reschedule',
      icon: 'bi-calendar-event',
      handler: `openAction(${r.id}, 'reschedule')`
    });
  }

  if (canOperate && ['Approved', 'Scheduled'].includes(r.status)) {
    items.push({
      label: 'Start',
      icon: 'bi-play-circle',
      handler: `openAction(${r.id}, 'start')`
    });
  }

  if (canOperate && ['Ongoing', 'In Progress', 'Approved', 'Scheduled'].includes(r.status)) {
    items.push({
      label: 'Complete',
      icon: 'bi-check-circle',
      handler: `openAction(${r.id}, 'complete')`
    });
  }

  if (r.status === 'Pending' && canOperateMaintenance(currentUser)) {
    items.push({
      label: 'Review in Pending Approvals',
      icon: 'bi-clipboard-check',
      href: '/pages/pending-approvals.html?tab=maintenance'
    });
  }

  return renderActionMenuCell(`maintenance-actions-${r.id}`, items);
}

function renderRecords() {
  const el = document.getElementById('maintenanceContent');
  if (!records.length) {
    el.innerHTML = '<div class="empty-state"><i class="bi bi-tools"></i>No maintenance requests.</div>';
    return;
  }

  el.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Code</th><th>Asset</th><th>Type</th><th>Priority</th><th>Scheduled</th>
            <th>Requested By</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${records.map(r => `
            <tr>
              <td>${r.transaction_code || `#${r.id}`}</td>
              <td>${r.item_name}</td>
              <td>${r.maintenance_type}</td>
              <td>${r.priority || '-'}</td>
              <td>${formatDate(r.scheduled_date)}</td>
              <td>${r.requested_by_name || '-'}</td>
              <td>${getStatusBadge(r.status)}</td>
              <td>${renderMaintenanceActions(r)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
  `;
  finishTableRender(el);
}

async function viewRecord(id) {
  try {
    const res = await API.getMaintenanceRecord(id);
    const r = res.data;
    await showDetailModal({
      title: 'Maintenance Details',
      bodyHtml: [
        renderDetailSection('General Information', [
          { label: 'Code', value: r.transaction_code || r.id },
          { label: 'Status', html: getStatusBadge(r.status) },
          { label: 'Asset', value: r.item_name, fullWidth: true },
          { label: 'Property Tag', value: r.property_tag },
          { label: 'Department', value: r.department_name },
          { label: 'Location', value: r.location_name }
        ]),
        renderDetailSection('Request Details', [
          { label: 'Problem', value: r.reported_problem || r.description, fullWidth: true, wrap: true },
          { label: 'Type', value: r.maintenance_type },
          { label: 'Priority', value: r.priority },
          { label: 'Scheduled', value: formatDate(r.scheduled_date) },
          { label: 'Requested By', value: r.requested_by_name }
        ]),
        renderDetailSection('Assignment & Remarks', [
          { label: 'Technician', value: r.technician || r.service_provider },
          { label: 'Admin Remarks', value: r.admin_remarks, fullWidth: true, wrap: true },
          { label: 'Completion Remarks', value: r.completion_remarks, fullWidth: true, wrap: true }
        ])
      ].join('')
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openAction(id, action) {
  pendingAction = { id, action };
  const titles = {
    reschedule: 'Reschedule Maintenance',
    start: 'Start Maintenance',
    complete: 'Mark as Completed'
  };
  document.getElementById('actionModalTitle').textContent = titles[action];

  let body = '';
  if (action === 'reschedule') {
    body = `
      <div class="form-group"><label>New Scheduled Date *</label><input type="date" class="form-control-custom" id="actionScheduledDate" required></div>
      <div class="form-group"><label>Technician (optional)</label><input type="text" class="form-control-custom" id="actionTechnician"></div>
      <div class="form-group"><label>Remarks</label><textarea class="form-control-custom" id="actionRemarks" rows="2"></textarea></div>
    `;
  } else if (action === 'start') {
    body = `<div class="form-group"><label>Technician (optional)</label><input type="text" class="form-control-custom" id="actionTechnician"></div>`;
  } else if (action === 'complete') {
    body = `
      <div class="form-group"><label>Completion Date</label><input type="date" class="form-control-custom" id="actionCompletedDate" value="${new Date().toISOString().split('T')[0]}"></div>
      <div class="form-group"><label>Completion Remarks</label><textarea class="form-control-custom" id="actionRemarks" rows="3"></textarea></div>
      <div class="form-group"><label>Next Maintenance Date</label><input type="date" class="form-control-custom" id="actionNextDate"></div>
    `;
  }

  document.getElementById('actionModalBody').innerHTML = body;
  openModal('actionModal');
}

async function submitAction(e) {
  e.preventDefault();
  if (!pendingAction) return;

  const { id, action } = pendingAction;
  try {
    if (action === 'reschedule') {
      await API.rescheduleMaintenance(id, {
        scheduled_date: document.getElementById('actionScheduledDate').value,
        technician: document.getElementById('actionTechnician')?.value || undefined,
        admin_remarks: document.getElementById('actionRemarks')?.value || undefined
      });
      showToast('Maintenance rescheduled');
    } else if (action === 'start') {
      await API.startMaintenance(id, { technician: document.getElementById('actionTechnician')?.value || undefined });
      showToast('Maintenance started');
    } else if (action === 'complete') {
      await API.completeMaintenance(id, {
        completed_date: document.getElementById('actionCompletedDate')?.value,
        completion_remarks: document.getElementById('actionRemarks')?.value || undefined,
        next_maintenance_date: document.getElementById('actionNextDate')?.value || undefined
      });
      showToast('Maintenance completed');
    }
    closeModal('actionModal');
    pendingAction = null;
    loadRecords();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', initMaintenanceRequestsPage);
