async function initDocumentPreview() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    document.getElementById('documentSheet').innerHTML = '<div class="loading">Document ID is required.</div>';
    return;
  }

  const user = await requireAuth();
  if (!user) {
    window.location.href = '/index.html';
    return;
  }

  if (!canAccessPage('document-preview', user)) {
    denyPageAccess();
    return;
  }

  document.getElementById('downloadPdfBtn').addEventListener('click', () => API.downloadDocumentPdf(id));

  try {
    const res = await API.getDocument(id);
    const doc = res.data;
    document.title = `${doc.document_number} - Document Preview`;
    document.getElementById('documentSheet').innerHTML = renderDocument(doc);
    if (params.get('print') === '1') {
      setTimeout(() => window.print(), 400);
    }
  } catch (err) {
    const message = err.message || 'Unable to load document.';
    showToast(message, 'error');
    document.getElementById('documentSheet').innerHTML = `<div class="loading">${message}</div>`;
  }
}

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderDocument(doc) {
  const p = doc.payload || {};
  const type = String(doc.document_type || '').trim().toUpperCase();
  switch (type) {
    case 'PAR': return renderPAR(p);
    case 'GRN': return renderGRN(p);
    case 'RDF': return renderRDF(p);
    case 'ABL': return renderABL(p);
    case 'TRF':
    case 'RTF': return renderTRF(p);
    default: return `<div class="loading">Unsupported document type${type ? `: ${esc(type)}` : ''}.</div>`;
  }
}

function renderPropertyTagAttachment(p, documentLabel) {
  const tags = Array.isArray(p.propertyTags) ? p.propertyTags : (p.items?.[0]?.propertyTags || []);
  if (!p.attachPropertyTagList && tags.length <= 5) return '';

  const description = p.itemDescription || p.items?.[0]?.description || '';
  const quantity = p.items?.[0]?.quantity ?? tags.length;

  return `
    <div class="document-attachment">
      <h1 class="doc-title">PROPERTY TAG LIST</h1>
      <p class="doc-office">Property Management Office</p>
      <p class="doc-institution">Cavite Institute</p>
      <div class="doc-meta">
        <div><strong>${esc(documentLabel)}:</strong> ${esc(p.documentNumber || '')}</div>
        <div class="right"><strong>Quantity:</strong> ${esc(quantity)}</div>
        <div><strong>Item Description:</strong> ${esc(description)}</div>
        <div class="right"><strong>Department:</strong> ${esc(p.department || '')}</div>
        <div><strong>Classification:</strong> ${esc(p.classification || '')}</div>
      </div>
      <p class="doc-body-text"><strong>Property Tags</strong></p>
      <div class="property-tag-list">
        ${tags.map((tag) => `<div>${esc(tag)}</div>`).join('') || '<div></div>'}
      </div>
    </div>
  `;
}

function renderPAR(p) {
  const propertyTagNote = p.attachPropertyTagList
    ? `<p class="doc-body-text"><strong>Property Tags:</strong> See Attached Property Tag List</p>`
    : '';

  return `
    <h1 class="doc-title">Property Acknowledgement Receipt</h1>
    <p class="doc-office">Property Management Office</p>
    <p class="doc-institution">Cavite Institute</p>
    <div class="doc-meta">
      <div><strong>Supplier:</strong> ${esc(p.supplier)}</div>
      <div class="right"><strong>PAR #:</strong> ${esc(p.documentNumber)}</div>
      <div><strong>Department:</strong> ${esc(p.department)}</div>
      <div class="right"><strong>Delivery Date:</strong> ${esc(p.deliveryDate)}</div>
      <div><strong>Classification:</strong> ${esc(p.classification || '')}</div>
      <div class="right"><strong>Location:</strong> ${esc(p.location || '')}</div>
      <div><strong>Assigned Custodian:</strong> ${esc(p.custodian || p.receivedBy || '')}</div>
      <div class="right"><strong>Asset Condition:</strong> ${esc(p.condition || '')}</div>
      <div><strong>Serial Number:</strong> ${esc(p.serialNumber || '')}</div>
      <div class="right"><strong>Brand / Model:</strong> ${esc([p.brand, p.model].filter(Boolean).join(' / '))}</div>
    </div>
    ${renderItemsTable(['Property Tag Number', 'Item Description', 'Quantity', 'Unit', 'Amount'],
      (p.items || []).map(i => [i.propertyTag, i.description, i.quantity, i.unit, i.amount || '']))}
    ${propertyTagNote}
    <p class="doc-ack">${esc(p.acknowledgement)}</p>
    <div class="signatures">
      ${signatureBlock('Prepared by:', p.preparedBy, 'Property Officer')}
      ${signatureBlock('Received by:', p.receivedBy, 'Custodian')}
      ${signatureBlock('Noted by:', p.departmentHead, 'Department Head')}
      ${signatureBlock('Noted by:', p.propertyOfficer, 'Head, Property Management Office')}
    </div>
    <p class="doc-footer">Copies for: Property Office, Receiving Department</p>
    ${renderPropertyTagAttachment(p, 'PAR No.')}
  `;
}

