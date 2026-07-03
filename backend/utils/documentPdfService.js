const PDFDocument = require('pdfkit');

const INSTITUTION = 'Cavite Institute';
const OFFICE = 'Property Management Office';

function drawHeader(doc, title, rightLabel, rightValue) {
  doc.fontSize(14).font('Helvetica-Bold').text(title, { align: 'center' });
  doc.fontSize(11).font('Helvetica-Bold').text(OFFICE, { align: 'center' });
  doc.fontSize(10).font('Helvetica').text(INSTITUTION, { align: 'center' });
  doc.moveDown(0.8);

  if (rightLabel) {
    const y = doc.y;
    doc.fontSize(10).font('Helvetica-Bold').text(rightLabel, 400, y, { width: 150, align: 'left' });
    doc.font('Helvetica').text(rightValue || '', 460, y, { width: 100, align: 'left' });
    doc.moveDown(0.5);
  }
}

function drawTable(doc, headers, rows, colWidths) {
  const startX = doc.page.margins.left;
  let y = doc.y;
  const rowHeight = 22;
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);

  doc.fontSize(9).font('Helvetica-Bold');
  let x = startX;
  headers.forEach((header, i) => {
    doc.rect(x, y, colWidths[i], rowHeight).stroke();
    doc.text(header, x + 4, y + 6, { width: colWidths[i] - 8, align: 'left' });
    x += colWidths[i];
  });
  y += rowHeight;

  doc.font('Helvetica');
  rows.forEach(row => {
    if (y > doc.page.height - 120) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    x = startX;
    row.forEach((cell, i) => {
      doc.rect(x, y, colWidths[i], rowHeight).stroke();
      doc.text(String(cell ?? ''), x + 4, y + 6, { width: colWidths[i] - 8, align: 'left' });
      x += colWidths[i];
    });
    y += rowHeight;
  });

  doc.y = y + 8;
}

function drawSignatureBlock(doc, blocks) {
  doc.moveDown(1);
  const startY = doc.y;
  const colWidth = 240;
  blocks.forEach((block, index) => {
    const x = index % 2 === 0 ? 50 : 320;
    const y = startY + Math.floor(index / 2) * 70;
    doc.fontSize(9).font('Helvetica').text(block.label, x, y);
    doc.moveTo(x, y + 28).lineTo(x + colWidth, y + 28).stroke();
    if (block.caption) {
      doc.fontSize(8).text(block.caption, x, y + 32, { width: colWidth, align: 'center' });
    }
    if (block.value) {
      doc.fontSize(9).font('Helvetica-Bold').text(block.value, x, y + 10, { width: colWidth, align: 'center' });
    }
  });
  doc.y = startY + Math.ceil(blocks.length / 2) * 70 + 10;
}

function renderPAR(doc, payload) {
  drawHeader(doc, 'Property Acknowledgement Receipt', 'PAR #:', payload.documentNumber);

  doc.fontSize(10).font('Helvetica-Bold').text('Supplier:', 50, doc.y, { continued: true });
  doc.font('Helvetica').text(` ${payload.supplier || '________________________'}`);
  doc.font('Helvetica-Bold').text('Department:', 50, doc.y, { continued: true });
  doc.font('Helvetica').text(` ${payload.department || '________________________'}`);
  doc.font('Helvetica-Bold').text('Delivery Date:', 350, doc.y - 24, { continued: true });
  doc.font('Helvetica').text(` ${payload.deliveryDate || '________________'}`);
  doc.moveDown(0.8);

  drawTable(
    doc,
    ['Property Tag Number', 'Item Description', 'Quantity', 'Unit', 'Amount'],
    (payload.items || []).map(item => [
      item.propertyTag, item.description, item.quantity, item.unit, item.amount || ''
    ]),
    [90, 220, 55, 55, 70]
  );

  doc.fontSize(8).font('Helvetica-Oblique').text(payload.acknowledgement || '', {
    align: 'justify'
  });

  drawSignatureBlock(doc, [
    { label: 'Prepared by:', value: payload.preparedBy, caption: 'Property Officer' },
    { label: 'Received by:', value: payload.receivedBy, caption: 'Department Custodian' },
    { label: 'Noted by:', value: payload.departmentHead, caption: 'Department Head' },
    { label: 'Noted by:', value: payload.propertyOfficer, caption: 'Head, Property Management Office' }
  ]);

  doc.fontSize(8).text('Copies for: Property Office, Receiving Department', 50, doc.page.height - 50);
}

