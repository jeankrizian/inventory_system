import fs from 'fs';

const path = '../frontend/js/pages/pending-approvals.js';
let s = fs.readFileSync(path, 'utf8');

// Remove reference property lines from row builders
s = s.replace(/\n\s*reference: item\.transaction_code \|\| `MR-\$\{item\.id\}`,/g, '');
s = s.replace(/\n\s*reference: item\.transaction_code,/g, '');

if (s.includes('reference:')) {
  console.error('Still has reference:', s.match(/.*reference:.*/g));
  process.exit(1);
}
if (s.includes('<th>Reference</th>') || s.includes('row.reference')) {
  console.error('Still displays reference');
  process.exit(1);
}

fs.writeFileSync(path, s);
console.log('PASS removed reference fields from pending-approvals.js');
