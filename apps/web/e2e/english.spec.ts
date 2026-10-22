import { expect, test } from '@playwright/test';
import { at, signIn } from './helpers';

test.beforeEach(async ({ context }) => {
  await at(context, 30.07, 31.36);
});

test('switching to English flips the page to LTR, survives a reload, and switches back', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

  await page.getByTestId('lang-link').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();

  // Signed in, the top bar nav is English.
  await page.getByTestId('phone-input').fill('01012345678');
  await page.getByTestId('sign-in-submit').click();
  await page.getByTestId('otp-0').fill('123456');
  await page.waitForURL((u) => !u.pathname.startsWith('/sign-in'));
  const nav = page.getByRole('navigation', { name: 'Main navigation' }).first();
  await expect(nav).toContainText('My requests');
  await expect(nav).not.toContainText('طلباتي');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).first()).toContainText('My requests');

  // Back to Arabic from the top bar.
  await page.getByTestId('lang-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.getByRole('navigation', { name: 'التنقل الرئيسي' }).first()).toContainText('طلباتي');
});

test('Arabic stays the default on a fresh visit', async ({ page }) => {
  await signIn(page);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});
