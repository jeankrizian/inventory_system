const PDFDocument = require('pdfkit');

const INSTITUTION = 'Cavite Institute';
const OFFICE = 'Property Management Office';
const PAGE_BOTTOM_RESERVE = 70;
const LEFT_COL_X = 50;
const RIGHT_COL_X = 320;
const COL_WIDTH = 230;
const CONTENT_WIDTH = 500;

function pageBottomLimit(doc) {
  return doc.page.height - PAGE_BOTTOM_RESERVE;
}

function ensureSpace(doc, neededHeight) {
  if (doc.y + neededHeight > pageBottomLimit(doc)) {
    doc.addPage();
  }
}

function drawFooter(doc, text) {
  ensureSpace(doc, 24);
  doc.moveDown(0.5);
  doc.fontSize(8).font('Helvetica').text(text || '', LEFT_COL_X, doc.y, {
    width: CONTENT_WIDTH,
    align: 'left'
  });
}

function fieldTextHeight(doc, label, value, width) {
  const display = `${label}: ${value || '________________________'}`;
  doc.fontSize(10).font('Helvetica');
  return doc.heightOfString(display, { width });
}

function drawMetaPair(doc, left, right) {
  const startY = doc.y;
  const rowHeight = Math.max(
    left ? fieldTextHeight(doc, left.label, left.value, COL_WIDTH) : 0,
    right ? fieldTextHeight(doc, right.label, right.value, COL_WIDTH) : 0
  );

  ensureSpace(doc, rowHeight + 6);

  const y = doc.y;
  if (left) {
    doc.fontSize(10).font('Helvetica-Bold').text(`${left.label}:`, LEFT_COL_X, y, { continued: true, width: COL_WIDTH });
    doc.font('Helvetica').text(` ${left.value || '________________________'}`, { width: COL_WIDTH });
  }
  if (right) {
    doc.fontSize(10).font('Helvetica-Bold').text(`${right.label}:`, RIGHT_COL_X, y, { continued: true, width: COL_WIDTH });
    doc.font('Helvetica').text(` ${right.value || '________________________'}`, { width: COL_WIDTH });
  }

  doc.y = y + rowHeight + 4;
  doc.x = LEFT_COL_X;
}

function drawFullWidthField(doc, label, value) {
  const width = CONTENT_WIDTH;
  const height = fieldTextHeight(doc, label, value, width);
  ensureSpace(doc, height + 6);

  const y = doc.y;
  doc.fontSize(10).font('Helvetica-Bold').text(`${label}:`, LEFT_COL_X, y, { continued: true, width });
  doc.font('Helvetica').text(` ${value || '________________________'}`, { width });
  doc.y = Math.max(doc.y, y + height) + 4;
  doc.x = LEFT_COL_X;
}

function drawHeader(doc, title, rightLabel, rightValue) {
  doc.fontSize(14).font('Helvetica-Bold').text(title, { align: 'center' });
  doc.fontSize(11).font('Helvetica-Bold').text(OFFICE, { align: 'center' });
  doc.fontSize(10).font('Helvetica').text(INSTITUTION, { align: 'center' });
  doc.moveDown(0.8);

  if (rightLabel) {
    const y = doc.y;
    const width = COL_WIDTH;
    const height = fieldTextHeight(doc, rightLabel.replace(/:$/, ''), rightValue, width);
    doc.fontSize(10).font('Helvetica-Bold').text(`${rightLabel}`, RIGHT_COL_X, y, { continued: true, width });
    doc.font('Helvetica').text(` ${rightValue || ''}`, { width });
    doc.y = Math.max(doc.y, y + height) + 4;
    doc.x = LEFT_COL_X;
  }
}

function cellTextHeight(doc, text, width, fontSize = 9) {
  doc.fontSize(fontSize).font('Helvetica');
  return doc.heightOfString(String(text ?? ''), { width }) + 12;
}

