import { expect, test, type Page } from '@playwright/test';
import { preparePage } from './helpers';

async function stubChapanOrderFormData(page: Page) {
  await page.route('**/api/v1/chapan/settings/profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'profile-1',
        orgId: 'org-demo',
        displayName: 'Demo Chapan',
        orderPrefix: 'ORD',
        publicIntakeEnabled: true,
        deliveryFee: 2000,
        kazpostDeliveryFee: 2100,
        railDeliveryFee: 3200,
        airDeliveryFee: 5100,
        bankCommissionPercent: 7,
      }),
    });
  });

  await page.route('**/api/v1/chapan/settings/catalogs', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        productCatalog: ['Чапан deluxe'],
        paymentMethodCatalog: ['Наличные', 'Kaspi terminal', 'Перевод', 'Halyk', 'Смешанная'],
        sizeCatalog: ['44', '46'],
        workers: ['Аидана'],
      }),
    });
  });

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
              {
                code: 'length',
                label: 'Длина',
                inputType: 'select',
                isRequired: false,
                affectsAvailability: true,
                options: [
                  { value: 'short', label: 'Короткий' },
                  { value: 'long', label: 'Длинный' },
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
          orgId: 'org-demo',
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
          orgId: 'org-demo',
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
          orgId: 'org-demo',
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
          orgId: 'org-demo',
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

  await page.route('**/api/v1/warehouse/products-availability', async (route) => {
    const body = route.request().postDataJSON() as { names?: string[] };
    const response = Object.fromEntries(
      (body.names ?? []).map((name) => [
        name,
        { available: true, qty: 11, itemName: name },
      ]),
    );

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });

  await page.route('**/api/v1/warehouse/items/variant-availability', async (route) => {
    const body = route.request().postDataJSON() as { variants?: Array<{ name: string; color?: string; size?: string; gender?: string; length?: string }> };
    const response: Record<string, { qty: number; available: number; status: 'ok' | 'low' | 'none'; itemName: string | null }> = {};

    for (const variant of body.variants ?? []) {
      const key = [variant.name, variant.color, variant.gender, variant.length, variant.size].filter(Boolean).join('|');
      response[key] = { qty: 9, available: 9, status: 'ok', itemName: variant.name };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

async function runScrollRegression(page: Page, theme: 'light' | 'dark') {
  await page.addInitScript((nextTheme) => {
    window.localStorage.setItem('kort-ui', JSON.stringify({ state: { theme: nextTheme, themePack: 'neutral' }, version: 0 }));
  }, theme);

  await preparePage(page);
  await stubChapanOrderFormData(page);

  await page.goto('/workzone/chapan/orders/new', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Новый заказ/ })).toBeVisible({ timeout: 30_000 });

  const scrollRoot = page.locator('main').first();
  await scrollRoot.evaluate((el) => {
    const element = el as HTMLElement;
    element.scrollTop = element.scrollHeight;
  });
  await page.waitForTimeout(250);

  const state = await page.evaluate(() => {
    const main = document.querySelector('main') as HTMLElement | null;
    const style = main ? getComputedStyle(main) : null;
    const bodyStyle = getComputedStyle(document.body);
    const htmlStyle = getComputedStyle(document.documentElement);

    return {
      bodyBg: bodyStyle.backgroundColor,
      htmlBg: htmlStyle.backgroundColor,
      mainBg: style?.backgroundColor ?? '',
      overscrollY: style?.overscrollBehaviorY ?? '',
      scrollTop: main?.scrollTop ?? 0,
      scrollHeight: main?.scrollHeight ?? 0,
      clientHeight: main?.clientHeight ?? 0,
    };
  });

  expect(state.mainBg).not.toBe('rgb(255, 255, 255)');
  expect(state.bodyBg).not.toBe('rgb(255, 255, 255)');
  expect(state.overscrollY).toBe('none');
  expect(state.scrollTop).toBeGreaterThan(0);
  expect(state.scrollHeight).toBeGreaterThan(state.clientHeight);
}

test.describe('Chapan scroll shell regression', () => {
  test('light theme does not fall into a white overscroll void', async ({ page }) => {
    await runScrollRegression(page, 'light');
  });

  test('dark theme does not fall into a white overscroll void', async ({ page }) => {
    await runScrollRegression(page, 'dark');
  });
});
