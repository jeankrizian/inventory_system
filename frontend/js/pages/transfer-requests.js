let currentUser = null;
let transfers = [];
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
        ${canSubmitTransfer(currentUser) ? `<button type="button" class="btn-primary-custom" id="submitTransferBtn"><i class="bi bi-plus-lg"></i> Submit Request</button>` : ''}
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

  document.getElementById('submitTransferBtn')?.addEventListener('click', openSubmitModal);

  document.getElementById('searchInput').addEventListener('input', debounce(loadTransfers, 300));
  document.getElementById('filterStatus').addEventListener('change', loadTransfers);
  bindGuardedFormSubmit(document.getElementById('submitForm'), submitCreate, { loadingText: 'Submitting...' });
  document.getElementById('submitAssetId')?.addEventListener('change', onSubmitAssetChange);
  initActionMenus();

  if (canSubmitTransfer(currentUser)) await loadTransferDropdowns();

  const params = new URLSearchParams(window.location.search);
  const statusFilter = params.get('status');
  if (statusFilter && document.getElementById('filterStatus')) {
    document.getElementById('filterStatus').value = statusFilter;
  }

  await loadTransfers();

  const transferId = params.get('id');
  if (transferId) viewTransfer(parseInt(transferId, 10));

  initSearchableSelects(document);
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
      i.status === 'Available' && canTransferAsset(i.asset_classification)
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
    formatAssetOptionLabel,
    transferableItems.length ? 'Select asset...' : 'No transferable assets in your scope'
  );
  document.getElementById('submitPropertyTag').value = '';
  document.getElementById('submitDepartment').value = '';
  document.getElementById('submitLocation').value = '';
  document.getElementById('submitToDepartment').value = '';
  document.getElementById('submitToLocation').value = '';
  document.getElementById('submitReason').value = '';
  refreshSearchableSelects(document.getElementById('submitModal'));
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

function renderTransferActions(t) {
  const items = [
    { label: 'View Details', icon: 'bi-eye', handler: `viewTransfer(${t.id})` }
  ];

  if (t.status === 'Approved') {
    items.push({
      label: 'View TRF',
      icon: 'bi-file-earmark-arrow-up',
      handler: `openTransferDocument(${t.id})`
    });
  }

  if (canOperateTransferActions() && t.status === 'Pending') {
    items.push({
      label: 'Review in Pending Approvals',
      icon: 'bi-clipboard-check',
      href: '/pages/pending-approvals.html?tab=transfer'
    });
  }

  return renderActionMenuCell(`transfer-actions-${t.id}`, items);
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
              <td>${renderTransferActions(t)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
  `;
  finishTableRender(el);
}

async function viewTransfer(id) {
  try {
    const res = await API.getTransfer(id);
    const t = res.data;
    await showDetailModal({
      title: 'Transfer Details',
      bodyHtml: [
        renderDetailSection('General Information', [
          { label: 'Code', value: t.transaction_code },
          { label: 'Status', html: getStatusBadge(t.status) },
          { label: 'Asset', value: t.item_name, fullWidth: true },
          { label: 'Property Tag', value: t.property_tag },
          { label: 'Requested By', value: t.requested_by_name },
          { label: 'Request Date', value: formatDate(t.request_date || t.created_at) }
        ]),
        renderDetailSection('Transfer Route', [
          { label: 'From Department', value: t.from_department_name },
          { label: 'From Location', value: t.from_location_name },
          { label: 'To Department', value: t.to_department_name },
          { label: 'To Location', value: t.to_location_name }
        ]),
        renderDetailSection('Additional Details', [
          { label: 'Reason', value: t.reason, fullWidth: true, wrap: true },
          { label: 'Rejection Reason', value: t.rejection_reason, fullWidth: true, wrap: true },
          { label: 'Remarks', value: t.notes, fullWidth: true, wrap: true }
        ])
      ].join('')
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', initTransferRequestsPage);
