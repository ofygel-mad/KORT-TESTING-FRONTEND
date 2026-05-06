import { expect, test, type Page } from '@playwright/test';
import { preparePage } from './helpers';

async function loginOwner(page: Page) {
  await preparePage(page);
}

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
        productCatalog: ['\u0427\u0430\u043f\u0430\u043d deluxe'],
        paymentMethodCatalog: ['\u041d\u0430\u043b\u0438\u0447\u043d\u044b\u0435', 'Kaspi terminal', '\u041f\u0435\u0440\u0435\u0432\u043e\u0434', 'Halyk', '\u0421\u043c\u0435\u0448\u0430\u043d\u043d\u0430\u044f'],
        sizeCatalog: ['44', '46'],
        workers: ['\u0410\u0438\u0434\u0430\u043d\u0430'],
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
            name: '\u0427\u0430\u043f\u0430\u043d deluxe',
            fields: [
              {
                code: 'color',
                label: '\u0426\u0432\u0435\u0442',
                inputType: 'select',
                isRequired: false,
                affectsAvailability: true,
                options: [
                  { value: 'burgundy', label: '\u0411\u043e\u0440\u0434\u043e\u0432\u044b\u0439' },
                  { value: 'ivory', label: '\u0410\u0439\u0432\u043e\u0440\u0438' },
                ],
              },
              {
                code: 'size',
                label: '\u0420\u0430\u0437\u043c\u0435\u0440',
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
          orgId: 'org-demo',
          code: 'gender',
          label: '\u041f\u043e\u043b',
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
            { id: 'g-1', definitionId: 'def-gender', value: 'female', label: '\u0416\u0435\u043d\u0441\u043a\u0438\u0439', sortOrder: 0, isActive: true },
            { id: 'g-2', definitionId: 'def-gender', value: 'male', label: '\u041c\u0443\u0436\u0441\u043a\u043e\u0439', sortOrder: 1, isActive: true },
          ],
        },
        {
          id: 'def-length',
          orgId: 'org-demo',
          code: 'length',
          label: '\u0414\u043b\u0438\u043d\u0430',
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
            { id: 'l-1', definitionId: 'def-length', value: 'long', label: '\u0414\u043b\u0438\u043d\u043d\u044b\u0439', sortOrder: 0, isActive: true },
          ],
        },
        {
          id: 'def-color',
          orgId: 'org-demo',
          code: 'color',
          label: '\u0426\u0432\u0435\u0442',
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
            { id: 'c-1', definitionId: 'def-color', value: 'black', label: '\u0427\u0435\u0440\u043d\u044b\u0439', sortOrder: 0, isActive: true },
          ],
        },
        {
          id: 'def-size',
          orgId: 'org-demo',
          code: 'size',
          label: '\u0420\u0430\u0437\u043c\u0435\u0440',
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
}

async function openNewOrderPage(page: Page) {
  await page.goto('/workzone/chapan/orders/new', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /\u041d\u043e\u0432\u044b\u0439 \u0437\u0430\u043a\u0430\u0437/ })).toBeVisible({ timeout: 30_000 });
}

async function fillOrderForm(page: Page, suffix: string) {
  const clientName = `E2E Client ${suffix}`;

  await page.getByLabel(/\u0424\u0418\u041e \u043a\u043b\u0438\u0435\u043d\u0442\u0430/).fill(clientName);
  await page.getByLabel(/\u0422\u0435\u043b\u0435\u0444\u043e\u043d KZ/).fill('+7 (701) 234-56-78');
  await page.getByLabel(/\u0413\u043e\u0440\u043e\u0434/).fill('\u0410\u043b\u043c\u0430\u0442\u044b');
  await page.getByLabel(/\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430/).first().fill('\u0421\u0430\u043c\u043e\u0432\u044b\u0432\u043e\u0437');
  await page.getByLabel(/\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a/).fill('Instagram');

  const product = page.getByLabel(/\u041c\u043e\u0434\u0435\u043b\u044c \u043f\u043e\u0437\u0438\u0446\u0438\u0438 1/);
  await product.fill('\u0427\u0430\u043f');
  await product.press('ArrowDown');
  await product.press('Enter');
  await expect(product).toHaveValue('\u0427\u0430\u043f\u0430\u043d deluxe');

  const size = page.getByLabel(/\u0420\u0430\u0437\u043c\u0435\u0440 \u043f\u043e\u0437\u0438\u0446\u0438\u0438 1/);
  await size.fill('46');
  await size.press('ArrowDown');
  await size.press('Enter');
  await expect(size).toHaveValue('46');

  await page.getByLabel(/\u041a\u043e\u043b-\u0432\u043e \u043f\u043e\u0437\u0438\u0446\u0438\u0438 1/).fill('2');
  await page.getByLabel(/\u0426\u0435\u043d\u0430 \u0437\u0430 \u0435\u0434\. \u043f\u043e\u0437\u0438\u0446\u0438\u0438 1/).fill('15000');
  await page.getByLabel(/\u0412\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u044f\u044f \u0437\u0430\u043c\u0435\u0442\u043a\u0430/).fill('E2E note');

  return clientName;
}

