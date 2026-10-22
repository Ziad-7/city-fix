import { expect, test } from '@playwright/test';
import { at, signIn, trackGeocoder } from './helpers';

test.beforeEach(async ({ context }) => {
  await at(context, 30.07, 31.36);
  await trackGeocoder(context);
});

test('the language radio switches the page to English and left-to-right', async ({ page }) => {
  await signIn(page, '/profile');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByTestId('lang-en').check();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { name: 'Account', level: 1 })).toBeVisible();
  await page.getByTestId('lang-ar').check();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'حسابي', level: 1 })).toBeVisible();
});

test('the notifications page opens with a heading and an empty state', async ({ page }) => {
  await signIn(page, '/notifications');
  await expect(page).toHaveURL(/\/notifications$/);
  await expect(page.getByRole('heading', { name: 'الإشعارات', level: 1 })).toBeVisible();
  await expect(page).toHaveTitle(/الإشعارات · سيتي فيكس/);
});

test('home has the recycling tile', async ({ page }) => {
  await signIn(page);
  await page.goto('/');
  const tile = page.getByTestId('tile-recycling');
  await expect(tile).toBeVisible();
  await expect(tile).toHaveAttribute('href', '/services/recycling');
});
