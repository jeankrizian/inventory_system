let currentUser = null;
let transfers = [];
let pendingAction = null;
let transferableItems = [];
let departments = [];
let locations = [];

async function initTransferRequestsPage() {
  currentUser = await initLayout('transfer-requests');
  if (!currentUser) return;

  const transferSubtitle = canOperateTransfers(currentUser)
    ? 'Review and manage asset transfer requests'
    : canSubmitTransfer(currentUser)
      ? 'Submit and track asset transfer requests'
      : 'Track transfer requests';

  document.getElementById('pageContent').innerHTML = `
    <div class="page-header">
      <h1>Transfer Requests</h1>
      <p>${transferSubtitle}</p>
    </div>
    <div class="content-card">
      <div class="content-card-header">
        <h3>All Requests</h3>
        ${canSubmitTransfer(currentUser) ? `<button class="btn-primary-custom" onclick="openSubmitModal()"><i class="bi bi-plus-lg"></i> Submit Request</button>` : ''}
      </div>
      <div class="filters-bar">
        <input type="text" class="form-control-custom" id="searchInput" placeholder="Search transfers...">
        <select class="form-control-custom" id="filterStatus">
          <option value="">All Status</option>
          <option>Pending</option><option>Approved</option><option>Rejected</option>
        </select>
      </div>
      <div class="table-responsive" id="transferContent"><div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div></div>
    </div>
  `;

  document.getElementById('searchInput').addEventListener('input', debounce(loadTransfers, 300));
  document.getElementById('filterStatus').addEventListener('change', loadTransfers);
  document.getElementById('actionForm').addEventListener('submit', submitAction);
  document.getElementById('submitForm')?.addEventListener('submit', submitCreate);
  document.getElementById('submitAssetId')?.addEventListener('change', onSubmitAssetChange);

  if (canSubmitTransfer(currentUser)) await loadTransferDropdowns();
  await loadTransfers();

  const params = new URLSearchParams(window.location.search);
  const transferId = params.get('id');
  if (transferId) viewTransfer(parseInt(transferId, 10));
}

async function loadTransferDropdowns() {
  try {
    const [deptRes, locRes] = await Promise.all([API.getCategories(), API.getLocations()]);
    departments = deptRes?.data || [];
    locations = locRes?.data || [];
    populateSelect(document.getElementById('submitToDepartment'), departments);
    populateSelect(document.getElementById('submitToLocation'), locations);
  } catch (err) {
    showToast(err.message, 'error');
    departments = [];
    locations = [];
  }
}

async function loadTransferableItems() {
  try {
    const res = await API.getInventory();
    transferableItems = (res?.data || []).filter(i =>
      i.status !== 'Disposed' && canTransferAsset(i.asset_classification)
    );
  } catch (err) {
    showToast(err.message, 'error');
    transferableItems = [];
  }
}

function onSubmitAssetChange() {
  const item = transferableItems.find(i => i.id === parseInt(document.getElementById('submitAssetId').value, 10));
  document.getElementById('submitPropertyTag').value = item?.property_tag || '-';
  document.getElementById('submitDepartment').value = item?.department_name || item?.category_name || '-';
  document.getElementById('submitLocation').value = item?.location_name || '-';
}

async function openSubmitModal() {
  if (!canSubmitTransfer(currentUser)) return;
  await Promise.all([loadTransferableItems(), loadTransferDropdowns()]);
  populateSelect(
    document.getElementById('submitAssetId'),
    transferableItems,
    'id',
    'item_name',
    transferableItems.length ? 'Select asset...' : 'No transferable assets in your scope'
  );
  document.getElementById('submitPropertyTag').value = '';
  document.getElementById('submitDepartment').value = '';
  document.getElementById('submitLocation').value = '';
  document.getElementById('submitToDepartment').value = '';
  document.getElementById('submitToLocation').value = '';
  document.getElementById('submitReason').value = '';
  openModal('submitModal');
}

