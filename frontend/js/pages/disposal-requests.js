let currentUser = null;
let disposals = [];
let disposableItems = [];

async function initDisposalRequestsPage() {
  currentUser = await initLayout('disposal-requests');
  if (!currentUser) return;

  const canOperate = canOperateDisposal(currentUser);
  const canSubmit = canSubmitDisposal(currentUser);
  const subtitle = canOperate
    ? 'Review, inspect, and approve asset disposal requests'
    : canSubmit
      ? 'Submit and track asset disposal requests'
      : 'View disposal requests for oversight and monitoring';

  document.getElementById('pageContent').innerHTML = `
    <div class="page-header">
      <h1>Disposal Requests</h1>
      <p>${subtitle}</p>
    </div>
    <div class="content-card">
      <div class="content-card-header">
        <h3>All Requests</h3>
        ${canSubmitDisposal(currentUser) ? `<button type="button" class="btn-primary-custom" id="submitDisposalBtn"><i class="bi bi-plus-lg"></i> Submit Request</button>` : ''}
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
      <div class="table-responsive" id="disposalContent"><div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div></div>
    </div>
  `;

  document.getElementById('submitDisposalBtn')?.addEventListener('click', openSubmitModal);

  document.getElementById('searchInput').addEventListener('input', debounce(loadDisposals, 300));
  document.getElementById('filterStatus').addEventListener('change', loadDisposals);
  bindGuardedFormSubmit(document.getElementById('submitForm'), submitCreate, { loadingText: 'Submitting...' });
  document.getElementById('submitAssetId')?.addEventListener('change', onSubmitAssetChange);
  initActionMenus();

  if (canSubmitDisposal(currentUser)) await loadDisposableItems();

  const params = new URLSearchParams(window.location.search);
  const statusFilter = params.get('status');
  if (statusFilter && document.getElementById('filterStatus')) {
    document.getElementById('filterStatus').value = statusFilter;
  }

  await loadDisposals();

  const disposalId = params.get('id');
  if (disposalId) viewDisposal(parseInt(disposalId, 10));

  initSearchableSelects(document);
}

async function loadDisposableItems() {
  try {
    const res = await API.getInventory();
    disposableItems = (res?.data || []).filter(i => i.status !== 'Disposed');
  } catch (err) {
    showToast(err.message, 'error');
    disposableItems = [];
  }
}

function onSubmitAssetChange() {
  const item = disposableItems.find(i => i.id === parseInt(document.getElementById('submitAssetId').value, 10));
  document.getElementById('submitPropertyTag').value = item?.property_tag || '-';
  document.getElementById('submitDepartment').value = item?.department_name || item?.category_name || '-';
  const qtyInput = document.getElementById('submitQuantity');
  const qtyGroup = document.getElementById('submitQuantityGroup');
  const isIndividual = !item || Number(item.quantity) <= 1;
  qtyInput.value = '1';
  qtyInput.readOnly = isIndividual;
  if (qtyGroup) qtyGroup.style.display = isIndividual ? 'none' : '';
  if (!isIndividual) qtyInput.max = item?.available_quantity || 1;
}

async function openSubmitModal() {
  if (!canSubmitDisposal(currentUser)) return;
  await loadDisposableItems();
  populateSelect(
    document.getElementById('submitAssetId'),
    disposableItems,
    'id',
    formatAssetOptionLabel,
    disposableItems.length ? 'Select asset...' : 'No disposable assets in your scope'
  );
  document.getElementById('submitPropertyTag').value = '';
  document.getElementById('submitDepartment').value = '';
  document.getElementById('submitQuantity').value = '1';
  document.getElementById('submitQuantity').max = '1';
  document.getElementById('submitReason').value = '';
  refreshSearchableSelects(document.getElementById('submitModal'));
  openModal('submitModal');
}

async function submitCreate(e) {
  e.preventDefault();
  if (!canSubmitDisposal(currentUser)) return;
  const assetId = parseInt(document.getElementById('submitAssetId').value, 10);
  const item = disposableItems.find(i => i.id === assetId);
  const quantity = !item || Number(item.quantity) <= 1
    ? 1
    : parseInt(document.getElementById('submitQuantity').value, 10);
  const reason = document.getElementById('submitReason').value?.trim();
  if (!assetId) return showToast('Please select an asset', 'error');
  if (!quantity || quantity < 1) return showToast('Quantity must be at least 1', 'error');
  if (!reason) return showToast('Reason is required', 'error');

  try {
    const res = await API.createDisposal({
      inventory_item_id: assetId,
      quantity,
      reason
    });
    showToast('Disposal request submitted');
    openGeneratedDocument(res?.data?.generated_document, 'RDF');
    closeModal('submitModal');
    loadDisposals();
  } catch (err) {
    showToast(err.message, 'error');
  }
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

function canOperateDisposalActions() {
  return canOperateDisposal(currentUser);
}

function renderDisposalActions(d) {
  const items = [
    { label: 'View Details', icon: 'bi-eye', handler: `viewDisposal(${d.id})` }
  ];

  if (canOperateDisposalActions() && ['Pending', 'Inspected'].includes(d.status)) {
    items.push({
      label: 'Review in Pending Approvals',
      icon: 'bi-clipboard-check',
      href: '/pages/pending-approvals.html?tab=disposal'
    });
  }

  return renderActionMenuCell(`disposal-actions-${d.id}`, items);
}

function renderDisposals() {
  const el = document.getElementById('disposalContent');
  if (!disposals.length) {
    el.innerHTML = '<div class="empty-state"><i class="bi bi-trash3"></i>No disposal requests.</div>';
    return;
  }

  el.innerHTML = `
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
              <td>${renderDisposalActions(d)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
  `;
  finishTableRender(el);
}

async function viewDisposal(id) {
  try {
    const res = await API.getDisposal(id);
    const d = res.data;
    await showDetailModal({
      title: 'Disposal Details',
      bodyHtml: [
        renderDetailSection('General Information', [
          { label: 'Code', value: d.transaction_code },
          { label: 'Status', html: getStatusBadge(d.status) },
          { label: 'Asset', value: `${d.item_name} (${d.item_code})`, fullWidth: true },
          { label: 'Property Tag', value: d.property_tag },
          { label: 'Department', value: d.department_name },
          { label: 'Quantity', value: d.quantity },
          { label: 'Requested By', value: d.requested_by_name },
          { label: 'Request Date', value: formatDate(d.created_at) }
        ]),
        renderDetailSection('Disposal Details', [
          { label: 'Reason', value: d.reason, fullWidth: true, wrap: true },
          { label: 'Inspection Notes', value: d.inspection_notes, fullWidth: true, wrap: true },
          { label: 'Inspected By', value: d.inspected_by_name },
          { label: 'Disposal Method', value: d.disposal_method },
          { label: 'Disposal Date', value: formatDate(d.disposal_date) },
          { label: 'Approved By', value: d.approved_by_name },
          { label: 'Notes', value: d.notes, fullWidth: true, wrap: true }
        ])
      ].join('')
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', initDisposalRequestsPage);
