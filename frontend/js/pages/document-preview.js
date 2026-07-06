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
  switch (doc.document_type) {
    case 'PAR': return renderPAR(p);
    case 'GRN': return renderGRN(p);
    case 'RDF': return renderRDF(p);
    case 'ABL': return renderABL(p);
    case 'TRF': return renderTRF(p);
    case 'SAL': return renderSAL(p);
    default: return '<div class="loading">Unsupported document type.</div>';
  }
}

function renderPAR(p) {
  return `
    <h1 class="doc-title">Property Acknowledgement Receipt</h1>
    <p class="doc-office">Property Management Office</p>
    <p class="doc-institution">Cavite Institute</p>
    <div class="doc-meta">
      <div><strong>Supplier:</strong> ${esc(p.supplier)}</div>
      <div class="right"><strong>PAR #:</strong> ${esc(p.documentNumber)}</div>
      <div><strong>Department:</strong> ${esc(p.department)}</div>
      <div class="right"><strong>Delivery Date:</strong> ${esc(p.deliveryDate)}</div>
    </div>
    ${renderItemsTable(['Property Tag Number', 'Item Description', 'Quantity', 'Unit', 'Amount'],
      (p.items || []).map(i => [i.propertyTag, i.description, i.quantity, i.unit, i.amount || '']))}
    <p class="doc-ack">${esc(p.acknowledgement)}</p>
    <div class="signatures">
      ${signatureBlock('Prepared by:', p.preparedBy, 'Property Officer')}
      ${signatureBlock('Received by:', p.receivedBy, 'Department Custodian')}
      ${signatureBlock('Noted by:', p.departmentHead, 'Department Head')}
      ${signatureBlock('Noted by:', p.propertyOfficer, 'Head, Property Management Office')}
    </div>
    <p class="doc-footer">Copies for: Property Office, Receiving Department</p>
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

function renderRDF(p) {
  return `
    <h1 class="doc-title">REQUEST FOR DISPOSAL FORM</h1>
    <p class="doc-office">Property Management Office</p>
    <p class="doc-institution">Cavite Institute</p>
    <div class="doc-meta">
      <div><strong>Requesting Department:</strong> ${esc(p.requestingDepartment)}</div>
      <div class="right"><strong>RDF No.:</strong> ${esc(p.documentNumber)}</div>
      <div><strong>Date of Request:</strong> ${esc(p.dateOfRequest)}</div>
    </div>
    ${renderItemsTable(
      ['Item Description', 'Qty/Unit', 'Property Tag', 'PAR No.', 'ICT/FCU Evaluation/Recommendation'],
      (p.items || []).map(i => [i.description, i.qtyUnit, i.propertyTag, i.parNo, i.recommendation])
    )}
    <p><strong>Reason for disposal:</strong> ${esc(p.reason)}</p>
    <div class="signatures">
      ${signatureBlock('Requested by:', p.requestedBy)}
      ${signatureBlock('Request Noted by:', p.departmentHead, 'Department Head')}
      ${signatureBlock('Evaluated by:', p.evaluatedBy, 'ICT/FCU')}
      ${signatureBlock('Disposal Processed and Received by:', p.disposalProcessedBy)}
      ${signatureBlock('Date Processed:', p.dateProcessed)}
      ${signatureBlock('Request for Disposal Approved by:', p.approvedBy, 'Head, PPMO')}
      ${signatureBlock('Date Approved:', p.dateApproved)}
    </div>
    <p class="doc-footer">${esc(p.footerNote)}</p>
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
  return `
    <h1 class="doc-title">Transfer Request Form</h1>
    <p class="doc-office">Property Management Office</p>
    <p class="doc-institution">Cavite Institute</p>
    <div class="doc-meta">
      <div><strong>Transfer Code:</strong> ${esc(p.transferCode)}</div>
      <div class="right"><strong>TRF No.:</strong> ${esc(p.documentNumber)}</div>
      <div><strong>From Department:</strong> ${esc(p.fromDepartment)}</div>
      <div class="right"><strong>To Department:</strong> ${esc(p.toDepartment)}</div>
      <div><strong>From Location:</strong> ${esc(p.fromLocation)}</div>
      <div class="right"><strong>To Location:</strong> ${esc(p.toLocation)}</div>
      <div><strong>Request Date:</strong> ${esc(p.requestDate)}</div>
    </div>
    <p><strong>Reason for Transfer:</strong> ${esc(p.reason)}</p>
    ${renderItemsTable(['Property Tag', 'Item Description', 'Quantity', 'Unit'],
      (p.items || []).map(i => [i.propertyTag, i.description, i.quantity, i.unit]))}
    <p class="doc-ack">${esc(p.acknowledgement)}</p>
    <div class="signatures">
      ${signatureBlock('Requested by:', p.requestedBy)}
      ${signatureBlock('Approved by:', p.approvedBy, 'Property Office')}
      ${signatureBlock('Transferring Dept:', p.fromDepartmentHead, 'Department Head')}
      ${signatureBlock('Receiving Dept:', p.toDepartmentHead, 'Department Head')}
      ${signatureBlock('Received by:', p.receivingSignatory, 'Receiving Custodian')}
      ${signatureBlock('Noted by:', p.propertyOfficer, 'Head, Property Management Office')}
    </div>
    <p class="doc-footer">Copies for: Property Office, Transferring Department, Receiving Department</p>
  `;
}

function renderSAL(p) {
  return `
    <h1 class="doc-title">Semi-Durable Acknowledgment Log</h1>
    <p class="doc-office">Property Management Office</p>
    <p class="doc-institution">Cavite Institute</p>
    <div class="doc-meta">
      <div><strong>Department:</strong> ${esc(p.department)}</div>
      <div class="right"><strong>SAL No.:</strong> ${esc(p.documentNumber)}</div>
      <div><strong>Issue Date:</strong> ${esc(p.issueDate)}</div>
    </div>
    ${renderItemsTable(['Item Code', 'Item Description', 'Quantity', 'Unit', 'Condition'],
      (p.items || []).map(i => [i.itemCode, i.description, i.quantity, i.unit, i.condition || '']))}
    <p class="doc-ack">${esc(p.acknowledgement)}</p>
    <div class="signatures">
      ${signatureBlock('Issued by:', p.issuedBy, 'Property Manager')}
      ${signatureBlock('Received by:', p.receivedBy, 'Department Custodian')}
      ${signatureBlock('Noted by:', p.departmentHead, 'Department Head')}
      ${signatureBlock('Noted by:', p.propertyOfficer, 'Head, Property Management Office')}
    </div>
    <p class="doc-footer">Copies for: Property Office, Receiving Department</p>
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
