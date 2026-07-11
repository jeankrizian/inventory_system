const pool = require('../config/database');
const BorrowModel = require('../models/BorrowModel');
const MaintenanceModel = require('../models/MaintenanceModel');
const TransferModel = require('../models/TransferModel');
const DisposalModel = require('../models/DisposalModel');

function toIsoDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function makeEvent({
  date,
  action,
  performedBy = null,
  referenceCode = null,
  propertyTag = null,
  department = null,
  location = null,
  eventType,
  sourceId = null
}) {
  if (!date || !action || !eventType) return null;
  return {
    date: toIsoDate(date),
    action,
    performed_by: performedBy,
    reference_code: referenceCode,
    property_tag: propertyTag,
    department,
    location,
    event_type: eventType,
    source_id: sourceId
  };
}

async function getCreationEvent(item) {
  const [rows] = await pool.query(
    `SELECT al.created_at, u.full_name AS user_name
     FROM activity_logs al
     LEFT JOIN users u ON al.user_id = u.id
     WHERE al.entity_type = 'inventory_item'
       AND al.entity_id = ?
       AND al.action = 'CREATE'
     ORDER BY al.created_at ASC
     LIMIT 1`,
    [item.id]
  );

  const log = rows[0];
  return makeEvent({
    date: log?.created_at || item.created_at,
    action: 'Asset Created',
    performedBy: log?.user_name || null,
    referenceCode: item.item_code,
    propertyTag: item.property_tag,
    department: item.department_name,
    location: item.location_name,
    eventType: 'created',
    sourceId: item.id
  });
}

function buildBorrowEvents(item, rows = []) {
  const events = [];
  const propertyTag = item.property_tag;
  const department = item.department_name;
  const location = item.location_name;

  for (const row of rows) {
    events.push(makeEvent({
      date: row.created_at || row.borrow_date,
      action: 'Borrow Requested',
      performedBy: row.borrower_name,
      referenceCode: row.transaction_code,
      propertyTag,
      department: row.borrower_department || department,
      location,
      eventType: 'borrow',
      sourceId: row.id
    }));

    if (row.approved_at && ['Borrowed', 'Approved', 'Returned', 'Overdue'].includes(row.status)) {
      events.push(makeEvent({
        date: row.approved_at,
        action: 'Borrow Approved',
        performedBy: row.approver_name,
        referenceCode: row.transaction_code,
        propertyTag,
        department: row.borrower_department || department,
        location,
        eventType: 'borrow',
        sourceId: row.id
      }));
    }

    if (row.return_date) {
      events.push(makeEvent({
        date: row.return_date,
        action: 'Borrow Returned',
        performedBy: row.returned_by_name,
        referenceCode: row.return_code || row.transaction_code,
        propertyTag,
        department: row.borrower_department || department,
        location,
        eventType: 'return',
        sourceId: row.id
      }));
    }

    if (row.status === 'Rejected' && row.approved_at) {
      events.push(makeEvent({
        date: row.approved_at,
        action: 'Borrow Rejected',
        performedBy: row.approver_name,
        referenceCode: row.transaction_code,
        propertyTag,
        department: row.borrower_department || department,
        location,
        eventType: 'borrow',
        sourceId: row.id
      }));
    }
  }

  return events;
}

async function getBorrowRows(inventoryItemId) {
  const [rows] = await pool.query(
    `SELECT bt.id, bt.transaction_code, bt.borrower_name, bt.borrower_department,
            bt.borrow_date, bt.status, bt.created_at, bt.approved_at,
            u.full_name AS approver_name,
            rt.transaction_code AS return_code, rt.return_date,
            ru.full_name AS returned_by_name
     FROM borrow_items bi
     JOIN borrow_transactions bt ON bi.borrow_transaction_id = bt.id
     LEFT JOIN users u ON bt.approved_by = u.id
     LEFT JOIN return_transactions rt ON rt.borrow_transaction_id = bt.id
     LEFT JOIN users ru ON rt.returned_by = ru.id
     WHERE bi.inventory_item_id = ?
     ORDER BY bt.created_at DESC`,
    [inventoryItemId]
  );
  return rows;
}

