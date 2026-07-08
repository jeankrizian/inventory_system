const { parseReportFilters, appendDateRangeSql } = require('./utils/reportFilters');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const parsed = parseReportFilters({
  department_id: '3',
  asset_classification: 'Consumable',
  date_from: '2025-01-01',
  date_to: '2025-12-31',
  low_stock: 'true'
});

assert(parsed.department_id === 3, 'department_id parsed');
assert(parsed.asset_classification === 'Consumable', 'classification parsed');
assert(parsed.date_from === '2025-01-01', 'date_from parsed');
assert(parsed.date_to === '2025-12-31', 'date_to parsed');
assert(parsed.low_stock === true, 'low_stock parsed');

const categoryAlias = parseReportFilters({ category_id: '2' });
assert(categoryAlias.department_id === 2, 'category_id alias maps to department_id');

const params = [];
const clause = appendDateRangeSql(
  { date_from: '2025-01-01', date_to: '2025-12-31' },
  'bt.borrow_date',
  params
);
assert(clause.includes('bt.borrow_date'), 'date clause uses column');
assert(params.length === 2, 'date params appended');

console.log('Report filter unit tests OK');
