import { expect, test, type Page } from '@playwright/test';
import { preparePage } from './helpers';

const CHAPAN_ROUTES = [
  '/workzone/chapan/orders',
  '/workzone/chapan/orders/new',
  '/workzone/chapan/production',
  '/workzone/chapan/ready',
  '/workzone/chapan/shipping',
  '/workzone/chapan/archive',
  '/workzone/chapan/invoices',
  '/workzone/chapan/warehouse',
  '/workzone/chapan/returns',
  '/workzone/chapan/purchase',
  '/workzone/chapan/analytics',
  '/workzone/chapan/clients',
] as const;

async function loginOwner(page: Page) {
  await preparePage(page);
}

test.describe('Chapan production regression', () => {
  test('all main Chapan sections open without client crashes', async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });

    await loginOwner(page);

    for (const route of CHAPAN_ROUTES) {
      await page.goto(route, { waitUntil: 'networkidle' });
      await expect(page).toHaveURL(new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
      await expect(page.locator('body')).not.toContainText('Нет доступа');
      await expect(page.locator('body')).not.toContainText('внутренняя ошибка сервера');
    }

    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('purchase form keeps typed data, shows catalog suggestions, saves, and downloads without popup auth errors', async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    const popups: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    page.on('popup', (popup) => {
      popups.push(popup.url());
    });

    await loginOwner(page);

    await page.route('**/api/v1/warehouse/order-form/catalog', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          products: [
            {
              id: 'prod-1',
              name: 'Чапан deluxe',
              fields: [
                {
                  code: 'color',
                  label: 'Цвет',
                  inputType: 'select',
                  isRequired: false,
                  affectsAvailability: true,
                  options: [
                    { value: 'burgundy', label: 'Бордовый' },
                    { value: 'ivory', label: 'Айвори' },
                  ],
                },
                {
                  code: 'size',
                  label: 'Размер',
                  inputType: 'select',
                  isRequired: false,
                  affectsAvailability: true,
                  options: [
                    { value: '44', label: '44' },
                    { value: '46', label: '46' },
                  ],
                },
              ],
            },
          ],
        }),
      });
    });

    await page.route('**/api/v1/warehouse/catalog/definitions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'def-gender',
            orgId: 'org-1',
            code: 'gender',
            label: 'Пол',
            entityScope: 'both',
            inputType: 'select',
            isRequired: false,
            isVariantAxis: true,
            showInWarehouseForm: true,
            showInOrderForm: true,
            showInDocuments: true,
            affectsAvailability: false,
            sortOrder: 0,
            isSystem: true,
            options: [
              { id: 'g-1', definitionId: 'def-gender', value: 'female', label: 'Женский', sortOrder: 0, isActive: true },
              { id: 'g-2', definitionId: 'def-gender', value: 'male', label: 'Мужской', sortOrder: 1, isActive: true },
            ],
          },
          {
            id: 'def-length',
            orgId: 'org-1',
            code: 'length',
            label: 'Длина',
            entityScope: 'both',
            inputType: 'select',
            isRequired: false,
            isVariantAxis: true,
            showInWarehouseForm: true,
            showInOrderForm: true,
            showInDocuments: true,
            affectsAvailability: true,
            sortOrder: 1,
            isSystem: true,
            options: [
              { id: 'l-1', definitionId: 'def-length', value: 'long', label: 'Длинный', sortOrder: 0, isActive: true },
            ],
          },
          {
            id: 'def-color',
            orgId: 'org-1',
            code: 'color',
            label: 'Цвет',
            entityScope: 'both',
            inputType: 'select',
            isRequired: false,
            isVariantAxis: true,
            showInWarehouseForm: true,
            showInOrderForm: true,
            showInDocuments: true,
            affectsAvailability: true,
            sortOrder: 2,
            isSystem: true,
            options: [
              { id: 'c-1', definitionId: 'def-color', value: 'black', label: 'Черный', sortOrder: 0, isActive: true },
            ],
          },
          {
            id: 'def-size',
            orgId: 'org-1',
            code: 'size',
            label: 'Размер',
            entityScope: 'both',
            inputType: 'select',
            isRequired: false,
            isVariantAxis: true,
            showInWarehouseForm: true,
            showInOrderForm: true,
            showInDocuments: true,
            affectsAvailability: true,
            sortOrder: 3,
            isSystem: true,
            options: [
              { id: 's-1', definitionId: 'def-size', value: '44', label: '44', sortOrder: 0, isActive: true },
              { id: 's-2', definitionId: 'def-size', value: '46', label: '46', sortOrder: 1, isActive: true },
            ],
          },
        ]),
      });
    });

    await page.route('**/api/v1/chapan/purchase/*/download', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers: {
          'Content-Disposition': "attachment; filename*=UTF-8''zakup_MN-0001.xlsx",
        },
        body: 'fake-xlsx-content',
      });
    });

    await page.goto('/workzone/chapan/purchase', { waitUntil: 'networkidle' });

    const stableUrl = page.url();
    const unexpectedNavigations: string[] = [];
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame() && page.url() !== stableUrl) {
        unexpectedNavigations.push(page.url());
      }
    });

    await page.getByRole('button', { name: /Новая накладная/i }).click();

    const title = page.getByLabel('Название накладной');
    const product = page.getByLabel('Товар для позиции 1');
    const color = page.getByLabel('Цвет для позиции 1');
    const size = page.getByLabel('Размер для позиции 1');
    const quantity = page.getByLabel('Количество для позиции 1');
    const unitPrice = page.getByLabel('Цена для позиции 1');
    const invoiceTitle = `E2E закуп ${Date.now()}`;

    await title.fill(invoiceTitle);
    await product.fill('Чап');
    await expect(page.getByText('Чапан deluxe')).toBeVisible();
    await product.press('ArrowDown');
    await product.press('Enter');
    await color.fill('Бор');
    await expect(page.getByText('Бордовый')).toBeVisible();
    await color.press('ArrowDown');
    await color.press('Enter');
    await size.fill('46');
    await expect(page.getByText('46')).toBeVisible();
    await size.press('ArrowDown');
    await size.press('Enter');
    await quantity.fill('2');
    await unitPrice.fill('1500');

    for (let i = 0; i < 9; i += 1) {
      await page.mouse.move(120 + i, 140 + i);
      await page.keyboard.press('Shift');
      await page.waitForTimeout(5_000);
      await expect(title).toHaveValue(invoiceTitle);
      await expect(product).toHaveValue('Чапан deluxe');
    }

    expect(unexpectedNavigations).toEqual([]);
    await expect(page).toHaveURL(stableUrl);
    await expect(title).toBeVisible();

    await page.getByRole('button', { name: /^Сохранить$/ }).click();
    await expect(page.getByText(invoiceTitle)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Чапан deluxe')).not.toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Скачать XLSX' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('zakup_');
    expect(popups).toEqual([]);

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
