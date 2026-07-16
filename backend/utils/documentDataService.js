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

function canGenerateAcquisitionPar(classification) {
  return isFixedAsset(classification) || isSemiDurable(classification);
}

function formatParClassification(classification) {
  const normalized = normalizeClassification(classification);
  if (normalized === 'Semi-Durable') return 'Semi-Durable';
  if (isFixedAsset(classification)) return 'Durable';
  return normalized || '';
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

async function getDepartmentCustodianName(departmentId) {
  if (!departmentId) return '';
  const [rows] = await pool.query(
    `SELECT u.full_name
     FROM departments d
     LEFT JOIN users u ON d.custodian_id = u.id
     WHERE d.id = ?`,
    [departmentId]
  );
  return rows[0]?.full_name || '';
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

  const parDoc = await DocumentModel.findByTransaction('PAR', 'inventory', transfer.inventory_item_id);
  const qty = transfer.quantity || 1;
  const description = [item.item_name, item.brand, item.model].filter(Boolean).join(' / ');
  const newCustodian = await getDepartmentCustodianName(transfer.to_department_id);

  return {
    requestingDepartment: transfer.from_department_name || '',
    dateOfRequest: formatDate(transfer.request_date || transfer.created_at),
    transferCode: transfer.transaction_code || '',
    fromDepartment: transfer.from_department_name || '',
    toDepartment: transfer.to_department_name || '',
    fromLocation: transfer.from_location_name || '',
    toLocation: transfer.to_location_name || '',
    reason: transfer.reason || '',
    items: [{
      description,
      qtyUnit: `${qty} pcs`,
      propertyTag: item.property_tag || '',
      parNo: parDoc?.document_number || '',
      quantity: qty,
      unit: 'pcs'
    }],
    requestedBy: transfer.requested_by_name || '',
    departmentHead: await getDepartmentHead(transfer.from_department_id),
    receivingSignatory: newCustodian || item.custodian_name || '',
    dateProcessed: formatDate(transfer.approved_at),
    approvedBy: transfer.approved_by_name || '',
    dateApproved: formatDate(transfer.approved_at),
    propertyOfficer: await getPropertyOfficerName(),
    acknowledgement: 'I acknowledge receipt of the listed property/items and accept full responsibility for their care and custody. I agree to use them only for official purposes and report any damage, loss, or theft to the Property Office immediately. I understand I may be liable for replacement costs if they are lost, damaged through negligence, or misused.',
    footerNote: 'Copies for: Property Office, Requesting Department, Accounting Office'
  };
}

function resolveDocumentUnit(item) {
  const unit = item?.unit || item?.unit_of_measure || item?.uom;
  if (unit != null && String(unit).trim()) return String(unit).trim();
  return 'pcs';
}

async function buildPARPayloadFromInventory(inventoryId, generatedBy) {
  const item = await InventoryModel.findById(inventoryId);
  if (!item) throw new Error('Inventory item not found');
  if (!canGenerateAcquisitionPar(item.asset_classification)) {
    throw new Error('PAR is only for Durable and Semi-Durable items');
  }

  let preparedBy = '';
  if (generatedBy) {
    const [rows] = await pool.query('SELECT full_name FROM users WHERE id = ?', [generatedBy]);
    preparedBy = rows[0]?.full_name || '';
  }

  // 1 asset = 1 PAR: property tag on PAR must match inventory table exactly
  const propertyTag = String(item.property_tag || '').trim();
  if (!propertyTag) {
    throw new Error(`Cannot generate PAR: inventory #${inventoryId} has no property tag`);
  }
  const propertyTags = [propertyTag];
  const quantity = 1;
  const unitCost = item.unit_cost != null ? parseFloat(item.unit_cost) : null;
  const amountValue = unitCost != null && !Number.isNaN(unitCost) ? unitCost : null;
  const description = [item.item_name, item.brand, item.model].filter(Boolean).join(' / ');

  return {
    supplier: item.supplier_name || '',
    department: item.department_name || '',
    location: item.location_name || '',
    classification: formatParClassification(item.asset_classification),
    deliveryDate: formatDate(resolveAcquisitionDate(item)),
    custodian: item.custodian_name || '',
    brand: item.brand || '',
    model: item.model || '',
    serialNumber: item.serial_number || '',
    condition: item.condition || '',
    unitCost: unitCost != null && !Number.isNaN(unitCost) ? formatMoney(unitCost) : '',
    totalCost: amountValue != null ? formatMoney(amountValue) : '',
    purchaseRequestNumber: item.purchase_request_number || '',
    purchaseOrderNumber: item.purchase_order_number || '',
    invoiceNumber: item.invoice_number || '',
    propertyTags,
    attachPropertyTagList: false,
    propertyTagNote: '',
    itemDescription: description,
    items: [{
      propertyTag,
      propertyTags,
      description,
      quantity,
      unit: resolveDocumentUnit(item),
      amount: amountValue != null ? formatMoney(amountValue) : '',
      classification: formatParClassification(item.asset_classification),
      serialNumber: item.serial_number || ''
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
            i.department_id, i.asset_classification, dept.name AS department_name,
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

  // Acquisition docs are PAR-only
  const sourceDoc = await DocumentModel.findByTransaction('PAR', 'inventory', disposal.inventory_item_id);
  const sourceDocLabel = 'PAR No.';
  const sourceDocType = 'PAR';
  const sourceDocNumber = sourceDoc?.document_number || '';
  const qty = disposal.quantity || 1;
  const recommendation = disposal.inspection_notes || disposal.disposal_method || '';

  return {
    requestingDepartment: disposal.department_name || '',
    dateOfRequest: formatDate(disposal.created_at),
    assetClassification: disposal.asset_classification || '',
    sourceDocLabel,
    sourceDocType,
    items: [{
      description: [disposal.item_name, disposal.brand, disposal.model].filter(Boolean).join(' / '),
      qtyUnit: `${qty} pcs`,
      propertyTag: disposal.property_tag || '',
      sourceDocNumber,
      // Keep legacy key for older RDF previews
      parNo: sourceDocNumber,
      recommendation
    }],
    reason: disposal.reason || '',
    requestedBy: disposal.requested_by_name || '',
    departmentHead: await getDepartmentHead(disposal.department_id),
    evaluatedBy: disposal.inspected_by_name || '',
    disposalProcessedBy: disposal.approved_by_name || '',
    dateProcessed: formatDate(disposal.disposal_date || disposal.updated_at),
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
    // Prefer RTF (Request for Transfer Form); fall back to legacy TRF if already generated
    const existingRtf = await DocumentModel.findByTransaction('RTF', 'transfer', transferId);
    if (existingRtf) return existingRtf;
    const existingTrf = await DocumentModel.findByTransaction('TRF', 'transfer', transferId);
    if (existingTrf) return existingTrf;

    return generateDocument({
      documentType: 'RTF',
      relatedModule: 'transfer',
      relatedTransactionId: transferId,
      generatedBy,
      payloadBuilder: () => buildTRFPayloadFromTransfer(transferId)
    });
  },

  async generatePARForCustodianAssignment(inventoryId, generatedBy) {
    const item = await InventoryModel.findById(inventoryId);
    if (!item || !canGenerateAcquisitionPar(item.asset_classification)) return null;

    return generateDocument({
      documentType: 'PAR',
      relatedModule: 'inventory',
      relatedTransactionId: inventoryId,
      generatedBy,
      payloadBuilder: () => buildPARPayloadFromInventory(inventoryId, generatedBy)
    });
  },

  /**
   * Generate one PAR per inventory asset (1 asset = 1 PAR).
   * Returns { documents, first, created_count, failed_count }.
   */
  async generatePARsForInventoryAssets(inventoryIds, generatedBy) {
    const ids = [...new Set((inventoryIds || []).map((id) => parseInt(id, 10)).filter(Boolean))];
    const documents = [];
    let failedCount = 0;

    for (const assetId of ids) {
      try {
        const item = await InventoryModel.findById(assetId);
        if (!item || !canGenerateAcquisitionPar(item.asset_classification)) continue;
        if (!String(item.property_tag || '').trim()) {
          throw new Error(`Inventory #${assetId} has no property tag`);
        }

        const par = await generateDocument({
          documentType: 'PAR',
          relatedModule: 'inventory',
          relatedTransactionId: assetId,
          generatedBy,
          payloadBuilder: () => buildPARPayloadFromInventory(assetId, generatedBy)
        });

        // Guard: generated PAR property tag must match inventory table value
        const generatedTag = String(par?.payload?.items?.[0]?.propertyTag || '').trim();
        const inventoryTag = String(item.property_tag || '').trim();
        if (!par || generatedTag !== inventoryTag) {
          throw new Error(
            `PAR property tag mismatch for inventory #${assetId}: expected "${inventoryTag}", got "${generatedTag}"`
          );
        }

        documents.push(par);
      } catch (err) {
        failedCount += 1;
        console.error(`PAR generation failed for inventory ${assetId}:`, err.message);
      }
    }

    return {
      documents,
      first: documents[0] || null,
      created_count: documents.length,
      failed_count: failedCount
    };
  },

  async refreshPARForCustodianAssignment(inventoryId) {
    // Acquisition PAR is immutable after Add Item — never create or overwrite on refresh
    return DocumentModel.findByTransaction('PAR', 'inventory', inventoryId);
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
