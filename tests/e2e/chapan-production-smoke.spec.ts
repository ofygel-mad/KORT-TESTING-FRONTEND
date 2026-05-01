import { expect, test, type Page } from '@playwright/test';
import { preparePage } from './helpers';

async function loginOwner(page: Page) {
  await preparePage(page);
}

test.describe('Chapan production smoke', () => {
  test('supports search, selection, selected-only filter, and optimistic done flow', async ({ page }) => {
    test.setTimeout(180_000);

    const errors: string[] = [];
    const claimCalls: string[] = [];
    const statusCalls: Array<{ taskId: string; status: string }> = [];

    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });

    await loginOwner(page);

    await page.route('**/api/v1/chapan/production/workshop', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 2,
          results: [
            {
              id: 'task-1',
              orderId: 'order-1',
              orderItemId: 'item-1',
              productName: 'Alpha coat',
              size: '46',
              quantity: 2,
              status: 'queued',
              assignedTo: null,
              isBlocked: false,
              blockReason: null,
              defects: null,
              notes: 'First task note',
              workshopNotes: 'Workshop note',
              startedAt: null,
              completedAt: null,
              color: 'Black',
              gender: 'Female',
              length: 'Long',
              order: {
                id: 'order-1',
                orderNumber: '1001',
                priority: 'normal',
                urgency: 'urgent',
                isDemandingClient: false,
                dueDate: '2026-05-03T00:00:00.000Z',
              },
            },
            {
              id: 'task-2',
              orderId: 'order-2',
              orderItemId: 'item-2',
              productName: 'Beta coat',
              size: '48',
              quantity: 1,
              status: 'in_progress',
              assignedTo: 'Worker',
              isBlocked: false,
              blockReason: null,
              defects: null,
              notes: null,
              workshopNotes: null,
              startedAt: '2026-05-01T00:00:00.000Z',
              completedAt: null,
              color: 'Blue',
              gender: 'Male',
              length: 'Short',
              order: {
                id: 'order-2',
                orderNumber: '2002',
                priority: 'normal',
                urgency: 'normal',
                isDemandingClient: true,
                dueDate: '2026-05-05T00:00:00.000Z',
              },
            },
          ],
        }),
      });
    });

    await page.route('**/api/v1/chapan/orders/change-requests', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/v1/chapan/production/*/claim', async (route) => {
      const url = new URL(route.request().url());
      const parts = url.pathname.split('/');
      claimCalls.push(parts[parts.length - 2]);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.route('**/api/v1/chapan/production/*/status', async (route) => {
      const body = route.request().postDataJSON() as { status?: string };
      const url = new URL(route.request().url());
      const parts = url.pathname.split('/');
      statusCalls.push({
        taskId: parts[parts.length - 2],
        status: body.status ?? '',
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, orderId: 'order-1' }),
      });
    });

    await page.goto('/workzone/chapan/production', { waitUntil: 'networkidle' });

    const title = page.getByRole('heading', { name: /\u0426\u0435\u0445/i });
    await expect(title).toBeVisible();

    const doneButtons = page.getByRole('button', { name: /^\u0413\u043e\u0442\u043e\u0432\u043e$/ });
    await expect(doneButtons).toHaveCount(2);

    const searchInput = page.locator('input[placeholder="\u0417\u0430\u043a\u0430\u0437 \u0438\u043b\u0438 \u0442\u043e\u0432\u0430\u0440..."]');
    await searchInput.fill('1001');
    await expect(doneButtons).toHaveCount(1);
    await expect(page.getByText('Alpha coat')).toBeVisible();
    await expect(page.getByText('Beta coat')).not.toBeVisible();

    const taskCheckbox = page.locator('main input[type="checkbox"]').first();
    await taskCheckbox.click();

    const selectedOnlyButton = page.getByRole('button', { name: /\u0422\u043e\u043b\u044c\u043a\u043e \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0435/i });
    await expect(selectedOnlyButton).toBeVisible();
    await selectedOnlyButton.click();
    await expect(doneButtons).toHaveCount(1);
    await expect(page.getByText(/1 \u0432\u044b\u0431\u0440\u0430\u043d\u043e/i)).toBeVisible();

    await doneButtons.first().click();
    await expect(doneButtons).toHaveCount(0);

    expect(claimCalls).toEqual(['task-1']);
    expect(statusCalls).toEqual([{ taskId: 'task-1', status: 'done' }]);
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
