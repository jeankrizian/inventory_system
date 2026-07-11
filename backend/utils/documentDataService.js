const pool = require('../config/database');
const InventoryModel = require('../models/InventoryModel');
const BorrowModel = require('../models/BorrowModel');
const DisposalModel = require('../models/DisposalModel');
const TransferModel = require('../models/TransferModel');
const DocumentModel = require('../models/DocumentModel');
const { getNextDocumentNumber } = require('./documentNumber');
const { isFixedAsset, normalizeClassification } = require('./assetClassification');

function isSemiDurable(classification) {
  return normalizeClassification(classification) === 'Semi-Durable';
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Match inventory report acquisition COALESCE — never fall back to "now". */
function resolveAcquisitionDate(item) {
  return item?.acquisition_date || item?.created_at || null;
}

function formatMoney(value) {
  const num = parseFloat(value);
  if (Number.isNaN(num)) return '';
  return num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function getDepartmentHead(departmentId) {
  if (!departmentId) return '';
  const [rows] = await pool.query(
    'SELECT department_head FROM departments WHERE id = ?',
    [departmentId]
  );
  return rows[0]?.department_head || '';
}

async function getPropertyOfficerName() {
  const [rows] = await pool.query(
    `SELECT u.full_name FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE r.name IN ('admin', 'Property Manager') AND u.is_active = 1
     ORDER BY FIELD(r.name, 'Property Manager', 'admin')
     LIMIT 1`
  );
  return rows[0]?.full_name || 'Property Officer';
}

async function buildABLPayloadFromBorrow(borrowId) {
  const transaction = await BorrowModel.findById(borrowId);
  if (!transaction) throw new Error('Borrow transaction not found');

  const [items] = await pool.query(
    `SELECT bi.quantity, i.item_name, i.item_code, i.property_tag, i.brand, i.model,
            i.department_id, d.name AS department_name
     FROM borrow_items bi
     JOIN inventory_items i ON bi.inventory_item_id = i.id
     LEFT JOIN departments d ON i.department_id = d.id
     WHERE bi.borrow_transaction_id = ?`,
    [borrowId]
  );

  const department = transaction.borrower_department || items[0]?.department_name || '';
  const departmentId = items[0]?.department_id;

  return {
    borrowCode: transaction.transaction_code,
    borrowerName: transaction.borrower_name || '',
    borrowerDepartment: department,
    purpose: transaction.purpose || '',
    borrowDate: formatDate(transaction.borrow_date),
    expectedReturnDate: formatDate(transaction.expected_return_date),
    items: items.map(item => ({
      propertyTag: item.property_tag || '-',
      description: [item.item_name, item.brand, item.model].filter(Boolean).join(' / '),
      quantity: item.quantity || 1,
      unit: 'pcs'
    })),
    approvedBy: transaction.approver_name || await getPropertyOfficerName(),
    departmentHead: await getDepartmentHead(departmentId),
    propertyOfficer: await getPropertyOfficerName(),
    acknowledgement: 'I hereby acknowledge receipt of the borrowed asset(s) listed above and agree to return them in good condition on or before the expected return date. I accept responsibility for the care and safekeeping of the item(s) while in my custody.'
  };
}

async function buildTRFPayloadFromTransfer(transferId) {
  const transfer = await TransferModel.findById(transferId);
  if (!transfer) throw new Error('Transfer request not found');

  const item = await InventoryModel.findById(transfer.inventory_item_id);
  if (!item) throw new Error('Inventory item not found');

  return {
    transferCode: transfer.transaction_code,
    requestDate: formatDate(transfer.request_date || transfer.created_at),
    approvedDate: formatDate(transfer.approved_at || new Date()),
    fromDepartment: transfer.from_department_name || '-',
    toDepartment: transfer.to_department_name || '-',
    fromLocation: transfer.from_location_name || '-',
    toLocation: transfer.to_location_name || '-',
    reason: transfer.reason || '',
    items: [{
      propertyTag: item.property_tag || '-',
      description: [item.item_name, item.brand, item.model].filter(Boolean).join(' / '),
      quantity: transfer.quantity || 1,
      unit: 'pcs'
    }],
    requestedBy: transfer.requested_by_name || '',
    approvedBy: transfer.approved_by_name || await getPropertyOfficerName(),
    transferringSignatory: transfer.requested_by_name || '',
    receivingSignatory: item.custodian_name || '',
    fromDepartmentHead: await getDepartmentHead(transfer.from_department_id),
    toDepartmentHead: await getDepartmentHead(transfer.to_department_id),
    propertyOfficer: await getPropertyOfficerName(),
    acknowledgement: 'The transferring and receiving departments acknowledge the movement of the asset(s) listed above. The Property Office confirms that inventory records have been updated accordingly.'
  };
}

async function buildSALPayloadFromInventory(inventoryId, generatedBy) {
  const item = await InventoryModel.findById(inventoryId);
  if (!item) throw new Error('Inventory item not found');
  if (!isSemiDurable(item.asset_classification)) throw new Error('SAL is only for semi-durable items');
  if (!item.department_id) throw new Error('Department assignment is required for SAL generation');

  let issuedBy = '';
  if (generatedBy) {
    const [rows] = await pool.query('SELECT full_name FROM users WHERE id = ?', [generatedBy]);
    issuedBy = rows[0]?.full_name || '';
  }

  return {
    department: item.department_name || '',
    issueDate: formatDate(resolveAcquisitionDate(item)),
    items: [{
      itemCode: item.item_code || '-',
      description: [item.item_name, item.brand, item.model].filter(Boolean).join(' / '),
      quantity: 1,
      unit: 'pcs',
      condition: item.condition || 'Good'
    }],
    issuedBy: issuedBy || await getPropertyOfficerName(),
    receivedBy: item.custodian_name || '',
    departmentHead: await getDepartmentHead(item.department_id),
    propertyOfficer: await getPropertyOfficerName(),
    acknowledgement: 'The assigned custodian acknowledges receipt of the semi-durable item(s) listed above and accepts responsibility for monitoring usage, safekeeping, and reporting any loss or damage to the Property Office.'
  };
}

async function buildPARPayloadFromInventory(inventoryId, generatedBy) {
  const item = await InventoryModel.findById(inventoryId);
  if (!item) throw new Error('Inventory item not found');
  if (!isFixedAsset(item.asset_classification)) throw new Error('PAR is only for fixed assets');
  if (!item.custodian_id) throw new Error('Custodian assignment is required for PAR generation');

  let preparedBy = '';
  if (generatedBy) {
    const [rows] = await pool.query('SELECT full_name FROM users WHERE id = ?', [generatedBy]);
    preparedBy = rows[0]?.full_name || '';
  }

  const unitCost = item.unit_cost != null ? parseFloat(item.unit_cost) : null;
  const amountValue = unitCost != null && !Number.isNaN(unitCost) ? unitCost : null;

  return {
    supplier: item.supplier_name || '',
    department: item.department_name || '',
    deliveryDate: formatDate(resolveAcquisitionDate(item)),
    items: [{
      propertyTag: item.property_tag || '-',
      description: [item.item_name, item.brand, item.model].filter(Boolean).join(' / '),
      quantity: 1,
      unit: 'pcs',
      amount: amountValue != null ? formatMoney(amountValue) : ''
    }],
    preparedBy: preparedBy || await getPropertyOfficerName(),
    receivedBy: item.custodian_name || '',
    departmentHead: await getDepartmentHead(item.department_id),
    propertyOfficer: await getPropertyOfficerName(),
    acknowledgement: 'I acknowledge receipt of the listed property/items and accept full responsibility for their care and custody. I agree to use them only for official purposes and report any damage, loss, or theft to the Property Office immediately. I understand I may be liable for replacement costs if they are lost, damaged through negligence, or misused.'
  };
}

async function buildGRNPayload(inventoryId, generatedBy) {
  const item = await InventoryModel.findById(inventoryId);
  if (!item) throw new Error('Inventory item not found');

  let receivedBy = item.custodian_name || '';
  if (generatedBy) {
    const [rows] = await pool.query('SELECT full_name FROM users WHERE id = ?', [generatedBy]);
    receivedBy = rows[0]?.full_name || receivedBy;
  }

  const unitCost = item.unit_cost != null ? parseFloat(item.unit_cost) : null;
  const totalCost = unitCost != null && !Number.isNaN(unitCost) ? unitCost : null;

  return {
    department: item.department_name || '',
    mrfNumber: item.purchase_request_number || item.item_code || '',
    purchaseRequestNumber: item.purchase_request_number || '',
    purchaseOrderNumber: item.purchase_order_number || '',
    invoiceNumber: item.invoice_number || '',
    items: [{
      description: [item.item_name, item.brand, item.model].filter(Boolean).join(' / '),
      quantity: 1,
      unit: 'pcs',
      unitCost: unitCost != null && !Number.isNaN(unitCost) ? formatMoney(unitCost) : '',
      totalAmount: totalCost != null ? formatMoney(totalCost) : ''
    }],
    dateReceived: formatDate(resolveAcquisitionDate(item)),
    receivedBy,
    notedBy: await getPropertyOfficerName(),
    acknowledgement: 'I hereby acknowledge receipt of the items listed in this report in good condition as per the approved MRF/Purchase Order.'
  };
}

async function buildRDFPayload(disposalId) {
  const [rows] = await pool.query(
    `SELECT d.*, i.item_code, i.item_name, i.property_tag, i.brand, i.model,
            i.department_id, dept.name AS department_name,
            req.full_name AS requested_by_name,
            ins.full_name AS inspected_by_name,
            app.full_name AS approved_by_name
     FROM disposal_requests d
     JOIN inventory_items i ON d.inventory_item_id = i.id
     LEFT JOIN departments dept ON i.department_id = dept.id
     JOIN users req ON d.requested_by = req.id
     LEFT JOIN users ins ON d.inspected_by = ins.id
     LEFT JOIN users app ON d.approved_by = app.id
     WHERE d.id = ?`,
    [disposalId]
  );
  const disposal = rows[0];
  if (!disposal) throw new Error('Disposal request not found');

  const parDoc = await DocumentModel.findByTransaction('PAR', 'inventory', disposal.inventory_item_id);

  return {
    requestingDepartment: disposal.department_name || '',
    dateOfRequest: formatDate(disposal.created_at),
    items: [{
      description: [disposal.item_name, disposal.brand, disposal.model].filter(Boolean).join(' / '),
      qtyUnit: `${disposal.quantity || 1} unit`,
      propertyTag: disposal.property_tag || '-',
      parNo: parDoc?.document_number || '-',
      recommendation: disposal.inspection_notes || disposal.disposal_method || 'For evaluation'
    }],
    reason: disposal.reason || '',
    requestedBy: disposal.requested_by_name || '',
    departmentHead: await getDepartmentHead(disposal.department_id),
    evaluatedBy: disposal.inspected_by_name || '',
    disposalProcessedBy: disposal.approved_by_name || '',
    dateProcessed: formatDate(disposal.disposal_date),
    approvedBy: disposal.approved_by_name || '',
    dateApproved: formatDate(disposal.disposal_date || disposal.updated_at),
    footerNote: 'Copies for: Property Office, Requesting Department, Accounting Office'
  };
}

async function generateDocument({ documentType, relatedModule, relatedTransactionId, generatedBy, payloadBuilder }) {
  const existing = await DocumentModel.findByTransaction(documentType, relatedModule, relatedTransactionId);
  if (existing) return existing;

  const documentNumber = await getNextDocumentNumber(documentType);
  const payload = await payloadBuilder();
  payload.documentNumber = documentNumber;

  const id = await DocumentModel.create({
    document_type: documentType,
    document_number: documentNumber,
    related_module: relatedModule,
    related_transaction_id: relatedTransactionId,
    generated_by: generatedBy,
    payload
  });

  return DocumentModel.findById(id);
}

const DocumentDataService = {
  formatDate,
  formatMoney,

  async generateABLForBorrow(borrowId, generatedBy) {
    return generateDocument({
      documentType: 'ABL',
      relatedModule: 'borrow',
      relatedTransactionId: borrowId,
      generatedBy,
      payloadBuilder: () => buildABLPayloadFromBorrow(borrowId)
    });
  },

  async generateTRFForTransfer(transferId, generatedBy) {
    return generateDocument({
      documentType: 'TRF',
      relatedModule: 'transfer',
      relatedTransactionId: transferId,
      generatedBy,
      payloadBuilder: () => buildTRFPayloadFromTransfer(transferId)
    });
  },

  async generateSALForSemiDurableIssuance(inventoryId, generatedBy) {
    const item = await InventoryModel.findById(inventoryId);
    if (!item || !isSemiDurable(item.asset_classification) || !item.department_id) return null;

    return generateDocument({
      documentType: 'SAL',
      relatedModule: 'inventory',
      relatedTransactionId: inventoryId,
      generatedBy,
      payloadBuilder: () => buildSALPayloadFromInventory(inventoryId, generatedBy)
    });
  },

  async refreshSALForSemiDurableIssuance(inventoryId, generatedBy) {
    const item = await InventoryModel.findById(inventoryId);
    if (!item || !isSemiDurable(item.asset_classification) || !item.department_id) return null;

    const existing = await DocumentModel.findByTransaction('SAL', 'inventory', inventoryId);
    const payload = await buildSALPayloadFromInventory(inventoryId, generatedBy);
    if (existing) {
      payload.documentNumber = existing.payload?.documentNumber || existing.document_number;
      await DocumentModel.updatePayload(existing.id, payload, 'Updated');
      return DocumentModel.findById(existing.id);
    }

    return generateDocument({
      documentType: 'SAL',
      relatedModule: 'inventory',
      relatedTransactionId: inventoryId,
      generatedBy,
      payloadBuilder: () => buildSALPayloadFromInventory(inventoryId, generatedBy)
    });
  },

  async generatePARForCustodianAssignment(inventoryId, generatedBy) {
    const item = await InventoryModel.findById(inventoryId);
    if (!item || !isFixedAsset(item.asset_classification) || !item.custodian_id) return null;

    return generateDocument({
      documentType: 'PAR',
      relatedModule: 'inventory',
      relatedTransactionId: inventoryId,
      generatedBy,
      payloadBuilder: () => buildPARPayloadFromInventory(inventoryId, generatedBy)
    });
  },

  async refreshPARForCustodianAssignment(inventoryId, generatedBy) {
    const item = await InventoryModel.findById(inventoryId);
    if (!item || !isFixedAsset(item.asset_classification) || !item.custodian_id) return null;

    const existing = await DocumentModel.findByTransaction('PAR', 'inventory', inventoryId);
    const payload = await buildPARPayloadFromInventory(inventoryId, generatedBy);
    if (existing) {
      payload.documentNumber = existing.payload?.documentNumber || existing.document_number;
      await DocumentModel.updatePayload(existing.id, payload, 'Updated');
      return DocumentModel.findById(existing.id);
    }

    return generateDocument({
      documentType: 'PAR',
      relatedModule: 'inventory',
      relatedTransactionId: inventoryId,
      generatedBy,
      payloadBuilder: () => buildPARPayloadFromInventory(inventoryId, generatedBy)
    });
  },

  async generateGRN(inventoryId, generatedBy) {
    return generateDocument({
      documentType: 'GRN',
      relatedModule: 'inventory',
      relatedTransactionId: inventoryId,
      generatedBy,
      payloadBuilder: () => buildGRNPayload(inventoryId, generatedBy)
    });
  },

  async refreshGRN(inventoryId, generatedBy) {
    const existing = await DocumentModel.findByTransaction('GRN', 'inventory', inventoryId);
    const payload = await buildGRNPayload(inventoryId, generatedBy);
    if (existing) {
      payload.documentNumber = existing.payload?.documentNumber || existing.document_number;
      await DocumentModel.updatePayload(existing.id, payload, 'Updated');
      return DocumentModel.findById(existing.id);
    }
    return generateDocument({
      documentType: 'GRN',
      relatedModule: 'inventory',
      relatedTransactionId: inventoryId,
      generatedBy,
      payloadBuilder: () => buildGRNPayload(inventoryId, generatedBy)
    });
  },

  async generateRDF(disposalId, generatedBy) {
    return generateDocument({
      documentType: 'RDF',
      relatedModule: 'disposal',
      relatedTransactionId: disposalId,
      generatedBy,
      payloadBuilder: () => buildRDFPayload(disposalId)
    });
  },

  async refreshRDF(disposalId, generatedBy) {
    const existing = await DocumentModel.findByTransaction('RDF', 'disposal', disposalId);
    const payload = await buildRDFPayload(disposalId);
    if (existing) {
      payload.documentNumber = existing.payload?.documentNumber || existing.document_number;
      await DocumentModel.updatePayload(existing.id, payload, 'Updated');
      return DocumentModel.findById(existing.id);
    }
    return generateDocument({
      documentType: 'RDF',
      relatedModule: 'disposal',
      relatedTransactionId: disposalId,
      generatedBy,
      payloadBuilder: () => buildRDFPayload(disposalId)
    });
  }
};

module.exports = DocumentDataService;
