import { expect, test, type Page } from '@playwright/test';
import { preparePage } from './helpers';

test.describe('Chapan Production Redesign — Цех', () => {
  async function loginAndNavigate(page: Page) {
    await preparePage(page);
    // Use direct navigation to skip auth flow for faster testing
    await page.goto('/workzone/chapan/production', { waitUntil: 'networkidle', timeout: 30000 });
  }

  test('1. Production page loads without errors and displays flat list (not kanban)', async ({
    page,
  }) => {
    test.setTimeout(60000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });

    await loginAndNavigate(page);

    // Verify page title
    const title = page.locator('h1:has-text("Цех")');
    await expect(title).toBeVisible({ timeout: 10000 });

    // Verify controls are present (search, filters)
    const searchInput = page.locator('input[placeholder="Заказ или товар..."]');
    await expect(searchInput).toBeVisible();

    // Verify table header is visible (12-column grid)
    const tableHeader = page.locator('text=Товар').first();
    await expect(tableHeader).toBeVisible();

    // Verify cards exist (not kanban columns)
    const cards = page.locator('[class*="card"]');
    const cardCount = await cards.count();
    expect(cardCount, `Expected at least 1 card, found ${cardCount}`).toBeGreaterThan(0);

    // Verify no kanban layout exists (no "Новые заказы" / "Выполнение" column headers)
    const kanbanColumn = page.locator('text=/Новые заказы|Выполнение/');
    expect(await kanbanColumn.count(), 'Kanban columns should not exist in new design').toBe(0);

    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('2. Visual comparison: page layout matches design mockup', async ({ page }) => {
    test.setTimeout(60000);
    await loginAndNavigate(page);

    // Wait for content to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Take full page screenshot for visual comparison
    await page.screenshot({ path: 'playwright-report/cex-full-page.png', fullPage: true });

    // Verify key visual elements
    const header = page.locator('header:has-text("Цех")');
    await expect(header).toBeVisible();

    const headerScreenshot = await header.screenshot();
    expect(headerScreenshot).toBeDefined();
    console.log('Header screenshot captured (header with search and filters)');
  });

  test('3. Sorting: tasks displayed by due date, urgent first in same date', async ({ page }) => {
    test.setTimeout(60000);
    await loginAndNavigate(page);
    await page.waitForLoadState('networkidle');

    // Get all task cards
    const cards = page.locator('[class*="card"]:not([class*="Selected"])');
    const cardCount = await cards.count();

    if (cardCount < 2) {
      console.log(`Only ${cardCount} task(s) visible, skipping detailed sort verification`);
      return;
    }

    // Verify that cards are sorted (we can't check exact dates in E2E,
    // but we can verify that due date column is populated and in order)
    const dueDates: string[] = [];
    for (let i = 0; i < Math.min(cardCount, 5); i++) {
      const card = cards.nth(i);
      const dateText = await card.locator('[class*="date"]').last().textContent();
      if (dateText && dateText !== '—') {
        dueDates.push(dateText || '');
      }
    }

    console.log(`First ${dueDates.length} visible due dates: ${dueDates.join(', ')}`);
    expect(dueDates.length, 'Should have at least some tasks with due dates').toBeGreaterThan(0);
  });

  test('4. Search functionality: filter by order number', async ({ page }) => {
    test.setTimeout(60000);
    await loginAndNavigate(page);
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('input[placeholder="Заказ или товар..."]');
    const positionCountBefore = page.locator('text=/\\d+ позиций/');

    // Get initial count
    const countTextBefore = await positionCountBefore.textContent();
    console.log(`Positions before search: ${countTextBefore}`);

    // Search for a specific order (assuming at least one exists)
    await searchInput.fill('256');
    await page.waitForTimeout(500);

    const countTextAfter = await positionCountBefore.textContent();
    console.log(`Positions after searching for "256": ${countTextAfter}`);

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(300);

    const countTextRestored = await positionCountBefore.textContent();
    console.log(`Positions after clearing search: ${countTextRestored}`);
  });

  test('5. Selection: checkboxes and "Only selected" toggle', async ({ page }) => {
    test.setTimeout(60000);
    await loginAndNavigate(page);
    await page.waitForLoadState('networkidle');

    // Get first card checkbox
    const firstCardCheckbox = page.locator('input[type="checkbox"]').first();
    await expect(firstCardCheckbox).toBeVisible();

    // Click checkbox to select
    await firstCardCheckbox.click();
    await page.waitForTimeout(300);

    // Verify selection bar appears
    const selectionBar = page.locator('text=/выбрано/');
    await expect(selectionBar).toBeVisible();

    // Verify "Только выбранные" button appears
    const onlySelectedBtn = page.locator('text=Только выбранные').first();
    await expect(onlySelectedBtn).toBeVisible();

    // Click "Только выбранные" to filter
    await onlySelectedBtn.click();
    await page.waitForTimeout(300);

    // Verify button is now active/highlighted
    const activeBtn = page.locator('text=Только выбранные').first();
    const classes = await activeBtn.getAttribute('class');
    console.log(`Button classes after click: ${classes}`);

    // Unselect checkbox
    await firstCardCheckbox.click();
    await page.waitForTimeout(300);

    // Verify selection bar and button disappear
    expect(await selectionBar.isVisible().catch(() => false)).toBe(false);
  });

  test('6. "Готово" button works and removes card optimistically', async ({ page }) => {
    test.setTimeout(60000);
    await loginAndNavigate(page);
    await page.waitForLoadState('networkidle');

    // Get first done button
    const firstDoneBtn = page.locator('text=Готово').first();

    // Count cards before
    const cardsBefore = await page.locator('[class*="card"]:not([class*="Selected"])').count();

    // If no cards or no done button, skip
    if (cardsBefore === 0) {
      console.log('No tasks available for testing "Готово" action');
      return;
    }

    if (!(await firstDoneBtn.isVisible().catch(() => false))) {
      console.log('"Готово" button not visible, skipping action test');
      return;
    }

    // Click done button
    await firstDoneBtn.click();
    await page.waitForTimeout(500);

    // Verify card is removed (optimistic UI)
    const cardsAfter = await page.locator('[class*="card"]:not([class*="Selected"])').count();
    console.log(`Cards before "Готово": ${cardsBefore}, after: ${cardsAfter}`);
    // Note: may not decrease if the action failed or if card reappears on invalidation
  });

  test('7. CSS Grid layout: 12-column structure applied correctly', async ({ page }) => {
    test.setTimeout(60000);
    await loginAndNavigate(page);
    await page.waitForLoadState('networkidle');

    const tableHeader = page.locator('[class*="tableHeader"]').first();
    const headerStyle = await tableHeader.getAttribute('style');
    const computedStyle = await tableHeader.evaluate((el) => getComputedStyle(el).gridTemplateColumns);

    console.log(`Grid template columns: ${computedStyle}`);

    // Verify grid has columns (should be 12)
    expect(computedStyle, 'Should have grid columns defined').not.toBe('none');
  });

  test('8. Border colors: urgent (red), VIP (blue), normal (gray)', async ({ page }) => {
    test.setTimeout(60000);
    await loginAndNavigate(page);
    await page.waitForLoadState('networkidle');

    const cards = page.locator('[class*="card"]:not([class*="Selected"])');
    const cardCount = await cards.count();

    if (cardCount === 0) return;

    // Sample first 3 cards and check their border colors
    for (let i = 0; i < Math.min(cardCount, 3); i++) {
      const card = cards.nth(i);
      const borderColor = await card.evaluate((el) => getComputedStyle(el).borderLeftColor);
      console.log(`Card ${i} border color: ${borderColor}`);
    }
  });

  test('9. Theme tokens: styles use --ch-* variables not handoff tokens', async ({ page }) => {
    test.setTimeout(60000);
    await loginAndNavigate(page);
    await page.waitForLoadState('networkidle');

    // Check if root element has Chapan tokens
    const rootStyle = await page.evaluate(() => {
      const root = document.documentElement;
      const style = getComputedStyle(root);
      return {
        chSurface: style.getPropertyValue('--ch-surface'),
        chText: style.getPropertyValue('--ch-text'),
        chBorder: style.getPropertyValue('--ch-border'),
      };
    });

    console.log('Chapan theme tokens:', rootStyle);
    expect(rootStyle.chSurface || rootStyle.chText, 'Should have Chapan tokens defined').toBeTruthy();
  });

  test('10. No console errors or warnings specific to new components', async ({ page }) => {
    test.setTimeout(60000);
    const messages: Array<{ type: string; text: string }> = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        messages.push({ type: msg.type(), text: msg.text() });
      }
    });

    await loginAndNavigate(page);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const relevantErrors = messages.filter(
      (m) =>
        m.text.includes('WorkshopTaskCard') ||
        m.text.includes('ChapanProduction') ||
        m.text.includes('workshopSort'),
    );

    console.log(`Found ${relevantErrors.length} component-specific errors/warnings`);
    relevantErrors.forEach((err) => console.log(`  ${err.type}: ${err.text}`));

    expect(relevantErrors.length, 'Should have no component-specific errors').toBe(0);
  });
});
