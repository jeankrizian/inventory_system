let currentUser = null;
let activeTab = 'all';
let pendingBorrows = [];
let pendingTransfers = [];
let pendingMaintenance = [];
let pendingDisposals = [];
let pendingAction = null;

const DISPOSAL_METHODS = ['Auction', 'Donation', 'Recycling', 'Destruction', 'Trade-In', 'Other'];

function asApprovalList(res) {
  if (!res) return [];
  const data = res.data;
  return Array.isArray(data) ? data : [];
}

function cell(value) {
  if (value == null || value === '') return '�';
  return escapeHtml(value);
}

const MODULE_LINKS = {
  borrow: '/pages/orders.html',
  transfer: '/pages/transfer-requests.html',
  maintenance: '/pages/maintenance-requests.html',
  disposal: '/pages/disposal-requests.html'
};

async function initPendingApprovalsPage() {
  currentUser = await initLayout('pending-approvals');
  if (!currentUser) return;

  if (!canViewPendingApprovalsDashboard(currentUser)) {
    denyPageAccess('Pending Approvals is available to Property Managers only.');
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  if (['all', 'borrow', 'maintenance', 'transfer', 'disposal'].includes(tab)) {
    activeTab = tab;
  }

  document.getElementById('pageContent').innerHTML = `
    <div class="page-header">
      <h1>Pending Approvals</h1>
      <p>Review and action borrow, maintenance, transfer, and disposal requests in one place</p>
    </div>
    <div class="content-card">
      <div class="content-card-header">
        <div class="nav-tabs-custom" style="border:none;margin:0;" id="approvalTabs"></div>
        <button class="btn-outline-custom btn-sm-custom" type="button" onclick="guardClick(event, loadPendingApprovals, 'Processing...')">
          <i class="bi bi-arrow-repeat"></i> Refresh
        </button>
      </div>
      <div class="table-responsive" id="approvalContent">
        <div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div>
      </div>
    </div>
  `;

  document.getElementById('actionForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = document.getElementById('actionModalSubmit');
    withSubmitGuard(btn, () => submitApprovalAction(e), { loadingText: getApprovalSubmitLoadingText() });
  });
  initActionMenus();
  await loadPendingApprovals();
}

function getApprovalSubmitLoadingText() {
  if (!pendingAction) return 'Processing...';
  const { action } = pendingAction;
  if (action === 'approve') return 'Approving...';
  if (action === 'reject') return 'Rejecting...';
  if (action === 'inspect') return 'Inspecting...';
  return 'Processing...';
}

function renderApprovalTabs() {
  const counts = {
    all: pendingBorrows.length + pendingTransfers.length + pendingMaintenance.length + pendingDisposals.length,
    borrow: pendingBorrows.length,
    maintenance: pendingMaintenance.length,
    transfer: pendingTransfers.length,
    disposal: pendingDisposals.length
  };

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'borrow', label: 'Borrow' },
    { key: 'maintenance', label: 'Maintenance' },
    { key: 'transfer', label: 'Transfer' },
    { key: 'disposal', label: 'Disposal' }
  ];

  document.getElementById('approvalTabs').innerHTML = tabs.map((tab) => `
    <button type="button" class="nav-tab-custom ${activeTab === tab.key ? 'active' : ''}" data-tab="${tab.key}">
      ${tab.label}${counts[tab.key] ? ` (${counts[tab.key]})` : ''}
    </button>
  `).join('');

  document.querySelectorAll('#approvalTabs .nav-tab-custom').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      renderApprovalTabs();
      renderApprovalTable();
    });
  });
}

async function loadPendingApprovals() {
  const el = document.getElementById('approvalContent');
  if (el) el.innerHTML = '<div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div>';

  try {
    const [borrowRes, transferRes, maintenanceRes, disposalPendingRes, disposalInspectedRes] = await Promise.all([
      API.getBorrows({ status: 'Pending' }),
      API.getTransfers({ status: 'Pending' }),
      API.getMaintenance({ status: 'Pending' }),
      API.getDisposals({ status: 'Pending' }),
      API.getDisposals({ status: 'Inspected' })
    ]);

    pendingBorrows = asApprovalList(borrowRes);
    pendingTransfers = asApprovalList(transferRes);
    pendingMaintenance = asApprovalList(maintenanceRes);
    pendingDisposals = [
      ...asApprovalList(disposalPendingRes),
      ...asApprovalList(disposalInspectedRes)
    ];

    renderApprovalTabs();
    renderApprovalTable();
  } catch (err) {
    if (el) el.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
    showToast(err.message, 'error');
  }
}

