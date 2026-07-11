import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';

function isBenignConsole(text) {
  const t = String(text || '');
  if (/401 \(Unauthorized\)/i.test(t)) return true;
  if (/Failed to load resource.*favicon/i.test(t)) return true;
  return false;
}

async function main() {
  const errors = [];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isBenignConsole(msg.text())) errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto(`${BASE}/index.html`);
  await page.fill('#username', 'ict_custodian');
  await page.fill('#password', 'cust123456');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/pages/dashboard.html**', { timeout: 15000 });

  await page.goto(`${BASE}/pages/maintenance-requests.html`);
  await page.waitForSelector('h1:has-text("Maintenance Requests")', { timeout: 15000 });

  const submitBtn = page.locator('#submitMaintenanceBtn');
  await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
  const usesListener = await submitBtn.evaluate((el) => !el.getAttribute('onclick'));
  await submitBtn.click();

  const modal = page.locator('#submitModal');
  await modal.waitFor({ state: 'visible', timeout: 15000 });
  const modalVisible = await modal.evaluate((el) => el.classList.contains('show'));
  const problemField = await page.locator('#submitProblem').isVisible();
  const assetSelect = await page.locator('#submitAssetId').isVisible();
  const typeSelect = await page.locator('#submitType').isVisible();

  await page.locator('#submitModal .btn-icon[title="Close"]').click();
  const modalClosed = await modal.evaluate((el) => !el.classList.contains('show'));

  await browser.close();

  const result = {
    usesListener,
    modalOpened: modalVisible,
    formFieldsVisible: problemField && assetSelect && typeSelect,
    modalClosed,
    consoleErrors: errors
  };

  console.log(JSON.stringify(result, null, 2));
  process.exit(
    result.usesListener &&
    result.modalOpened &&
    result.formFieldsVisible &&
    result.modalClosed &&
    result.consoleErrors.length === 0
      ? 0
      : 1
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