function renderGRN(doc, payload) {
  drawHeader(doc, 'Goods Received Note', 'GRN No.:', payload.documentNumber);

  doc.fontSize(10).font('Helvetica-Bold').text('Department:', 50, doc.y, { continued: true });
  doc.font('Helvetica').text(` ${payload.department || '________________________'}`);
  doc.font('Helvetica-Bold').text('PR No.:', 50, doc.y, { continued: true });
  doc.font('Helvetica').text(` ${payload.purchaseRequestNumber || payload.mrfNumber || '________________'}`);
  doc.font('Helvetica-Bold').text('PO No.:', 50, doc.y, { continued: true });
  doc.font('Helvetica').text(` ${payload.purchaseOrderNumber || '________________'}`);
  doc.font('Helvetica-Bold').text('Invoice No.:', 50, doc.y, { continued: true });
  doc.font('Helvetica').text(` ${payload.invoiceNumber || '________________'}`);
  doc.font('Helvetica-Bold').text('MRF No/s:', 350, doc.y - 48, { continued: true });
  doc.font('Helvetica').text(` ${payload.mrfNumber || '________________'}`);
  doc.moveDown(0.8);

  drawTable(
    doc,
    ['Item Description', 'Qty', 'Unit', 'Unit Cost', 'Total Amount'],
    (payload.items || []).map(item => [
      item.description, item.quantity, item.unit, item.unitCost || '', item.totalAmount || ''
    ]),
    [220, 55, 55, 80, 90]
  );

  doc.fontSize(8).font('Helvetica-Oblique').text(payload.acknowledgement || '', { align: 'justify' });
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica-Bold').text('Received by:', 50, doc.y, { continued: true });
  doc.font('Helvetica').text(` ${payload.receivedBy || '________________________'}`);
  doc.font('Helvetica-Bold').text('Date Received:', 50, doc.y, { continued: true });
  doc.font('Helvetica').text(` ${payload.dateReceived || '________________________'}`);
  doc.font('Helvetica-Bold').text('Noted by:', 50, doc.y, { continued: true });
  doc.font('Helvetica').text(` ${payload.notedBy || '________________________'}`);
  doc.fontSize(8).text('Procurement and Property Management Head', 50, doc.y);
  doc.fontSize(8).text('Copies for: Purchasing Office, Receiving Department, Property Office', 50, doc.page.height - 50);
}

