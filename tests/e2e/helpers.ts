import { expect, type Locator, type Page } from '@playwright/test';

async function setInputValue(input: Locator, value: string) {
  await expect(input).toBeVisible({ timeout: 10000 });
  await input.fill(value);
}

async function triggerSubmit(page: Page) {
  const button = page.locator('form button[type="submit"]').first();
  await expect(button).toBeVisible({ timeout: 10000 });
  await button.click();
}

async function waitForLoginFields(page: Page) {
  const fields = page.locator('form input:not([type="checkbox"])');

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!page.url().includes('/auth/login')) {
      return null;
    }

    const count = await fields.count();
    if (count >= 2) {
      return fields;
    }

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
  }

  return null;
}

async function ensureLoggedOut(page: Page) {
  const logoutButton = page.locator('aside button').last();
  if (!(await logoutButton.isVisible().catch(() => false))) {
    return;
  }

  await logoutButton.click();
  await page.waitForURL(/\/auth\/login$/, { timeout: 15000 });
}

export async function preparePage(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('kort.workspace:intro-v1', '1');
    window.sessionStorage.setItem('kort.workspace:intro-v1', '1');

    const disableMotion = () => {
      if (document.getElementById('e2e-disable-motion')) {
        return;
      }

      const style = document.createElement('style');
      style.id = 'e2e-disable-motion';
      style.textContent = `
        *,
        *::before,
        *::after {
          animation: none !important;
          transition: none !important;
          scroll-behavior: auto !important;
        }
      `;
      document.head.appendChild(style);
    };

    if (document.head) {
      disableMotion();
    } else {
      window.addEventListener('DOMContentLoaded', disableMotion, { once: true });
    }
  });
}

export async function clearSession(page: Page) {
  await page.context().clearCookies();
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem('kort.workspace:intro-v1', '1');
    window.sessionStorage.clear();
    window.sessionStorage.setItem('kort.workspace:intro-v1', '1');
  });
  await page.reload({ waitUntil: 'load' });

  if (!page.url().includes('/auth/login')) {
    await ensureLoggedOut(page);
  }

  await expect(page).toHaveURL(/\/auth\/login$/);
}

export async function navigateWithinApp(page: Page, route: string) {
  await page.evaluate((nextRoute) => {
    window.history.pushState({}, '', nextRoute);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, route);
  await expect(page).toHaveURL(new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
}

export async function loginAs(page: Page, email: string, password = 'demo1234') {
  await preparePage(page);
  await clearSession(page);

  const submit = async () => {
    const fields = await waitForLoginFields(page);
    if (!fields) {
      return false;
    }
    await setInputValue(fields.nth(0), email);
    await setInputValue(fields.nth(1), password);
    await triggerSubmit(page);
    return true;
  };

  const submitted = await submit();
  if (!submitted) {
    if (!page.url().includes('/auth/login')) {
      return;
    }
    throw new Error('Login form did not render in time');
  }

  try {
    await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 15000 });
    return;
  } catch {
    await expect(page).toHaveURL(/\/auth\/login$/);
  }

  await page.reload({ waitUntil: 'load' });
  await expect(page).toHaveURL(/\/auth\/login$/);
  const resubmitted = await submit();
  if (!resubmitted) {
    if (!page.url().includes('/auth/login')) {
      return;
    }
    throw new Error('Login form did not render after reload');
  }
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 15000 });
}
