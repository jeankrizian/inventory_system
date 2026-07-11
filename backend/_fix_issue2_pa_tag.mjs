import fs from 'fs';

const path = '../frontend/js/pages/pending-approvals.js';
let s = fs.readFileSync(path, 'utf8');

const oldBorrow = `    pendingBorrows.forEach((item) => {
      rows.push({
        module: 'borrow',
        id: item.id,
        item: item.purpose || '—',
        propertyTag: '—',
        requester: item.borrower_name,
        department: item.borrower_department || '—',
        date: item.borrow_date || item.created_at,
        status: item.status,
        raw: item
      });
    });`;

const newBorrow = `    pendingBorrows.forEach((item) => {
      rows.push({
        module: 'borrow',
        id: item.id,
        item: item.item_names || item.purpose || '—',
        propertyTag: item.property_tags || item.property_tag || '—',
        requester: item.borrower_name,
        department: item.borrower_department || '—',
        date: item.borrow_date || item.created_at,
        status: item.status,
        raw: item
      });
    });`;

if (!s.includes("propertyTag: '—'")) {
  // try with actual file content
  console.log('Looking for borrow block...');
}

if (!s.includes(oldBorrow)) {
  // Flexible replace for propertyTag hardcode in borrow block only
  const re = /pendingBorrows\.forEach\(\(item\) => \{\s*rows\.push\(\{[\s\S]*?raw: item\s*\}\);\s*\}\);/;
  const m = s.match(re);
  if (!m) {
    console.error('Could not find pendingBorrows block');
    process.exit(1);
  }
  const updated = m[0]
    .replace(/item:\s*item\.purpose\s*\|\|\s*'—'/, "item: item.item_names || item.purpose || '—'")
    .replace(/propertyTag:\s*'—'/, "propertyTag: item.property_tags || item.property_tag || '—'");
  s = s.replace(m[0], updated);
} else {
  s = s.replace(oldBorrow, newBorrow);
}

fs.writeFileSync(path, s);
console.log('PASS updated borrow property tag display');
console.log(s.match(/pendingBorrows\.forEach[\s\S]{0,350}/)?.[0]);