function renderGRN(p) {
  return `
    <h1 class="doc-title">Goods Received Note</h1>
    <p class="doc-office">Property Office</p>
    <p class="doc-institution">Cavite Institute</p>
    <div class="doc-meta">
      <div><strong>Department:</strong> ${esc(p.department)}</div>
      <div class="right"><strong>GRN No.:</strong> ${esc(p.documentNumber)}</div>
      <div><strong>PR No.:</strong> ${esc(p.purchaseRequestNumber || p.mrfNumber)}</div>
      <div class="right"><strong>PO No.:</strong> ${esc(p.purchaseOrderNumber)}</div>
      <div><strong>Invoice No.:</strong> ${esc(p.invoiceNumber)}</div>
      <div class="right"><strong>MRF No/s:</strong> ${esc(p.mrfNumber)}</div>
    </div>
    ${renderItemsTable(['Item Description', 'Qty', 'Unit', 'Unit Cost', 'Total Amount'],
      (p.items || []).map(i => [i.description, i.quantity, i.unit, i.unitCost || '', i.totalAmount || '']))}
    <p class="doc-ack">${esc(p.acknowledgement)}</p>
    <div class="doc-meta" style="grid-template-columns:1fr;">
      <div><strong>Received by:</strong> ${esc(p.receivedBy)}</div>
      <div><strong>Date Received:</strong> ${esc(p.dateReceived)}</div>
      <div><strong>Noted by:</strong> ${esc(p.notedBy)}</div>
      <div style="font-size:10px;">Procurement and Property Management Head</div>
    </div>
    <p class="doc-footer">Copies for: Purchasing Office, Receiving Department, Property Office</p>
  `;
}

function resolveRdfSourceDocLabel() {
  return 'PAR No.';
}

function renderRDF(p) {
  const items = p.items || [];
  const emptyRows = Math.max(0, 7 - items.length);
  const itemRows = items.concat(Array.from({ length: emptyRows }, () => ({})));
  const sourceDocLabel = resolveRdfSourceDocLabel(p);
  const evalHeader = 'ICT/FCU Evaluation/Recommendation<br><span style="font-weight:400;font-size:9px;">(safekeeping, dispose, salvageable for parts)</span>';

  return `
    <div style="text-align:right;font-size:12px;margin-bottom:4px;"><strong>RDF No.</strong> ${esc(p.documentNumber || '')}</div>
    <h1 class="doc-title">REQUEST FOR DISPOSAL FORM</h1>
    <p class="doc-office">Property Management Office</p>
    <p class="doc-institution">Cavite Institute</p>
    <div class="doc-meta">
      <div><strong>Requesting Department:</strong> ${esc(p.requestingDepartment || '')}</div>
      <div class="right"><strong>Date of Request:</strong> ${esc(p.dateOfRequest || '')}</div>
    </div>
    <table class="doc-table">
      <thead>
        <tr>
          <th>Item Description</th>
          <th style="width:70px;">Qty/Unit</th>
          <th style="width:100px;">Property Tag</th>
          <th style="width:100px;">${esc(sourceDocLabel)}</th>
          <th style="width:160px;">${evalHeader}</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows.map((i) => `
          <tr>
            <td>${esc(i.description || '')}</td>
            <td>${esc(i.qtyUnit || '')}</td>
            <td>${esc(i.propertyTag || '')}</td>
            <td>${esc(i.sourceDocNumber || i.parNo || '')}</td>
            <td>${esc(i.recommendation || '')}</td>
          </tr>
        `).join('')}
        <tr>
          <td colspan="5"><strong>Reason for disposal:</strong> ${esc(p.reason || '')}</td>
        </tr>
      </tbody>
    </table>
    <div class="signatures signatures-3">
      ${signatureBlock('Requested by:', p.requestedBy)}
      ${signatureBlock('Request Noted by:', p.departmentHead, 'Department Head')}
      ${signatureBlock('Evaluated by:', p.evaluatedBy, 'ICT/FCU')}
    </div>
    <div class="signatures">
      ${signatureBlock('Disposal Processed and Received by:', p.disposalProcessedBy)}
      ${signatureBlock('Date Processed:', p.dateProcessed)}
      ${signatureBlock('Request for Disposal Approved by:', p.approvedBy, 'Head, PPMO')}
      ${signatureBlock('Date Approved:', p.dateApproved)}
    </div>
    <p class="doc-footer" style="font-style:italic;">${esc(p.footerNote || 'Copies for: Property Office, Requesting Department, Accounting Office')}</p>
  `;
}

