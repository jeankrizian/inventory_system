function filterSearchableOptions(options, term) {
  const query = term.trim().toLowerCase();
  if (!query) return options;
  return options.filter((opt) => opt.label.toLowerCase().includes(query));
}

const options = [
  { value: '1', label: 'Information Technology' },
  { value: '2', label: 'Science Laboratory' },
  { value: '3', label: 'Consumable' }
];

if (filterSearchableOptions(options, 'science').length !== 1) {
  console.error('FAIL: science filter');
  process.exit(1);
}

if (filterSearchableOptions(options, 'lab').length !== 1) {
  console.error('FAIL: lab filter');
  process.exit(1);
}

if (filterSearchableOptions(options, '').length !== 3) {
  console.error('FAIL: empty filter should return all');
  process.exit(1);
}

console.log('Searchable select filter tests OK');
