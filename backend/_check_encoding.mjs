import fs from 'fs';
const s = fs.readFileSync('../frontend/js/pages/pending-approvals.js');
// find bytes around "propertyTag:"
const text = s.toString('utf8');
const i = text.indexOf("propertyTag: '");
console.log('slice', JSON.stringify(text.slice(i, i + 30)));
console.log('bytes', s.slice(s.indexOf(Buffer.from("propertyTag: '")), s.indexOf(Buffer.from("propertyTag: '")) + 25));
// check for mojibake sequence c3 a2 e2 82 ac
const mojibake = Buffer.from([0xC3, 0xA2, 0xE2, 0x82, 0xAC]); // â€
console.log('has mojibake buffer', s.includes(mojibake));
console.log('has utf8 emdash e2 80 94', s.includes(Buffer.from([0xE2, 0x80, 0x94])));
console.log('has utf8 arrow e2 86 92', s.includes(Buffer.from([0xE2, 0x86, 0x92])));