function renderABL(p) {
  return `
    <h1 class="doc-title">Asset Borrowing Log</h1>
    <p class="doc-office">Property Management Office</p>
    <p class="doc-institution">Cavite Institute</p>
    <div class="doc-meta">
      <div><strong>Borrow Code:</strong> ${esc(p.borrowCode)}</div>
      <div class="right"><strong>ABL No.:</strong> ${esc(p.documentNumber)}</div>
      <div><strong>Borrower:</strong> ${esc(p.borrowerName)}</div>
      <div class="right"><strong>Borrow Date:</strong> ${esc(p.borrowDate)}</div>
      <div><strong>Department:</strong> ${esc(p.borrowerDepartment)}</div>
      <div class="right"><strong>Expected Return:</strong> ${esc(p.expectedReturnDate)}</div>
      <div><strong>Purpose:</strong> ${esc(p.purpose)}</div>
    </div>
    ${renderItemsTable(['Property Tag', 'Item Description', 'Quantity', 'Unit'],
      (p.items || []).map(i => [i.propertyTag, i.description, i.quantity, i.unit]))}
    <p class="doc-ack">${esc(p.acknowledgement)}</p>
    <div class="signatures">
      ${signatureBlock('Borrower:', p.borrowerName, 'Signature over Printed Name')}
      ${signatureBlock('Approved by:', p.approvedBy, 'Property Office')}
      ${signatureBlock('Noted by:', p.departmentHead, 'Department Head')}
      ${signatureBlock('Noted by:', p.propertyOfficer, 'Head, Property Management Office')}
    </div>
    <p class="doc-footer">Copies for: Property Office, Borrowing Department</p>
  `;
}

function renderTRF(p) {
  const items = p.items || [];
  const emptyRows = Math.max(0, 5 - items.length);
  const itemRows = items.concat(Array.from({ length: emptyRows }, () => ({})));

  return `
    <div style="text-align:right;font-size:12px;margin-bottom:4px;"><strong>RTF No.</strong> ${esc(p.documentNumber || '')}</div>
    <h1 class="doc-title">REQUEST FOR TRANSFER FORM</h1>
    <p class="doc-office">Property Management Office</p>
    <p class="doc-institution">Cavite Institute</p>
    <div class="doc-meta">
      <div><strong>Requesting Department:</strong> ${esc(p.requestingDepartment || p.fromDepartment || '')}</div>
      <div class="right"><strong>Date of Request:</strong> ${esc(p.dateOfRequest || p.requestDate || '')}</div>
    </div>
    <table class="doc-table">
      <thead>
        <tr>
          <th>Item Description</th>
          <th style="width:70px;">Qty/Unit</th>
          <th style="width:110px;">Property Tag</th>
          <th style="width:110px;">PAR No.</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows.map((i) => `
          <tr>
            <td>${esc(i.description || '')}</td>
            <td>${esc(i.qtyUnit || (i.quantity != null ? `${i.quantity} ${i.unit || 'pcs'}` : ''))}</td>
            <td>${esc(i.propertyTag || '')}</td>
            <td>${esc(i.parNo || '')}</td>
          </tr>
        `).join('')}
        <tr>
          <td colspan="4"><strong>Reason for transfer:</strong> ${esc(p.reason || '')}</td>
        </tr>
      </tbody>
    </table>
    <div class="signatures">
      ${signatureBlock('Requested by:', p.requestedBy)}
      ${signatureBlock('Request Noted by:', p.departmentHead || p.fromDepartmentHead, 'Department Head')}
      ${signatureBlock('Received by (new custodian):', p.receivingSignatory)}
      ${signatureBlock('Date Processed:', p.dateProcessed || p.approvedDate)}
      ${signatureBlock('Request for Transfer Approved by:', p.approvedBy, 'Head, PPMO')}
      ${signatureBlock('Date Approved:', p.dateApproved || p.approvedDate)}
    </div>
    <p class="doc-ack">${esc(p.acknowledgement)}</p>
    <p class="doc-footer" style="font-style:italic;">${esc(p.footerNote || 'Copies for: Property Office, Requesting Department, Accounting Office')}</p>
  `;
}

function renderItemsTable(headers, rows) {
  const emptyRows = Math.max(0, 8 - rows.length);
  const allRows = rows.concat(Array.from({ length: emptyRows }, () => headers.map(() => '')));
  return `
    <table class="doc-table">
      <thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>
        ${allRows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  `;
}

function signatureBlock(label, name, caption = '') {
  return `
    <div class="signature-block">
      <div>${esc(label)}</div>
      <div class="signature-name">${esc(name)}</div>
      <div class="signature-line"></div>
      ${caption ? `<div class="signature-caption">${esc(caption)}</div>` : ''}
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', initDocumentPreview);
