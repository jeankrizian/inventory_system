/**
 * Shared read-only detail modal used by Maintenance, Transfer, and similar modules.
 * Provides showDetailModal() + renderDetailSection() helpers.
 */

function displayDetailValue(value) {
  if (value == null || String(value).trim() === '') return '—';
  return String(value);
}

function renderDetailRow(fields) {
  return `
    <div class="form-row">
      ${fields.map((field) => `
        <div class="form-group">
          <label>${field.label}</label>
          <div${field.wrap ? ' style="word-break:break-word;overflow-wrap:break-word;line-height:1.45;"' : ''}>${field.html ?? displayDetailValue(field.value)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderDetailSection(title, fields) {
  const blocks = [];
  let pair = [];

  fields.forEach((field) => {
    if (field.fullWidth) {
      if (pair.length) {
        blocks.push(renderDetailRow(pair));
        pair = [];
      }
      blocks.push(`
        <div class="form-group">
          <label>${field.label}</label>
          <div${field.wrap ? ' style="word-break:break-word;overflow-wrap:break-word;line-height:1.45;"' : ''}>${field.html ?? displayDetailValue(field.value)}</div>
        </div>
      `);
      return;
    }

    pair.push(field);
    if (pair.length === 2) {
      blocks.push(renderDetailRow(pair));
      pair = [];
    }
  });

  if (pair.length) {
    blocks.push(renderDetailRow(pair));
  }

  return `
    <div class="asset-detail-section" style="margin-bottom:20px;">
      <h4 style="font-size:14px;font-weight:600;margin:0 0 12px;">${title}</h4>
      ${blocks.join('')}
    </div>
  `;
}

function ensureSharedDetailModal() {
  let modal = document.getElementById('sharedDetailModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'sharedDetailModal';
  modal.innerHTML = `
    <div class="modal-content-custom" style="max-width:720px;">
      <div class="modal-header-custom">
        <h3 id="sharedDetailModalTitle">Details</h3>
        <button type="button" class="btn-icon" title="Close" aria-label="Close" onclick="closeModal('sharedDetailModal')">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <div class="modal-body-custom" id="sharedDetailModalBody" style="font-size:13px;"></div>
      <div class="modal-footer-custom">
        <button type="button" class="btn-outline-custom" onclick="closeModal('sharedDetailModal')">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

async function showDetailModal({ title, bodyHtml } = {}) {
  ensureSharedDetailModal();
  const titleEl = document.getElementById('sharedDetailModalTitle');
  const bodyEl = document.getElementById('sharedDetailModalBody');
  if (titleEl) titleEl.textContent = title || 'Details';
  if (bodyEl) bodyEl.innerHTML = bodyHtml || '';
  openModal('sharedDetailModal');
}