async function submitCreate(e) {
  e.preventDefault();
  if (!canSubmitTransfer(currentUser)) return;
  const assetId = parseInt(document.getElementById('submitAssetId').value, 10);
  const toDepartmentId = parseInt(document.getElementById('submitToDepartment').value, 10);
  const toLocationId = parseInt(document.getElementById('submitToLocation').value, 10);
  const reason = document.getElementById('submitReason').value?.trim();
  if (!assetId) return showToast('Please select an asset', 'error');
  if (!toDepartmentId || !toLocationId) return showToast('Destination department and location are required', 'error');
  if (!reason) return showToast('Reason for transfer is required', 'error');

  try {
    await API.createTransfer({
      inventory_item_id: assetId,
      to_department_id: toDepartmentId,
      to_location_id: toLocationId,
      reason
    });
    showToast('Transfer request submitted');
    closeModal('submitModal');
    loadTransfers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadTransfers() {
  const params = {};
  const search = document.getElementById('searchInput')?.value;
  const status = document.getElementById('filterStatus')?.value;
  if (search) params.search = search;
  if (status) params.status = status;

  try {
    const res = await API.getTransfers(params);
    transfers = res?.data || [];
    renderTransfers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function canOperateTransferActions() {
  return canOperateTransfers(currentUser);
}

function renderTransfers() {
  const el = document.getElementById('transferContent');
  if (!transfers.length) {
    el.innerHTML = '<div class="empty-state"><i class="bi bi-arrow-left-right"></i>No transfer requests.</div>';
    return;
  }

  el.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Code</th><th>Asset</th><th>Property Tag</th><th>From Dept</th><th>To Dept</th>
            <th>From Location</th><th>To Location</th><th>Requested By</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${transfers.map(t => `
            <tr>
              <td>${t.transaction_code}</td>
              <td>${t.item_name}</td>
              <td>${t.property_tag || '-'}</td>
              <td>${t.from_department_name || '-'}</td>
              <td>${t.to_department_name || '-'}</td>
              <td>${t.from_location_name || '-'}</td>
              <td>${t.to_location_name || '-'}</td>
              <td>${t.requested_by_name}</td>
              <td>${getStatusBadge(t.status)}</td>
              <td style="white-space:nowrap;">
                <button class="btn-icon" onclick="viewTransfer(${t.id})" title="View"><i class="bi bi-eye"></i></button>
                ${t.status === 'Approved' ? `
                  <button class="btn-icon" onclick="openTransferDocument(${t.id})" title="View TRF" aria-label="View TRF"><i class="bi bi-file-earmark-arrow-up"></i></button>
                ` : ''}
                ${canOperateTransferActions() && t.status === 'Pending' ? `
                  <button class="btn-success-custom btn-sm-custom" onclick="approveTransfer(${t.id})">Approve</button>
                  <button class="btn-danger-custom btn-sm-custom" onclick="openReject(${t.id})">Reject</button>
                ` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
  `;
}

async function viewTransfer(id) {
  try {
    const res = await API.getTransfer(id);
    const t = res.data;
    alert([
      `Code: ${t.transaction_code}`,
      `Asset: ${t.item_name}`,
      `Property Tag: ${t.property_tag || '-'}`,
      `From: ${t.from_department_name || '-'} / ${t.from_location_name || '-'}`,
      `To: ${t.to_department_name || '-'} / ${t.to_location_name || '-'}`,
      `Reason: ${t.reason}`,
      `Requested By: ${t.requested_by_name}`,
      `Request Date: ${formatDate(t.request_date || t.created_at)}`,
      `Status: ${t.status}`,
      `Rejection Reason: ${t.rejection_reason || '-'}`,
      `Remarks: ${t.notes || '-'}`
    ].join('\n'));
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function approveTransfer(id) {
  if (!confirmAction('Approve this transfer? The asset department and location will be updated immediately.')) return;
  try {
    const res = await API.approveTransfer(id);
    showToast('Transfer approved');
    openGeneratedDocument(res?.data?.generated_document, 'TRF');
    loadTransfers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openReject(id) {
  pendingAction = { id, action: 'reject' };
  document.getElementById('actionModalTitle').textContent = 'Reject Transfer';
  document.getElementById('actionModalBody').innerHTML = `
    <div class="form-group"><label>Rejection Reason *</label><textarea class="form-control-custom" id="actionReason" rows="3" required></textarea></div>
  `;
  openModal('actionModal');
}

async function submitAction(e) {
  e.preventDefault();
  if (!pendingAction) return;
  const reason = document.getElementById('actionReason')?.value;
  if (!reason) return showToast('Rejection reason is required', 'error');
  try {
    await API.rejectTransfer(pendingAction.id, { rejection_reason: reason });
    showToast('Transfer rejected');
    closeModal('actionModal');
    pendingAction = null;
    loadTransfers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', initTransferRequestsPage);
