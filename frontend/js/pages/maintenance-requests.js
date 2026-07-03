let currentUser = null;
let records = [];
let pendingAction = null;

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
      </div>
      <div class="filters-bar">
        <input type="text" class="form-control-custom" id="searchInput" placeholder="Search requests...">
        <select class="form-control-custom" id="filterStatus">
          <option value="">All Status</option>
          <option>Pending</option><option>Approved</option><option>Scheduled</option>
          <option>Ongoing</option><option>Completed</option><option>Cancelled</option>
        </select>
      </div>
      <div id="maintenanceContent"><div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div></div>
    </div>
  `;

  document.getElementById('searchInput').addEventListener('input', debounce(loadRecords, 300));
  document.getElementById('filterStatus').addEventListener('change', loadRecords);
  document.getElementById('actionForm').addEventListener('submit', submitAction);
  await loadRecords();
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

function isAdmin() {
  return isAdminUser(currentUser);
}

function renderRecords() {
  const el = document.getElementById('maintenanceContent');
  if (!records.length) {
    el.innerHTML = '<div class="empty-state"><i class="bi bi-tools"></i>No maintenance requests</div>';
    return;
  }

  el.innerHTML = `
    <div class="table-responsive">
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
              <td style="white-space:nowrap;">
                <button class="btn-icon" onclick="viewRecord(${r.id})" title="View"><i class="bi bi-eye"></i></button>
                ${isAdmin() && r.status === 'Pending' ? `
                  <button class="btn-success-custom btn-sm-custom" onclick="openAction(${r.id}, 'approve')">Approve</button>
                  <button class="btn-danger-custom btn-sm-custom" onclick="openAction(${r.id}, 'reject')">Reject</button>
                ` : ''}
                ${isAdmin() && ['Pending', 'Approved', 'Scheduled'].includes(r.status) ? `
                  <button class="btn-outline-custom btn-sm-custom" onclick="openAction(${r.id}, 'reschedule')">Reschedule</button>
                ` : ''}
                ${isAdmin() && ['Approved', 'Scheduled'].includes(r.status) ? `
                  <button class="btn-primary-custom btn-sm-custom" onclick="openAction(${r.id}, 'start')">Start</button>
                ` : ''}
                ${isAdmin() && ['Ongoing', 'In Progress', 'Approved', 'Scheduled'].includes(r.status) ? `
                  <button class="btn-success-custom btn-sm-custom" onclick="openAction(${r.id}, 'complete')">Complete</button>
                ` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function viewRecord(id) {
  try {
    const res = await API.getMaintenanceRecord(id);
    const r = res.data;
    alert([
      `Code: ${r.transaction_code || r.id}`,
      `Asset: ${r.item_name}`,
      `Property Tag: ${r.property_tag || '-'}`,
      `Department: ${r.department_name || '-'}`,
      `Location: ${r.location_name || '-'}`,
      `Problem: ${r.reported_problem || r.description || '-'}`,
      `Type: ${r.maintenance_type}`,
      `Priority: ${r.priority || '-'}`,
      `Scheduled: ${formatDate(r.scheduled_date)}`,
      `Requested By: ${r.requested_by_name || '-'}`,
      `Technician: ${r.technician || r.service_provider || '-'}`,
      `Status: ${r.status}`,
      `Admin Remarks: ${r.admin_remarks || '-'}`,
      `Completion Remarks: ${r.completion_remarks || '-'}`
    ].join('\n'));
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openAction(id, action) {
  pendingAction = { id, action };
  const titles = {
    approve: 'Approve Maintenance',
    reject: 'Reject Maintenance',
    reschedule: 'Reschedule Maintenance',
    start: 'Start Maintenance',
    complete: 'Mark as Completed'
  };
  document.getElementById('actionModalTitle').textContent = titles[action];

  let body = '';
  if (action === 'approve') {
    body = `
      <div class="form-group"><label>Scheduled Date</label><input type="date" class="form-control-custom" id="actionScheduledDate"></div>
      <div class="form-group"><label>Assign Technician (optional)</label><input type="text" class="form-control-custom" id="actionTechnician"></div>
      <div class="form-group"><label>Remarks</label><textarea class="form-control-custom" id="actionRemarks" rows="2"></textarea></div>
    `;
  } else if (action === 'reject') {
    body = `<div class="form-group"><label>Rejection Reason *</label><textarea class="form-control-custom" id="actionReason" rows="3" required></textarea></div>`;
  } else if (action === 'reschedule') {
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
    if (action === 'approve') {
      await API.approveMaintenance(id, {
        scheduled_date: document.getElementById('actionScheduledDate')?.value || undefined,
        technician: document.getElementById('actionTechnician')?.value || undefined,
        admin_remarks: document.getElementById('actionRemarks')?.value || undefined
      });
      showToast('Maintenance approved');
    } else if (action === 'reject') {
      const reason = document.getElementById('actionReason').value;
      if (!reason) return showToast('Rejection reason is required', 'error');
      await API.rejectMaintenance(id, { rejection_reason: reason });
      showToast('Maintenance rejected');
    } else if (action === 'reschedule') {
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