function drawTable(doc, headers, rows, colWidths) {
  const startX = doc.page.margins.left;
  const paddingX = 4;
  const paddingY = 6;
  const minRowHeight = 20;
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);

  function drawHeaderRow(y) {
    let headerHeight = minRowHeight;
    headers.forEach((header, i) => {
      const innerWidth = colWidths[i] - paddingX * 2;
      headerHeight = Math.max(headerHeight, cellTextHeight(doc, header, innerWidth, 9));
    });

    let x = startX;
    doc.fontSize(9).font('Helvetica-Bold');
    headers.forEach((header, i) => {
      doc.rect(x, y, colWidths[i], headerHeight).stroke();
      doc.text(header, x + paddingX, y + paddingY, { width: colWidths[i] - paddingX * 2, align: 'left' });
      x += colWidths[i];
    });

    return { nextY: y + headerHeight, headerHeight };
  }

  let y = doc.y;
  ensureSpace(doc, minRowHeight * 2);

  const headerResult = drawHeaderRow(y);
  y = headerResult.nextY;

  doc.font('Helvetica');
  rows.forEach((row) => {
    let rowHeight = minRowHeight;
    row.forEach((cell, i) => {
      const innerWidth = colWidths[i] - paddingX * 2;
      rowHeight = Math.max(rowHeight, cellTextHeight(doc, cell, innerWidth, 9));
    });

    if (y + rowHeight > pageBottomLimit(doc)) {
      doc.addPage();
      y = doc.page.margins.top;
      const repeatedHeader = drawHeaderRow(y);
      y = repeatedHeader.nextY;
      doc.font('Helvetica');
    }

    let x = startX;
    row.forEach((cell, i) => {
      doc.rect(x, y, colWidths[i], rowHeight).stroke();
      doc.text(String(cell ?? ''), x + paddingX, y + paddingY, {
        width: colWidths[i] - paddingX * 2,
        align: 'left'
      });
      x += colWidths[i];
    });
    y += rowHeight;
  });

  doc.y = y + 8;
  doc.x = startX;
}

function measureSignatureBlock(doc, block, width) {
  if (!block) return 0;

  doc.fontSize(9).font('Helvetica');
  let height = doc.heightOfString(block.label || '', { width });

  if (block.value) {
    doc.font('Helvetica-Bold');
    height += Math.max(doc.heightOfString(block.value, { width }), 14);
  } else {
    height += 14;
  }

  height += 8;

  if (block.caption) {
    doc.fontSize(8).font('Helvetica');
    height += doc.heightOfString(block.caption, { width });
  }

  return height + 8;
}

function drawSingleSignature(doc, block, x, y, width) {
  doc.fontSize(9).font('Helvetica').text(block.label || '', x, y, { width });
  const labelHeight = doc.heightOfString(block.label || '', { width });
  const nameY = y + labelHeight + 2;

  if (block.value) {
    doc.font('Helvetica-Bold').text(block.value, x, nameY, { width, align: 'center' });
  }

  const nameHeight = block.value
    ? doc.heightOfString(block.value, { width })
    : 14;
  const lineY = nameY + Math.max(nameHeight, 14) + 4;
  doc.moveTo(x, lineY).lineTo(x + width, lineY).stroke();

  if (block.caption) {
    doc.fontSize(8).font('Helvetica').text(block.caption, x, lineY + 4, { width, align: 'center' });
  }
}

function drawSignatureBlock(doc, blocks) {
  doc.moveDown(0.5);

  for (let i = 0; i < blocks.length; i += 2) {
    const left = blocks[i];
    const right = blocks[i + 1];
    const leftHeight = measureSignatureBlock(doc, left, COL_WIDTH);
    const rightHeight = right ? measureSignatureBlock(doc, right, COL_WIDTH) : 0;
    const rowHeight = Math.max(leftHeight, rightHeight);

    ensureSpace(doc, rowHeight + 8);
    const y = doc.y;

    drawSingleSignature(doc, left, LEFT_COL_X, y, COL_WIDTH);
    if (right) {
      drawSingleSignature(doc, right, RIGHT_COL_X, y, COL_WIDTH);
    }

    doc.y = y + rowHeight + 6;
    doc.x = LEFT_COL_X;
  }
}

function drawAcknowledgement(doc, text) {
  if (!text) return;
  ensureSpace(doc, 30);
  doc.fontSize(8).font('Helvetica-Oblique').text(text, LEFT_COL_X, doc.y, {
    width: CONTENT_WIDTH,
    align: 'justify'
  });
  doc.moveDown(0.5);
}