function buildMaintenanceEvents(item, records = []) {
  const events = [];
  const propertyTag = item.property_tag;

  for (const row of records) {
    const department = row.department_name || item.department_name;
    const location = row.location_name || item.location_name;

    events.push(makeEvent({
      date: row.requested_date || row.created_at,
      action: 'Maintenance Requested',
      performedBy: row.requested_by_name,
      referenceCode: row.transaction_code,
      propertyTag,
      department,
      location,
      eventType: 'maintenance',
      sourceId: row.id
    }));

    if (row.approved_at && ['Approved', 'Scheduled', 'Ongoing', 'In Progress', 'Completed'].includes(row.status)) {
      events.push(makeEvent({
        date: row.approved_at,
        action: 'Maintenance Approved',
        performedBy: row.approved_by_name,
        referenceCode: row.transaction_code,
        propertyTag,
        department,
        location,
        eventType: 'maintenance',
        sourceId: row.id
      }));
    }

    if (row.status === 'Completed' && row.completed_date) {
      events.push(makeEvent({
        date: row.completed_date,
        action: 'Maintenance Completed',
        performedBy: row.performed_by_name,
        referenceCode: row.transaction_code,
        propertyTag,
        department,
        location,
        eventType: 'maintenance',
        sourceId: row.id
      }));
    }

    if (['Cancelled', 'Rejected'].includes(row.status) && row.approved_at) {
      events.push(makeEvent({
        date: row.approved_at,
        action: 'Maintenance Rejected',
        performedBy: row.approved_by_name,
        referenceCode: row.transaction_code,
        propertyTag,
        department,
        location,
        eventType: 'maintenance',
        sourceId: row.id
      }));
    }
  }

  return events;
}

function buildTransferEvents(item, transfers = []) {
  const events = [];
  const propertyTag = item.property_tag;

  for (const row of transfers) {
    const fromDept = row.from_department_name;
    const toDept = row.to_department_name;
    const fromLoc = row.from_location_name;
    const toLoc = row.to_location_name;
    const department = toDept || fromDept || item.department_name;
    const location = toLoc || fromLoc || item.location_name;

    events.push(makeEvent({
      date: row.request_date || row.created_at,
      action: 'Transfer Requested',
      performedBy: row.requested_by_name,
      referenceCode: row.transaction_code,
      propertyTag,
      department,
      location,
      eventType: 'transfer',
      sourceId: row.id
    }));

    if (row.approved_at && ['Approved', 'Completed'].includes(row.status)) {
      events.push(makeEvent({
        date: row.approved_at,
        action: row.status === 'Completed' ? 'Transfer Completed' : 'Transfer Approved',
        performedBy: row.approved_by_name,
        referenceCode: row.transaction_code,
        propertyTag,
        department: toDept || department,
        location: toLoc || location,
        eventType: 'transfer',
        sourceId: row.id
      }));
    }

    if (row.status === 'Rejected' && row.approved_at) {
      events.push(makeEvent({
        date: row.approved_at,
        action: 'Transfer Rejected',
        performedBy: row.approved_by_name,
        referenceCode: row.transaction_code,
        propertyTag,
        department,
        location,
        eventType: 'transfer',
        sourceId: row.id
      }));
    }
  }

  return events;
}

function buildDisposalEvents(item, disposals = []) {
  const events = [];
  const propertyTag = item.property_tag;
  const department = item.department_name;
  const location = item.location_name;

  for (const row of disposals) {
    events.push(makeEvent({
      date: row.created_at,
      action: 'Disposal Requested',
      performedBy: row.requested_by_name,
      referenceCode: row.transaction_code,
      propertyTag,
      department,
      location,
      eventType: 'disposal',
      sourceId: row.id
    }));

    if (row.inspected_by && ['Inspected', 'Completed'].includes(row.status)) {
      events.push(makeEvent({
        date: row.updated_at || row.created_at,
        action: 'Disposal Inspected',
        performedBy: row.inspected_by_name,
        referenceCode: row.transaction_code,
        propertyTag,
        department,
        location,
        eventType: 'disposal',
        sourceId: row.id
      }));
    }

    if (row.status === 'Completed') {
      events.push(makeEvent({
        date: row.disposal_date || row.updated_at,
        action: 'Disposal Completed',
        performedBy: row.approved_by_name,
        referenceCode: row.transaction_code,
        propertyTag,
        department,
        location,
        eventType: 'disposal',
        sourceId: row.id
      }));
    }

    if (row.status === 'Rejected' && row.updated_at) {
      events.push(makeEvent({
        date: row.updated_at,
        action: 'Disposal Rejected',
        performedBy: row.approved_by_name,
        referenceCode: row.transaction_code,
        propertyTag,
        department,
        location,
        eventType: 'disposal',
        sourceId: row.id
      }));
    }
  }

  return events;
}

function sortTimeline(events) {
  return events
    .filter(Boolean)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function getInventoryTimeline(item) {
  const [borrowRows, maintenance, transfers, disposals] = await Promise.all([
    getBorrowRows(item.id),
    MaintenanceModel.getByAsset(item.id),
    TransferModel.getAll({ inventory_item_id: item.id }),
    DisposalModel.getByAsset(item.id)
  ]);

  const creation = await getCreationEvent(item);
  const events = [
    creation,
    ...buildBorrowEvents(item, borrowRows),
    ...buildMaintenanceEvents(item, maintenance),
    ...buildTransferEvents(item, transfers),
    ...buildDisposalEvents(item, disposals)
  ];

  return sortTimeline(events);
}

module.exports = {
  getInventoryTimeline,
  getBorrowRows
};
