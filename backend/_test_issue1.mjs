import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
function cookieFrom(res) {
  return (res.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
}
async function login(u, p) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: p })
  });
  return cookieFrom(res);
}
async function api(cookie, method, path, body) {
  const opts = { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => ({})) };
}

const admin = await login('admin', 'admin123');
const pm = await login('pm_test', 'pm123456');
const users = await api(admin, 'GET', '/api/users');
const custodianId = (users.json?.data || []).find((u) => u.username === 'eng_custodian')?.id;

const created = await api(admin, 'POST', '/api/inventory', {
  item_name: 'ISSUE1 REF TEST ' + Date.now(),
  department_id: 2,
  location_id: 2,
  custodian_id: custodianId,
  asset_classification: 'Non-Consumable (Fixed Asset)',
  material: 'Metal',
  condition: 'Good',
  quantity: 1,
  acquisition_date: '2026-03-01'
});
const asset = created.json?.data;
console.log('asset', asset?.id, asset?.property_tag, asset?.item_code);

const borrow = await api(admin, 'POST', '/api/borrow', {
  borrow_date: new Date().toISOString().slice(0, 10),
  purpose: 'Issue1 reference removal test',
  items: [{ item_code: asset.item_code, quantity: 1 }]
});
console.log('borrow still has transaction_code in API', borrow.json?.data?.transaction_code, 'id', borrow.json?.data?.id);

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
await page.goto(`${BASE}/`);
await page.fill('#username', 'pm_test');
await page.fill('#password', 'pm123456');
await page.click('button[type=submit]');
await page.waitForURL(/dashboard|pages/);
await page.goto(`${BASE}/pages/pending-approvals.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

const info = await page.evaluate(() => {
  const headers = [...document.querySelectorAll('#approvalContent table thead th')].map((t) => t.textContent.trim());
  const firstRow = [...document.querySelectorAll('#approvalContent table tbody tr:first-child td')].map((t) => t.textContent.trim());
  return { headers, firstRow, rows: document.querySelectorAll('tbody tr').length };
});
console.log(info);
const pass = !info.headers.includes('Reference') && info.rows > 0 && !pageErrors.length;
console.log(pass ? 'PASS Issue1 UI' : 'FAIL Issue1 UI', pageErrors);

// cleanup reject
if (borrow.json?.data?.id) await api(pm, 'PUT', `/api/borrow/${borrow.json.data.id}/reject`);
if (asset?.id) await api(admin, 'DELETE', `/api/inventory/${asset.id}`);
await browser.close();
