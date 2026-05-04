import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { preparePage } from './helpers';

const API_BASE_URL = process.env.E2E_API_BASE_URL || `http://${process.env.E2E_HOST || '127.0.0.1'}:${process.env.E2E_BACKEND_PORT || '8002'}/api/v1`;
const E2E_EMAIL = 'admin@kort.local';
const E2E_PASSWORD = 'demo1234';
const E2E_ORG_ID = 'org-demo';

async function createDeal(request: APIRequestContext, title: string) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
        data: { email: E2E_EMAIL, password: E2E_PASSWORD },
      });
      expect(loginResponse.ok()).toBeTruthy();

      const session = await loginResponse.json();
      const headers = {
        Authorization: `Bearer ${session.access}`,
        'X-Org-Id': E2E_ORG_ID,
      };

      const createResponse = await request.post(`${API_BASE_URL}/deals`, {
        data: { title, fullName: 'E2E Client' },
        headers,
      });
      expect(createResponse.ok()).toBeTruthy();

      const createdDeal = await createResponse.json();

      return {
        id: createdDeal.id as string,
        title,
        headers,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      await new Promise((resolve) => setTimeout(resolve, attempt * 300));
    }
  }

  throw lastError ?? new Error('Failed to create test deal');
}

async function openDealFromBoard(page: Page, title: string) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto('/crm/deals', { waitUntil: 'domcontentloaded' });

    const loadError = page.getByText('Не удалось загрузить сделки');
    if (await loadError.isVisible().catch(() => false)) {
      await page.reload({ waitUntil: 'load' });
      continue;
    }

    const dealButton = page.locator('button', { hasText: title }).first();
    await expect(dealButton).toBeVisible({ timeout: 10000 });
    await dealButton.click();
    return;
  }

  throw new Error(`Deal "${title}" did not appear in the board`);
}

test('deal stage update from drawer persists in backend', async ({ page, request }) => {
  const deal = await createDeal(request, `Deal stage update ${Date.now()}`);

  await preparePage(page);
  await openDealFromBoard(page, deal.title);
  await page.getByRole('button', { name: 'КП' }).click();

  await expect.poll(async () => {
    const response = await request.get(`${API_BASE_URL}/deals/${deal.id}`, {
      headers: deal.headers,
    });
    const body = await response.json();
    return body.stage_id;
  }).toBe('proposal');
});

test('deal comment added in drawer appears in activity feed', async ({ page, request }) => {
  const deal = await createDeal(request, `Deal comment ${Date.now()}`);
  const comment = `Comment ${Date.now()}`;

  await preparePage(page);
  await openDealFromBoard(page, deal.title);
  await page.getByPlaceholder('Добавить комментарий...').fill(comment);
  await page.getByRole('button', { name: '→' }).click();

  await expect.poll(
    async () => page.getByText(comment).isVisible().catch(() => false),
    { timeout: 10000 },
  ).toBe(true);

  await expect.poll(async () => {
    const response = await request.get(`${API_BASE_URL}/deals/${deal.id}/activities`, {
      headers: deal.headers,
    });
    const body = await response.json();
    return body.results.some((activity: { content?: string; payload?: { body?: string } }) =>
      activity.content === comment || activity.payload?.body === comment);
  }).toBe(true);
});