function renderABL(doc, payload) {
  drawHeader(doc, 'Asset Borrowing Log', 'ABL No.:', payload.documentNumber);

  doc.fontSize(10).font('Helvetica-Bold').text('Borrow Code:', 50, doc.y, { continued: true });
  doc.font('Helvetica').text(` ${payload.borrowCode || '________________'}`);
  doc.font('Helvetica-Bold').text('Borrower:', 50, doc.y, { continued: true });
  doc.font('Helvetica').text(` ${payload.borrowerName || '________________'}`);
  doc.font('Helvetica-Bold').text('Department:', 50, doc.y, { continued: true });
  doc.font('Helvetica').text(` ${payload.borrowerDepartment || '________________'}`);
  doc.font('Helvetica-Bold').text('Borrow Date:', 350, doc.y - 24, { continued: true });
  doc.font('Helvetica').text(` ${payload.borrowDate || '________________'}`);
  doc.font('Helvetica-Bold').text('Expected Return:', 350, doc.y, { continued: true });
  doc.font('Helvetica').text(` ${payload.expectedReturnDate || '________________'}`);
  doc.font('Helvetica-Bold').text('Purpose:', 50, doc.y, { continued: true });
  doc.font('Helvetica').text(` ${payload.purpose || '________________'}`);
  doc.moveDown(0.8);

  drawTable(
    doc,
    ['Property Tag', 'Item Description', 'Quantity', 'Unit'],
    (payload.items || []).map(item => [
      item.propertyTag, item.description, item.quantity, item.unit
    ]),
    [90, 260, 60, 60]
  );

  doc.fontSize(8).font('Helvetica-Oblique').text(payload.acknowledgement || '', { align: 'justify' });

  drawSignatureBlock(doc, [
    { label: 'Borrower:', value: payload.borrowerName, caption: 'Signature over Printed Name' },
    { label: 'Approved by:', value: payload.approvedBy, caption: 'Property Office' },
    { label: 'Noted by:', value: payload.departmentHead, caption: 'Department Head' },
    { label: 'Noted by:', value: payload.propertyOfficer, caption: 'Head, Property Management Office' }
  ]);

  doc.fontSize(8).text('Copies for: Property Office, Borrowing Department', 50, doc.page.height - 50);
}

function renderTRF(doc, payload) {
  drawHeader(doc, 'Transfer Request Form', 'TRF No.:', payload.documentNumber);

  doc.fontSize(10).font('Helvetica-Bold').text('Transfer Code:', 50, doc.y, { continued: true });
  doc.font('Helvetica').text(` ${payload.transferCode || '________________'}`);
  doc.font('Helvetica-Bold').text('Request Date:', 350, doc.y - 12, { continued: true });
  doc.font('Helvetica').text(` ${payload.requestDate || '________________'}`);
  doc.font('Helvetica-Bold').text('From Department:', 50, doc.y, { continued: true });
  doc.font('Helvetica').text(` ${payload.fromDepartment || '________________'}`);
  doc.font('Helvetica-Bold').text('To Department:', 350, doc.y - 12, { continued: true });
  doc.font('Helvetica').text(` ${payload.toDepartment || '________________'}`);
  doc.font('Helvetica-Bold').text('From Location:', 50, doc.y, { continued: true });
  doc.font('Helvetica').text(` ${payload.fromLocation || '________________'}`);
  doc.font('Helvetica-Bold').text('To Location:', 350, doc.y - 12, { continued: true });
  doc.font('Helvetica').text(` ${payload.toLocation || '________________'}`);
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').text('Reason for Transfer:', 50, doc.y);
  doc.font('Helvetica').text(payload.reason || '', { width: 500 });
  doc.moveDown(0.8);

  drawTable(
    doc,
    ['Property Tag', 'Item Description', 'Quantity', 'Unit'],
    (payload.items || []).map(item => [
      item.propertyTag, item.description, item.quantity, item.unit
    ]),
    [90, 260, 60, 60]
  );

  doc.fontSize(8).font('Helvetica-Oblique').text(payload.acknowledgement || '', { align: 'justify' });

  drawSignatureBlock(doc, [
    { label: 'Requested by:', value: payload.requestedBy },
    { label: 'Approved by:', value: payload.approvedBy, caption: 'Property Office' },
    { label: 'Transferring Dept:', value: payload.fromDepartmentHead, caption: 'Department Head' },
    { label: 'Receiving Dept:', value: payload.toDepartmentHead, caption: 'Department Head' },
    { label: 'Received by:', value: payload.receivingSignatory, caption: 'Receiving Custodian' },
    { label: 'Noted by:', value: payload.propertyOfficer, caption: 'Head, Property Management Office' }
  ]);

  doc.fontSize(8).text('Copies for: Property Office, Transferring Department, Receiving Department', 50, doc.page.height - 50);
}