function renderPAR(doc, payload) {
  drawHeader(doc, 'Property Acknowledgement Receipt', 'PAR #:', payload.documentNumber);

  drawMetaPair(doc, { label: 'Supplier', value: payload.supplier }, null);
  drawMetaPair(
    doc,
    { label: 'Department', value: payload.department },
    { label: 'Delivery Date', value: payload.deliveryDate }
  );
  doc.moveDown(0.3);

  drawTable(
    doc,
    ['Property Tag Number', 'Item Description', 'Quantity', 'Unit', 'Amount'],
    (payload.items || []).map(item => [
      item.propertyTag, item.description, item.quantity, item.unit, item.amount || ''
    ]),
    [90, 220, 55, 55, 70]
  );

  drawAcknowledgement(doc, payload.acknowledgement);

  drawSignatureBlock(doc, [
    { label: 'Prepared by:', value: payload.preparedBy, caption: 'Property Officer' },
    { label: 'Received by:', value: payload.receivedBy, caption: 'Custodian' },
    { label: 'Noted by:', value: payload.departmentHead, caption: 'Department Head' },
    { label: 'Noted by:', value: payload.propertyOfficer, caption: 'Head, Property Management Office' }
  ]);

  drawFooter(doc, 'Copies for: Property Office, Receiving Department');
}

