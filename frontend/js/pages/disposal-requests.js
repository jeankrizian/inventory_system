let currentUser = null;
let disposals = [];
let pendingAction = null;

const DISPOSAL_METHODS = ['Auction', 'Donation', 'Recycling', 'Destruction', 'Trade-In', 'Other'];

async function initDisposalRequestsPage() {
  currentUser = await initLayout('disposal-requests');
  if (!currentUser) return;

  document.getElementById('pageContent').innerHTML = `
    <div class="page-header">
      <h1>Disposal Requests</h1>
      <p>Review, inspect, and approve asset disposal requests</p>
    </div>
    <div class="content-card">
      <div class="content-card-header">
        <h3>All Requests</h3>
      </div>
      <div class="filters-bar">
        <input type="text" class="form-control-custom" id="searchInput" placeholder="Search disposals...">
        <select class="form-control-custom" id="filterStatus">
          <option value="">All Status</option>
          <option>Pending</option>
          <option>Inspected</option>
          <option>Completed</option>
          <option>Rejected</option>
        </select>
      </div>
      <div id="disposalContent"><div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div></div>
    </div>
  `;

  document.getElementById('searchInput').addEventListener('input', debounce(loadDisposals, 300));
  document.getElementById('filterStatus').addEventListener('change', loadDisposals);
  document.getElementById('actionForm').addEventListener('submit', submitAction);
  await loadDisposals();
}

async function loadDisposals() {
  const params = {};
  const search = document.getElementById('searchInput')?.value;
  const status = document.getElementById('filterStatus')?.value;
  if (search) params.search = search;
  if (status) params.status = status;

  try {
    const res = await API.getDisposals(params);
    disposals = res?.data || [];
    renderDisposals();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function isAdmin() {
  return isAdminUser(currentUser);
}

function renderDisposals() {
  const el = document.getElementById('disposalContent');
  if (!disposals.length) {
    el.innerHTML = '<div class="empty-state"><i class="bi bi-trash3"></i>No disposal requests</div>';
    return;
  }

  el.innerHTML = `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Code</th><th>Asset</th><th>Property Tag</th><th>Qty</th>
            <th>Requested By</th><th>Request Date</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${disposals.map(d => `
            <tr>
              <td>${d.transaction_code}</td>
              <td>${d.item_name}</td>
              <td>${d.property_tag || '-'}</td>
              <td>${d.quantity}</td>
              <td>${d.requested_by_name}</td>
              <td>${formatDate(d.created_at)}</td>
              <td>${getStatusBadge(d.status)}</td>
              <td style="white-space:nowrap;">
                <button class="btn-icon" onclick="viewDisposal(${d.id})" title="View"><i class="bi bi-eye"></i></button>
                ${isAdmin() && d.status === 'Pending' ? `
                  <button class="btn-outline-custom btn-sm-custom" onclick="openInspect(${d.id})">Inspect</button>
                  <button class="btn-danger-custom btn-sm-custom" onclick="openReject(${d.id})">Reject</button>
                ` : ''}
                ${isAdmin() && d.status === 'Inspected' ? `
                  <button class="btn-success-custom btn-sm-custom" onclick="openApprove(${d.id})">Approve</button>
                  <button class="btn-danger-custom btn-sm-custom" onclick="openReject(${d.id})">Reject</button>
                ` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function viewDisposal(id) {
  try {
    const res = await API.getDisposal(id);
    const d = res.data;
    alert([
      `Code: ${d.transaction_code}`,
      `Asset: ${d.item_name} (${d.item_code})`,
      `Property Tag: ${d.property_tag || '-'}`,
      `Department: ${d.department_name || '-'}`,
      `Quantity: ${d.quantity}`,
      `Reason: ${d.reason}`,
      `Requested By: ${d.requested_by_name}`,
      `Request Date: ${formatDate(d.created_at)}`,
      `Status: ${d.status}`,
      `Inspection Notes: ${d.inspection_notes || '-'}`,
      `Inspected By: ${d.inspected_by_name || '-'}`,
      `Disposal Method: ${d.disposal_method || '-'}`,
      `Disposal Date: ${formatDate(d.disposal_date)}`,
      `Approved By: ${d.approved_by_name || '-'}`,
      `Notes: ${d.notes || '-'}`
    ].join('\n'));
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openInspect(id) {
  pendingAction = { id, action: 'inspect' };
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

function openApprove(id) {
  pendingAction = { id, action: 'approve' };
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('actionModalTitle').textContent = 'Approve Disposal';
  document.getElementById('actionModalSubmit').textContent = 'Approve Disposal';
  document.getElementById('actionModalBody').innerHTML = `
    <div class="form-group">
      <label>Disposal Method *</label>
      <select class="form-control-custom" id="actionDisposalMethod" required>
        <option value="">Select method</option>
        ${DISPOSAL_METHODS.map(m => `<option>${m}</option>`).join('')}
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
    <p style="font-size:0.875rem;color:var(--text-muted);margin:0;">
      Approving will update inventory, mark the asset as disposed, and update the RDF document.
    </p>
  `;
  openModal('actionModal');
}

function openReject(id) {
  pendingAction = { id, action: 'reject' };
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

async function submitAction(e) {
  e.preventDefault();
  if (!pendingAction) return;

  try {
    if (pendingAction.action === 'inspect') {
      const inspection_notes = document.getElementById('actionInspectionNotes')?.value?.trim();
      if (!inspection_notes) return showToast('Inspection notes are required', 'error');
      await API.inspectDisposal(pendingAction.id, { inspection_notes });
      showToast('Inspection recorded');
    } else if (pendingAction.action === 'approve') {
      const disposal_method = document.getElementById('actionDisposalMethod')?.value;
      const disposal_date = document.getElementById('actionDisposalDate')?.value;
      const notes = document.getElementById('actionNotes')?.value?.trim();
      if (!disposal_method) return showToast('Disposal method is required', 'error');
      if (!disposal_date) return showToast('Disposal date is required', 'error');
      const res = await API.approveDisposal(pendingAction.id, { disposal_method, disposal_date, notes });
      showToast('Disposal approved');
      openGeneratedDocument(res?.data?.generated_document, 'RDF');
    } else if (pendingAction.action === 'reject') {
      const rejection_reason = document.getElementById('actionReason')?.value?.trim();
      if (!rejection_reason) return showToast('Rejection reason is required', 'error');
      await API.rejectDisposal(pendingAction.id, { rejection_reason });
      showToast('Disposal rejected');
    }

    closeModal('actionModal');
    pendingAction = null;
    loadDisposals();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', initDisposalRequestsPage);
