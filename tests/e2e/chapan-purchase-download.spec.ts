import { expect, test, type Page } from '@playwright/test';
import { preparePage } from './helpers';

async function loginOwner(page: Page) {
  await preparePage(page);
}

test.describe('Chapan purchase download smoke', () => {
  test('creates a purchase invoice and downloads it through the blob flow in KZT mode', async ({ page }) => {
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
              name: 'Chapan deluxe',
              fields: [
                {
                  code: 'color',
                  label: 'Color',
                  inputType: 'select',
                  isRequired: false,
                  affectsAvailability: true,
                  options: [
                    { value: 'burgundy', label: 'Burgundy' },
                    { value: 'ivory', label: 'Ivory' },
                  ],
                },
                {
                  code: 'size',
                  label: 'Size',
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
            label: 'Gender',
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
              { id: 'g-1', definitionId: 'def-gender', value: 'female', label: 'Female', sortOrder: 0, isActive: true },
              { id: 'g-2', definitionId: 'def-gender', value: 'male', label: 'Male', sortOrder: 1, isActive: true },
            ],
          },
          {
            id: 'def-length',
            orgId: 'org-1',
            code: 'length',
            label: 'Length',
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
              { id: 'l-1', definitionId: 'def-length', value: 'long', label: 'Long', sortOrder: 0, isActive: true },
            ],
          },
          {
            id: 'def-color',
            orgId: 'org-1',
            code: 'color',
            label: 'Color',
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
              { id: 'c-1', definitionId: 'def-color', value: 'black', label: 'Black', sortOrder: 0, isActive: true },
            ],
          },
          {
            id: 'def-size',
            orgId: 'org-1',
            code: 'size',
            label: 'Size',
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
    const invoiceTitle = `e2e-purchase-${Date.now()}`;

    await page.locator('button').filter({ hasText: /\u041d\u043e\u0432\u0430\u044f \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u0430\u044f/i }).click();

    const title = page.getByLabel(/\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435/i);
    const product = page.getByLabel('\u0422\u043e\u0432\u0430\u0440 \u0434\u043b\u044f \u043f\u043e\u0437\u0438\u0446\u0438\u0438 1');
    const color = page.getByLabel('\u0426\u0432\u0435\u0442 \u0434\u043b\u044f \u043f\u043e\u0437\u0438\u0446\u0438\u0438 1');
    const size = page.getByLabel('\u0420\u0430\u0437\u043c\u0435\u0440 \u0434\u043b\u044f \u043f\u043e\u0437\u0438\u0446\u0438\u0438 1');
    const quantity = page.getByLabel(/\u041a\u043e\u043b/i);
    const unitPrice = page.getByLabel(/\u0426\u0435\u043d\u0430/i);

    await title.fill(invoiceTitle);
    await product.fill('Cha');
    await expect(page.getByText('Chapan deluxe')).toBeVisible();
    await product.press('ArrowDown');
    await product.press('Enter');
    await color.fill('Bur');
    await expect(page.getByText('Burgundy')).toBeVisible();
    await color.press('ArrowDown');
    await color.press('Enter');
    await size.fill('46');
    await expect(page.getByText('46')).toBeVisible();
    await size.press('ArrowDown');
    await size.press('Enter');
    await quantity.fill('2');
    await unitPrice.fill('1500');
    await expect(page.getByRole('columnheader', { name: /\u20b8/ })).toBeVisible();
    await expect(page.locator('span').filter({ hasText: /\u20b8/ }).last()).toBeVisible();

    await page.getByRole('button', { name: /^\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c$/ }).click();
    await expect(page.getByText(invoiceTitle)).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(stableUrl);

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

    await expect(page).toHaveURL(stableUrl);
    await page.getByRole('button', { name: /xlsx/i }).first().click();

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