test.describe('Chapan new order workflow', () => {
  test('creates an order and persists it in the list', async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });

    await loginOwner(page);
    await stubChapanOrderFormData(page);
    await openNewOrderPage(page);

    const clientName = await fillOrderForm(page, String(Date.now()));

    const responsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes('/api/v1/chapan/orders'),
      { timeout: 10_000 },
    );

    await expect(page.getByRole('button', { name: /\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0437\u0430\u043a\u0430\u0437/ })).toBeEnabled();
    await page.getByRole('button', { name: /\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0437\u0430\u043a\u0430\u0437/ }).click({ timeout: 5000 });

    const response = await responsePromise;
    expect(response.status(), await response.text()).toBe(201);

    await expect(page).toHaveURL(/\/workzone\/chapan\/orders(?:\/)?$/);
    await expect(page.getByText(clientName)).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('reset clears restored draft and keeps numeric inputs empty after deletion', async ({ page }) => {
    test.setTimeout(180_000);

    await loginOwner(page);
    await stubChapanOrderFormData(page);
    await openNewOrderPage(page);

    await fillOrderForm(page, `draft-${Date.now()}`);

    const quantity = page.getByLabel(/\u041a\u043e\u043b-\u0432\u043e \u043f\u043e\u0437\u0438\u0446\u0438\u0438 1/);
    const unitPrice = page.getByLabel(/\u0426\u0435\u043d\u0430 \u0437\u0430 \u0435\u0434\. \u043f\u043e\u0437\u0438\u0446\u0438\u0438 1/);
    const orderDiscount = page.getByLabel(/\u0421\u043a\u0438\u0434\u043a\u0430 \u043d\u0430 \u0437\u0430\u043a\u0430\u0437/);
    const discountPercent = page.getByLabel(/\u041f\u0440\u043e\u0446\u0435\u043d\u0442 \u0441\u043a\u0438\u0434\u043a\u0438/);

    await quantity.fill('7');
    await quantity.fill('');
    await quantity.blur();
    await expect(quantity).toHaveValue('1');

    await unitPrice.fill('12000');
    await unitPrice.fill('');
    await unitPrice.blur();
    await expect(unitPrice).toHaveValue('');

    await orderDiscount.fill('500');
    await orderDiscount.fill('');
    await orderDiscount.blur();
    await expect(orderDiscount).toHaveValue('');

    await discountPercent.fill('12.5');
    await discountPercent.fill('');
    await discountPercent.blur();
    await expect(discountPercent).toHaveValue('');

    await page.waitForTimeout(1200);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/\u0412\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d \u043d\u0435\u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043d\u043d\u044b\u0439 \u0447\u0435\u0440\u043d\u043e\u0432\u0438\u043a/)).toBeVisible();

    await page.getByRole('button', { name: /\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c/ }).click();

    await expect(page.getByLabel(/\u0424\u0418\u041e \u043a\u043b\u0438\u0435\u043d\u0442\u0430/)).toHaveValue('');
    await expect(page.getByLabel(/\u0422\u0435\u043b\u0435\u0444\u043e\u043d KZ/)).toHaveValue('');
    await expect(page.getByLabel(/\u0413\u043e\u0440\u043e\u0434/)).toHaveValue('');
    await expect(page.getByLabel(/\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430/).first()).toHaveValue('');
    await expect(page.getByLabel(/\u041c\u043e\u0434\u0435\u043b\u044c \u043f\u043e\u0437\u0438\u0446\u0438\u0438 1/)).toHaveValue('');
    await expect(page.getByLabel(/\u0420\u0430\u0437\u043c\u0435\u0440 \u043f\u043e\u0437\u0438\u0446\u0438\u0438 1/)).toHaveValue('');
    await expect(page.getByLabel(/\u041a\u043e\u043b-\u0432\u043e \u043f\u043e\u0437\u0438\u0446\u0438\u0438 1/)).toHaveValue('1');
    await expect(page.getByLabel(/\u0426\u0435\u043d\u0430 \u0437\u0430 \u0435\u0434\. \u043f\u043e\u0437\u0438\u0446\u0438\u0438 1/)).toHaveValue('');
    await expect(page.getByLabel(/\u0421\u043a\u0438\u0434\u043a\u0430 \u043d\u0430 \u0437\u0430\u043a\u0430\u0437/)).toHaveValue('');
    await expect(page.getByLabel(/\u041f\u0440\u043e\u0446\u0435\u043d\u0442 \u0441\u043a\u0438\u0434\u043a\u0438/)).toHaveValue('');
  });
});

