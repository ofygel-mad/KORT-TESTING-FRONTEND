import { expect, test, type Locator, type Page } from '@playwright/test';
import { preparePage } from './helpers';

async function loginOwner(page: Page) {
  await preparePage(page);
}

async function openMainCreate(page: Page, opened: Locator) {
  const addButton = page.locator('main').getByRole('button').first();

  await expect(addButton).toBeVisible();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await addButton.click();
    if (await opened.isVisible().catch(() => false)) {
      return opened;
    }
    await page.waitForTimeout(250);
  }

  await expect(opened).toBeVisible();
  return opened;
}

test('create customer adds a new row in CRM customers', async ({ page }) => {
  const customerName = `E2E Customer ${Date.now()}`;
  const phoneDigits = String(Date.now()).slice(-7).padStart(7, '0');
  const phone = `+7 701 ${phoneDigits.slice(0, 3)} ${phoneDigits.slice(3, 5)} ${phoneDigits.slice(5, 7)}`;

  await loginOwner(page);
  await page.goto('/crm/customers', { waitUntil: 'domcontentloaded' });

  const createForm = await openMainCreate(page, page.locator('main form'));
  await createForm.locator('input').nth(0).fill(customerName);
  await createForm.locator('input').nth(1).fill(phone);
  await createForm.evaluate((form) => {
    (form as HTMLFormElement).requestSubmit();
  });

  await expect(page.getByRole('cell', { name: customerName })).toBeVisible();
});

test('create deal adds a new card in CRM deals', async ({ page }) => {
  const dealTitle = `E2E Deal ${Date.now()}`;

  await loginOwner(page);
  await page.goto('/crm/deals', { waitUntil: 'domcontentloaded' });

  const titleInput = await openMainCreate(page, page.locator('main input').first());
  await titleInput.fill(dealTitle);
  await titleInput.press('Enter');

  await expect(page.getByRole('button', { name: new RegExp(dealTitle) })).toBeVisible();
});