function renderGRN(doc, payload) {
  drawHeader(doc, 'Goods Received Note', 'GRN No.:', payload.documentNumber);

  drawMetaPair(doc, { label: 'Department', value: payload.department }, null);
  drawMetaPair(
    doc,
    { label: 'PR No.', value: payload.purchaseRequestNumber || payload.mrfNumber },
    { label: 'MRF No/s', value: payload.mrfNumber }
  );
  drawMetaPair(doc, { label: 'PO No.', value: payload.purchaseOrderNumber }, null);
  drawMetaPair(doc, { label: 'Invoice No.', value: payload.invoiceNumber }, null);
  doc.moveDown(0.3);

  drawTable(
    doc,
    ['Item Description', 'Qty', 'Unit', 'Unit Cost', 'Total Amount'],
    (payload.items || []).map(item => [
      item.description, item.quantity, item.unit, item.unitCost || '', item.totalAmount || ''
    ]),
    [220, 55, 55, 80, 90]
  );

  drawAcknowledgement(doc, payload.acknowledgement);

  drawFullWidthField(doc, 'Received by', payload.receivedBy);
  drawFullWidthField(doc, 'Date Received', payload.dateReceived);
  drawFullWidthField(doc, 'Noted by', payload.notedBy);
  doc.fontSize(8).font('Helvetica').text('Procurement and Property Management Head', LEFT_COL_X, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(0.5);

  drawFooter(doc, 'Copies for: Purchasing Office, Receiving Department, Property Office');
}

function renderABL(doc, payload) {
  drawHeader(doc, 'Asset Borrowing Log', 'ABL No.:', payload.documentNumber);

  drawMetaPair(doc, { label: 'Borrow Code', value: payload.borrowCode }, null);
  drawMetaPair(
    doc,
    { label: 'Borrower', value: payload.borrowerName },
    { label: 'Borrow Date', value: payload.borrowDate }
  );
  drawMetaPair(
    doc,
    { label: 'Department', value: payload.borrowerDepartment },
    { label: 'Expected Return', value: payload.expectedReturnDate }
  );
  drawFullWidthField(doc, 'Purpose', payload.purpose);
  doc.moveDown(0.3);

  drawTable(
    doc,
    ['Property Tag', 'Item Description', 'Quantity', 'Unit'],
    (payload.items || []).map(item => [
      item.propertyTag, item.description, item.quantity, item.unit
    ]),
    [90, 260, 60, 60]
  );

  drawAcknowledgement(doc, payload.acknowledgement);

  drawSignatureBlock(doc, [
    { label: 'Borrower:', value: payload.borrowerName, caption: 'Signature over Printed Name' },
    { label: 'Approved by:', value: payload.approvedBy, caption: 'Property Office' },
    { label: 'Noted by:', value: payload.departmentHead, caption: 'Department Head' },
    { label: 'Noted by:', value: payload.propertyOfficer, caption: 'Head, Property Management Office' }
  ]);

  drawFooter(doc, 'Copies for: Property Office, Borrowing Department');
}

function renderTRF(doc, payload) {
  drawHeader(doc, 'Transfer Request Form', 'TRF No.:', payload.documentNumber);

  drawMetaPair(
    doc,
    { label: 'Transfer Code', value: payload.transferCode },
    { label: 'Request Date', value: payload.requestDate }
  );
  drawMetaPair(
    doc,
    { label: 'From Department', value: payload.fromDepartment },
    { label: 'To Department', value: payload.toDepartment }
  );
  drawMetaPair(
    doc,
    { label: 'From Location', value: payload.fromLocation },
    { label: 'To Location', value: payload.toLocation }
  );
  drawFullWidthField(doc, 'Reason for Transfer', payload.reason);
  doc.moveDown(0.3);

  drawTable(
    doc,
    ['Property Tag', 'Item Description', 'Quantity', 'Unit'],
    (payload.items || []).map(item => [
      item.propertyTag, item.description, item.quantity, item.unit
    ]),
    [90, 260, 60, 60]
  );

  drawAcknowledgement(doc, payload.acknowledgement);

  drawSignatureBlock(doc, [
    { label: 'Requested by:', value: payload.requestedBy },
    { label: 'Approved by:', value: payload.approvedBy, caption: 'Property Office' },
    { label: 'Transferring Dept:', value: payload.fromDepartmentHead, caption: 'Department Head' },
    { label: 'Receiving Dept:', value: payload.toDepartmentHead, caption: 'Department Head' },
    { label: 'Received by:', value: payload.receivingSignatory, caption: 'Receiving Custodian' },
    { label: 'Noted by:', value: payload.propertyOfficer, caption: 'Head, Property Management Office' }
  ]);

  drawFooter(doc, 'Copies for: Property Office, Transferring Department, Receiving Department');
}

function renderSAL(doc, payload) {
  drawHeader(doc, 'Semi-Durable Acknowledgment Log', 'SAL No.:', payload.documentNumber);

  drawMetaPair(
    doc,
    { label: 'Department', value: payload.department },
    { label: 'Issue Date', value: payload.issueDate }
  );
  doc.moveDown(0.3);

  drawTable(
    doc,
    ['Item Code', 'Item Description', 'Quantity', 'Unit', 'Condition'],
    (payload.items || []).map(item => [
      item.itemCode, item.description, item.quantity, item.unit, item.condition || ''
    ]),
    [80, 220, 55, 55, 70]
  );

  drawAcknowledgement(doc, payload.acknowledgement);

  drawSignatureBlock(doc, [
    { label: 'Issued by:', value: payload.issuedBy, caption: 'Property Manager' },
    { label: 'Received by:', value: payload.receivedBy, caption: 'Custodian' },
    { label: 'Noted by:', value: payload.departmentHead, caption: 'Department Head' },
    { label: 'Noted by:', value: payload.propertyOfficer, caption: 'Head, Property Management Office' }
  ]);

  drawFooter(doc, 'Copies for: Property Office, Receiving Department');
}

function renderRDF(doc, payload) {
  drawHeader(doc, 'REQUEST FOR DISPOSAL FORM', 'RDF No.:', payload.documentNumber);

  drawMetaPair(
    doc,
    { label: 'Requesting Department', value: payload.requestingDepartment },
    { label: 'Date of Request', value: payload.dateOfRequest }
  );
  doc.moveDown(0.3);

  drawTable(
    doc,
    ['Item Description', 'Qty/Unit', 'Property Tag', 'PAR No.', 'ICT/FCU Evaluation/Recommendation'],
    (payload.items || []).map(item => [
      item.description, item.qtyUnit, item.propertyTag, item.parNo, item.recommendation
    ]),
    [120, 60, 70, 70, 160]
  );

  drawFullWidthField(doc, 'Reason for disposal', payload.reason);
  doc.moveDown(0.3);

  drawSignatureBlock(doc, [
    { label: 'Requested by:', value: payload.requestedBy },
    { label: 'Request Noted by:', value: payload.departmentHead, caption: 'Department Head' },
    { label: 'Evaluated by:', value: payload.evaluatedBy, caption: 'ICT/FCU' },
    { label: 'Disposal Processed and Received by:', value: payload.disposalProcessedBy },
    { label: 'Date Processed:', value: payload.dateProcessed },
    { label: 'Request for Disposal Approved by:', value: payload.approvedBy, caption: 'Head, PPMO' },
    { label: 'Date Approved:', value: payload.dateApproved }
  ]);

  drawFooter(doc, payload.footerNote || 'Copies for: Property Office, Requesting Department, Accounting Office');
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
