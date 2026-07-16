/**
 * Shared approve / reject / inspect actions for request modules.
 * Call setRequestApprovalReload(fn) from each page so lists refresh after an action.
 */
let requestApprovalReload = null;
let requestApprovalPending = null;

const REQUEST_DISPOSAL_METHODS = ['Auction', 'Donation', 'Recycling', 'Destruction', 'Trade-In', 'Other'];

function setRequestApprovalReload(fn) {
  requestApprovalReload = typeof fn === 'function' ? fn : null;
}

function ensureRequestApprovalModal() {
  if (document.getElementById('actionModal')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="modal-overlay" id="actionModal">
      <div class="modal-content-custom" style="max-width:560px;">
        <div class="modal-header-custom">
          <h3 id="actionModalTitle">Action</h3>
          <button class="btn-icon" title="Close" aria-label="Close" onclick="closeModal('actionModal')"><i class="bi bi-x-lg"></i></button>
        </div>
        <form id="actionForm">
          <div class="modal-body-custom" id="actionModalBody"></div>
          <div class="modal-footer-custom">
            <button type="button" class="btn-outline-custom" onclick="closeModal('actionModal')">Cancel</button>
            <button type="submit" class="btn-primary-custom" id="actionModalSubmit">Submit</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(wrap.firstElementChild);
  document.getElementById('actionForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = document.getElementById('actionModalSubmit');
    withSubmitGuard(btn, () => submitRequestApprovalAction(e), { loadingText: getRequestApprovalLoadingText() });
  });
}

function bindRequestApprovalForm() {
  ensureRequestApprovalModal();
  const form = document.getElementById('actionForm');
  if (!form || form.dataset.approvalBound === '1' || form.dataset.localHandler === '1') return;
  form.dataset.approvalBound = '1';
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = document.getElementById('actionModalSubmit');
    withSubmitGuard(btn, () => submitRequestApprovalAction(e), { loadingText: getRequestApprovalLoadingText() });
  });
}

function getRequestApprovalLoadingText() {
  if (!requestApprovalPending) return 'Processing...';
  const { action } = requestApprovalPending;
  if (action === 'approve') return 'Approving...';
  if (action === 'reject') return 'Rejecting...';
  if (action === 'inspect') return 'Inspecting...';
  return 'Processing...';
}

async function refreshAfterRequestApproval() {
  if (requestApprovalReload) await requestApprovalReload();
}

async function approveBorrowRequest(id) {
  if (!await confirmAction('Approve this borrow request?', { title: 'Approve Borrow', confirmText: 'Approve', variant: 'success' })) return;
  await guardAsyncAction(async () => {
    try {
      const res = await API.approveBorrow(id);
      showToast('Borrow approved');
      openGeneratedDocument(res?.data?.generated_document, 'ABL');
      await refreshAfterRequestApproval();
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
      await refreshAfterRequestApproval();
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
      openGeneratedDocument(res?.data?.generated_document, res?.data?.generated_document?.document_type || 'RTF');
      await refreshAfterRequestApproval();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, { loadingText: 'Approving...', lockKey: `transfer-approve-${id}` });
}

function openTransferReject(id) {
  bindRequestApprovalForm();
  requestApprovalPending = { module: 'transfer', id, action: 'reject' };
  document.getElementById('actionModalTitle').textContent = 'Reject Transfer';
  document.getElementById('actionModalSubmit').textContent = 'Reject';
  document.getElementById('actionModalBody').innerHTML = `
    <div class="form-group"><label>Rejection Reason *</label><textarea class="form-control-custom" id="actionReason" rows="3" required></textarea></div>
  `;
  openModal('actionModal');
}

function openMaintenanceApprove(id) {
  if (typeof pendingAction !== 'undefined') pendingAction = null;
  bindRequestApprovalForm();
  requestApprovalPending = { module: 'maintenance', id, action: 'approve' };
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
  if (typeof pendingAction !== 'undefined') pendingAction = null;
  bindRequestApprovalForm();
  requestApprovalPending = { module: 'maintenance', id, action: 'reject' };
  document.getElementById('actionModalTitle').textContent = 'Reject Maintenance';
  document.getElementById('actionModalSubmit').textContent = 'Reject';
  document.getElementById('actionModalBody').innerHTML = `
    <div class="form-group"><label>Rejection Reason *</label><textarea class="form-control-custom" id="actionReason" rows="3" required></textarea></div>
  `;
  openModal('actionModal');
}

function openDisposalInspect(id) {
  bindRequestApprovalForm();
  requestApprovalPending = { module: 'disposal', id, action: 'inspect' };
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
  bindRequestApprovalForm();
  requestApprovalPending = { module: 'disposal', id, action: 'approve' };
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('actionModalTitle').textContent = 'Approve Disposal';
  document.getElementById('actionModalSubmit').textContent = 'Approve Disposal';
  document.getElementById('actionModalBody').innerHTML = `
    <div class="form-group">
      <label>Disposal Method *</label>
      <select class="form-control-custom" id="actionDisposalMethod" required>
        <option value="">Select method</option>
        ${REQUEST_DISPOSAL_METHODS.map((method) => `<option>${method}</option>`).join('')}
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
  if (typeof refreshSearchableSelects === 'function') {
    refreshSearchableSelects(document.getElementById('actionModal'));
  }
  openModal('actionModal');
}

function openDisposalReject(id) {
  bindRequestApprovalForm();
  requestApprovalPending = { module: 'disposal', id, action: 'reject' };
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

async function submitRequestApprovalAction(e) {
  if (e) e.preventDefault();
  if (!requestApprovalPending) return;

  const { module, id, action } = requestApprovalPending;

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
    } else {
      return;
    }

    closeModal('actionModal');
    requestApprovalPending = null;
    await refreshAfterRequestApproval();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
