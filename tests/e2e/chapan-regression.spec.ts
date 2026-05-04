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
      await expect(page.locator('body')).not.toContainText('\u041d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u0430');
      await expect(page.locator('body')).not.toContainText('\u0432\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u044f\u044f \u043e\u0448\u0438\u0431\u043a\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430');
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
            orgId: 'org-1',
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
            orgId: 'org-1',
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
            orgId: 'org-1',
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
            orgId: 'org-1',
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

    await page.getByRole('button', { name: /\u041d\u043e\u0432\u0430\u044f \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u0430\u044f/i }).click();

    const title = page.getByLabel('\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u043e\u0439');
    const product = page.getByLabel('\u0422\u043e\u0432\u0430\u0440 \u0434\u043b\u044f \u043f\u043e\u0437\u0438\u0446\u0438\u0438 1');
    const color = page.getByLabel('\u0426\u0432\u0435\u0442 \u0434\u043b\u044f \u043f\u043e\u0437\u0438\u0446\u0438\u0438 1');
    const size = page.getByLabel('\u0420\u0430\u0437\u043c\u0435\u0440 \u0434\u043b\u044f \u043f\u043e\u0437\u0438\u0446\u0438\u0438 1');
    const quantity = page.getByLabel('\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u0434\u043b\u044f \u043f\u043e\u0437\u0438\u0446\u0438\u0438 1');
    const unitPrice = page.getByLabel('\u0426\u0435\u043d\u0430 \u0434\u043b\u044f \u043f\u043e\u0437\u0438\u0446\u0438\u0438 1');
    const invoiceTitle = `E2E \u0437\u0430\u043a\u0443\u043f ${Date.now()}`;

    await title.fill(invoiceTitle);
    await product.fill('\u0427\u0430\u043f');
    await expect(page.getByText('\u0427\u0430\u043f\u0430\u043d deluxe')).toBeVisible();
    await product.press('ArrowDown');
    await product.press('Enter');
    await color.fill('\u0411\u043e\u0440');
    await expect(page.getByText('\u0411\u043e\u0440\u0434\u043e\u0432\u044b\u0439')).toBeVisible();
    await color.press('ArrowDown');
    await color.press('Enter');
    await size.fill('46');
    await size.press('ArrowDown');
    await size.press('Enter');
    await expect(size).toHaveValue('46');
    await quantity.fill('2');
    await unitPrice.fill('1500');

    for (let i = 0; i < 9; i += 1) {
      await page.mouse.move(120 + i, 140 + i);
      await page.keyboard.press('Shift');
      await page.waitForTimeout(5_000);
      await expect(title).toHaveValue(invoiceTitle);
      await expect(product).toHaveValue('\u0427\u0430\u043f\u0430\u043d deluxe');
    }

    expect(unexpectedNavigations).toEqual([]);
    await expect(page).toHaveURL(stableUrl);
    await expect(title).toBeVisible();

    await page.getByRole('button', { name: /^\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c$/ }).click();
    await expect(page.getByText(invoiceTitle)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /\u041d\u043e\u0432\u0430\u044f \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u0430\u044f/i })).toBeVisible();

    await page.evaluate(() => {
      const capture = { filename: '', href: '', blobType: '', blobSize: 0 };
      (window as Window & { __downloadCapture?: typeof capture }).__downloadCapture = capture;

      const originalCreateObjectUrl = URL.createObjectURL.bind(URL);
      URL.createObjectURL = ((blob: Blob) => {
        capture.blobType = blob.type;
        capture.blobSize = blob.size;
        return originalCreateObjectUrl(blob);
      }) as typeof URL.createObjectURL;

      const originalClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function click() {
        if (this.download) {
          capture.filename = this.download;
          capture.href = this.href;
        }
        return originalClick.call(this);
      };
    });

    const createdInvoiceCard = page.getByRole('button', {
      name: new RegExp(invoiceTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    });
    await expect(createdInvoiceCard).toBeVisible();
    await createdInvoiceCard.getByLabel(/xlsx/i).click();

    await page.waitForFunction(() => {
      const capture = (window as Window & {
        __downloadCapture?: {
          filename?: string;
          blobType?: string;
          blobSize?: number;
        };
      }).__downloadCapture;

      return Boolean(capture?.filename) && Boolean(capture?.blobType) && (capture?.blobSize ?? 0) > 0;
    });

    const downloadCapture = await page.evaluate(() => (
      (window as Window & {
        __downloadCapture?: {
          filename: string;
          href: string;
          blobType: string;
          blobSize: number;
        };
      }).__downloadCapture
    ));

    expect(downloadCapture?.filename).toContain('zakup_');
    expect(downloadCapture?.blobType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(downloadCapture?.blobSize).toBeGreaterThan(0);
    expect(popups).toEqual([]);

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