function getVisibleApprovalRows() {
  const rows = [];

  if (activeTab === 'all' || activeTab === 'borrow') {
    pendingBorrows.forEach((item) => {
      rows.push({
        module: 'borrow',
        id: item.id,
        item: item.item_names || item.purpose || '—',
        propertyTag: item.property_tags || item.property_tag || '—',
        requester: item.borrower_name,
        department: item.borrower_department || '—',
        date: item.borrow_date || item.created_at,
        status: item.status,
        raw: item
      });
    });
  }

  if (activeTab === 'all' || activeTab === 'maintenance') {
    pendingMaintenance.forEach((item) => {
      rows.push({
        module: 'maintenance',
        id: item.id,
        item: item.item_name,
        propertyTag: item.property_tag || '—',
        requester: item.requested_by_name || '—',
        department: item.department_name || '—',
        date: item.scheduled_date || item.created_at,
        status: item.status,
        raw: item
      });
    });
  }

  if (activeTab === 'all' || activeTab === 'transfer') {
    pendingTransfers.forEach((item) => {
      rows.push({
        module: 'transfer',
        id: item.id,
        item: item.item_name,
        propertyTag: item.property_tag || '—',
        requester: item.requested_by_name || '—',
        department: `${item.from_department_name || '—'} → ${item.to_department_name || '—'}`,
        date: item.request_date || item.created_at,
        status: item.status,
        raw: item
      });
    });
  }

  if (activeTab === 'all' || activeTab === 'disposal') {
    pendingDisposals.forEach((item) => {
      rows.push({
        module: 'disposal',
        id: item.id,
        item: item.item_name,
        propertyTag: item.property_tag || '—',
        requester: item.requested_by_name || '—',
        department: item.department_name || '—',
        date: item.created_at,
        status: item.status,
        raw: item
      });
    });
  }

  return rows.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

function renderApprovalActions(row) {
  const viewLink = `${MODULE_LINKS[row.module]}?id=${row.id}`;
  const items = [
    { label: 'View Details', icon: 'bi-eye', handler: `window.location.href='${viewLink}'` }
  ];

  if (row.module === 'borrow') {
    items.push(
      { label: 'Approve', icon: 'bi-check-circle', handler: `approveBorrowRequest(${row.id})` },
      { label: 'Reject', icon: 'bi-x-circle', danger: true, handler: `rejectBorrowRequest(${row.id})` }
    );
  } else if (row.module === 'transfer') {
    items.push(
      { label: 'Approve', icon: 'bi-check-circle', handler: `approveTransferRequest(${row.id})` },
      { label: 'Reject', icon: 'bi-x-circle', danger: true, handler: `openTransferReject(${row.id})` }
    );
  } else if (row.module === 'maintenance') {
    items.push(
      { label: 'Approve', icon: 'bi-check-circle', handler: `openMaintenanceApprove(${row.id})` },
      { label: 'Reject', icon: 'bi-x-circle', danger: true, handler: `openMaintenanceReject(${row.id})` }
    );
  } else if (row.module === 'disposal') {
    if (row.status === 'Pending') {
      items.push(
        { label: 'Inspect', icon: 'bi-search', handler: `openDisposalInspect(${row.id})` },
        { label: 'Reject', icon: 'bi-x-circle', danger: true, handler: `openDisposalReject(${row.id})` }
      );
    } else if (row.status === 'Inspected') {
      items.push(
        { label: 'Approve', icon: 'bi-check-circle', handler: `openDisposalApprove(${row.id})` },
        { label: 'Reject', icon: 'bi-x-circle', danger: true, handler: `openDisposalReject(${row.id})` }
      );
    }
  }

  return renderActionMenuCell(`approval-actions-${row.module}-${row.id}`, items);
}

function renderApprovalTable() {
  const el = document.getElementById('approvalContent');
  const rows = getVisibleApprovalRows();

  if (!rows.length) {
    el.innerHTML = '<div class="empty-state"><i class="bi bi-clipboard-check"></i>No pending approvals in this view.</div>';
    return;
  }

  const showModule = activeTab === 'all';

  el.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          ${showModule ? '<th>Type</th>' : ''}
          <th>Item</th><th>Property Tag</th><th>Requester</th><th>Department</th><th>Date</th><th>Status</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            ${showModule ? `<td>${escapeHtml(formatModuleLabel(row.module))}</td>` : ''}
            <td>${cell(row.item)}</td>
            <td>${cell(row.propertyTag)}</td>
            <td>${cell(row.requester)}</td>
            <td>${cell(row.department)}</td>
            <td>${formatDate(row.date)}</td>
            <td>${getStatusBadge(row.status)}</td>
            <td>${renderApprovalActions(row)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  finishTableRender(el);
}

function formatModuleLabel(module) {
  const labels = {
    borrow: 'Borrow',
    maintenance: 'Maintenance',
    transfer: 'Transfer',
    disposal: 'Disposal'
  };
  return labels[module] || module;
}

async function approveBorrowRequest(id) {
  if (!await confirmAction('Approve this borrow request?', { title: 'Approve Borrow', confirmText: 'Approve', variant: 'success' })) return;
  await guardAsyncAction(async () => {
    try {
      const res = await API.approveBorrow(id);
      showToast('Borrow approved');
      openGeneratedDocument(res?.data?.generated_document, 'ABL');
      await loadPendingApprovals();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, { loadingText: 'Approving...', lockKey: `borrow-approve-${id}` });
}

async function rejectBorrowRequest(id) {
  if (!await confirmAction('Reject this borrow request?', { title: 'Reject Borrow', confirmText: 'Reject', variant: 'danger' })) return;
  await guardAsyncAction(async () => {
    try {
      await API.rejectBorrow(id);
      showToast('Borrow rejected');
      await loadPendingApprovals();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, { loadingText: 'Rejecting...', lockKey: `borrow-reject-${id}` });
}

async function approveTransferRequest(id) {
  if (!await confirmAction('Approve this transfer? The asset department and location will be updated immediately.', { title: 'Approve Transfer', confirmText: 'Approve', variant: 'success' })) return;
  await guardAsyncAction(async () => {
    try {
      const res = await API.approveTransfer(id);
      showToast('Transfer approved');
      openGeneratedDocument(res?.data?.generated_document, 'TRF');
      await loadPendingApprovals();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, { loadingText: 'Approving...', lockKey: `transfer-approve-${id}` });
}

function openTransferReject(id) {
  pendingAction = { module: 'transfer', id, action: 'reject' };
  document.getElementById('actionModalTitle').textContent = 'Reject Transfer';
  document.getElementById('actionModalSubmit').textContent = 'Reject';
  document.getElementById('actionModalBody').innerHTML = `
    <div class="form-group"><label>Rejection Reason *</label><textarea class="form-control-custom" id="actionReason" rows="3" required></textarea></div>
  `;
  openModal('actionModal');
}

function openMaintenanceApprove(id) {
  pendingAction = { module: 'maintenance', id, action: 'approve' };
  document.getElementById('actionModalTitle').textContent = 'Approve Maintenance';
  document.getElementById('actionModalSubmit').textContent = 'Approve';
  document.getElementById('actionModalBody').innerHTML = `
    <div class="form-group"><label>Scheduled Date</label><input type="date" class="form-control-custom" id="actionScheduledDate"></div>
    <div class="form-group"><label>Assign Technician (optional)</label><input type="text" class="form-control-custom" id="actionTechnician"></div>
    <div class="form-group"><label>Remarks</label><textarea class="form-control-custom" id="actionRemarks" rows="2"></textarea></div>
  `;
  openModal('actionModal');
}

function openMaintenanceReject(id) {
  pendingAction = { module: 'maintenance', id, action: 'reject' };
  document.getElementById('actionModalTitle').textContent = 'Reject Maintenance';
  document.getElementById('actionModalSubmit').textContent = 'Reject';
  document.getElementById('actionModalBody').innerHTML = `
    <div class="form-group"><label>Rejection Reason *</label><textarea class="form-control-custom" id="actionReason" rows="3" required></textarea></div>
  `;
  openModal('actionModal');
}

function openDisposalInspect(id) {
  pendingAction = { module: 'disposal', id, action: 'inspect' };
  document.getElementById('actionModalTitle').textContent = 'Inspect Disposal Request';
  document.getElementById('actionModalSubmit').textContent = 'Record Inspection';
  document.getElementById('actionModalBody').innerHTML = `
    <div class="form-group">
      <label>Inspection Notes *</label>
      <textarea class="form-control-custom" id="actionInspectionNotes" rows="4" required placeholder="Record inspection findings and recommendation..."></textarea>
    </div>
  `;
  openModal('actionModal');
}

function openDisposalApprove(id) {
  pendingAction = { module: 'disposal', id, action: 'approve' };
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('actionModalTitle').textContent = 'Approve Disposal';
  document.getElementById('actionModalSubmit').textContent = 'Approve Disposal';
  document.getElementById('actionModalBody').innerHTML = `
    <div class="form-group">
      <label>Disposal Method *</label>
      <select class="form-control-custom" id="actionDisposalMethod" required>
        <option value="">Select method</option>
        ${DISPOSAL_METHODS.map((method) => `<option>${method}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Disposal Date *</label>
      <input type="date" class="form-control-custom" id="actionDisposalDate" value="${today}" required>
    </div>
    <div class="form-group">
      <label>Notes</label>
      <textarea class="form-control-custom" id="actionNotes" rows="2" placeholder="Optional remarks..."></textarea>
    </div>
  `;
  refreshSearchableSelects(document.getElementById('actionModal'));
  openModal('actionModal');
}

function openDisposalReject(id) {
  pendingAction = { module: 'disposal', id, action: 'reject' };
  document.getElementById('actionModalTitle').textContent = 'Reject Disposal Request';
  document.getElementById('actionModalSubmit').textContent = 'Reject';
  document.getElementById('actionModalBody').innerHTML = `
    <div class="form-group">
      <label>Rejection Reason *</label>
      <textarea class="form-control-custom" id="actionReason" rows="3" required></textarea>
    </div>
  `;
  openModal('actionModal');
}

async function submitApprovalAction(e) {
  if (!pendingAction) return;

  const { module, id, action } = pendingAction;

  try {
    if (module === 'transfer' && action === 'reject') {
      const rejection_reason = document.getElementById('actionReason')?.value?.trim();
      if (!rejection_reason) return showToast('Rejection reason is required', 'error');
      await API.rejectTransfer(id, { rejection_reason });
      showToast('Transfer rejected');
    } else if (module === 'maintenance' && action === 'approve') {
      await API.approveMaintenance(id, {
        scheduled_date: document.getElementById('actionScheduledDate')?.value || undefined,
        technician: document.getElementById('actionTechnician')?.value || undefined,
        admin_remarks: document.getElementById('actionRemarks')?.value || undefined
      });
      showToast('Maintenance approved');
    } else if (module === 'maintenance' && action === 'reject') {
      const rejection_reason = document.getElementById('actionReason')?.value?.trim();
      if (!rejection_reason) return showToast('Rejection reason is required', 'error');
      await API.rejectMaintenance(id, { rejection_reason });
      showToast('Maintenance rejected');
    } else if (module === 'disposal' && action === 'inspect') {
      const inspection_notes = document.getElementById('actionInspectionNotes')?.value?.trim();
      if (!inspection_notes) return showToast('Inspection notes are required', 'error');
      await API.inspectDisposal(id, { inspection_notes });
      showToast('Inspection recorded');
    } else if (module === 'disposal' && action === 'approve') {
      const disposal_method = document.getElementById('actionDisposalMethod')?.value;
      const disposal_date = document.getElementById('actionDisposalDate')?.value;
      const notes = document.getElementById('actionNotes')?.value?.trim();
      if (!disposal_method) return showToast('Disposal method is required', 'error');
      if (!disposal_date) return showToast('Disposal date is required', 'error');
      const res = await API.approveDisposal(id, { disposal_method, disposal_date, notes });
      showToast('Disposal approved');
      openGeneratedDocument(res?.data?.generated_document, 'RDF');
    } else if (module === 'disposal' && action === 'reject') {
      const rejection_reason = document.getElementById('actionReason')?.value?.trim();
      if (!rejection_reason) return showToast('Rejection reason is required', 'error');
      await API.rejectDisposal(id, { rejection_reason });
      showToast('Disposal rejected');
    }

    closeModal('actionModal');
    pendingAction = null;
    await loadPendingApprovals();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', initPendingApprovalsPage);