function renderSAL(doc, payload) {
  drawHeader(doc, 'Semi-Durable Acknowledgment Log', 'SAL No.:', payload.documentNumber);

  doc.fontSize(10).font('Helvetica-Bold').text('Department:', 50, doc.y, { continued: true });
  doc.font('Helvetica').text(` ${payload.department || '________________'}`);
  doc.font('Helvetica-Bold').text('Issue Date:', 350, doc.y - 12, { continued: true });
  doc.font('Helvetica').text(` ${payload.issueDate || '________________'}`);
  doc.moveDown(0.8);

  drawTable(
    doc,
    ['Item Code', 'Item Description', 'Quantity', 'Unit', 'Condition'],
    (payload.items || []).map(item => [
      item.itemCode, item.description, item.quantity, item.unit, item.condition || ''
    ]),
    [80, 220, 55, 55, 70]
  );

  doc.fontSize(8).font('Helvetica-Oblique').text(payload.acknowledgement || '', { align: 'justify' });

  drawSignatureBlock(doc, [
    { label: 'Issued by:', value: payload.issuedBy, caption: 'Property Manager' },
    { label: 'Received by:', value: payload.receivedBy, caption: 'Department Custodian' },
    { label: 'Noted by:', value: payload.departmentHead, caption: 'Department Head' },
    { label: 'Noted by:', value: payload.propertyOfficer, caption: 'Head, Property Management Office' }
  ]);

  doc.fontSize(8).text('Copies for: Property Office, Receiving Department', 50, doc.page.height - 50);
}

function renderRDF(doc, payload) {
  drawHeader(doc, 'REQUEST FOR DISPOSAL FORM', 'RDF No.:', payload.documentNumber);

  doc.fontSize(10).font('Helvetica-Bold').text('Requesting Department:', 50, doc.y, { continued: true });
  doc.font('Helvetica').text(` ${payload.requestingDepartment || '________________________'}`);
  doc.font('Helvetica-Bold').text('Date of Request:', 350, doc.y - 12, { continued: true });
  doc.font('Helvetica').text(` ${payload.dateOfRequest || '________________'}`);
  doc.moveDown(0.8);

  drawTable(
    doc,
    ['Item Description', 'Qty/Unit', 'Property Tag', 'PAR No.', 'ICT/FCU Evaluation/Recommendation'],
    (payload.items || []).map(item => [
      item.description, item.qtyUnit, item.propertyTag, item.parNo, item.recommendation
    ]),
    [120, 60, 70, 70, 160]
  );

  doc.fontSize(10).font('Helvetica-Bold').text('Reason for disposal:', 50, doc.y);
  doc.font('Helvetica').text(payload.reason || '', { width: 500 });
  doc.moveDown(0.5);

  drawSignatureBlock(doc, [
    { label: 'Requested by:', value: payload.requestedBy },
    { label: 'Request Noted by:', value: payload.departmentHead, caption: 'Department Head' },
    { label: 'Evaluated by:', value: payload.evaluatedBy, caption: 'ICT/FCU' },
    { label: 'Disposal Processed and Received by:', value: payload.disposalProcessedBy },
    { label: 'Date Processed:', value: payload.dateProcessed },
    { label: 'Request for Disposal Approved by:', value: payload.approvedBy, caption: 'Head, PPMO' },
    { label: 'Date Approved:', value: payload.dateApproved }
  ]);

  doc.fontSize(8).text(payload.footerNote || 'Copies for: Property Office, Requesting Department, Accounting Office', 50, doc.page.height - 50);
}

function generateDocumentPdf(documentRecord, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const filename = `${documentRecord.document_number}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  doc.pipe(res);

  const payload = documentRecord.payload || {};

  switch (documentRecord.document_type) {
    case 'PAR':
      renderPAR(doc, payload);
      break;
    case 'GRN':
      renderGRN(doc, payload);
      break;
    case 'RDF':
      renderRDF(doc, payload);
      break;
    case 'ABL':
      renderABL(doc, payload);
      break;
    case 'TRF':
      renderTRF(doc, payload);
      break;
    case 'SAL':
      renderSAL(doc, payload);
      break;
    default:
      doc.text('Unsupported document type');
  }

  doc.end();
}

module.exports = { generateDocumentPdf };
