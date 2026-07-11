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

  await page.goto(`${BASE}/pages/orders.html`);
  await page.waitForSelector('h1:has-text("Borrow Requests")', { timeout: 15000 });

  const borrowBtn = page.locator('#borrowItemBtn');
  await borrowBtn.waitFor({ state: 'visible', timeout: 10000 });
  const usesListener = await borrowBtn.evaluate((el) => !el.getAttribute('onclick'));
  await borrowBtn.click();

  const modal = page.locator('#borrowModal');
  const modalVisible = await modal.evaluate((el) => el.classList.contains('show'));
  const borrowerField = await page.locator('#borrowerName').inputValue();
  const purposeField = await page.locator('#borrowPurpose').isVisible();
  const itemSelect = await page.locator('.borrow-item-select').first().isVisible();

  await page.locator('#borrowModal .btn-icon[title="Close"]').click();
  const modalClosed = await modal.evaluate((el) => !el.classList.contains('show'));

  await browser.close();

  const result = {
    usesListener,
    modalOpened: modalVisible,
    borrowerPrefilled: borrowerField.length > 0,
    formFieldsVisible: purposeField && itemSelect,
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
