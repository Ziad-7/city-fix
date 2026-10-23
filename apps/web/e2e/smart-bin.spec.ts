import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('the smart bin page opens signed out, in Arabic', async ({ page }) => {
  await page.goto('/smart-bin');
  await expect(page).toHaveURL(/\/smart-bin$/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1, name: 'الصندوق الذكي' })).toBeVisible();
  await expect(page.getByRole('img', { name: /صندوق ذكي/ })).toBeVisible();
  await expect(page.getByTestId('sb-note')).toContainText('محاكاة في المتصفح');
});

test('filling and emptying the bin changes what the page says', async ({ page }) => {
  await page.goto('/smart-bin');
  const status = page.getByTestId('sb-status');
  await expect(status).toContainText('شغال وفيه مكان');
  await page.getByTestId('sb-fill').fill('90');
  await expect(status).toContainText('اتملى');
  await page.getByTestId('sb-empty').click();
  await expect(status).toContainText('شغال وفيه مكان');
  await expect(page.getByTestId('sb-empty')).toBeDisabled();
});

test('heat, no signal and start over', async ({ page }) => {
  await page.goto('/smart-bin');
  const status = page.getByTestId('sb-status');
  await page.getByTestId('sb-temp').fill('65');
  await expect(status).toContainText('سخن');
  await page.getByTestId('sb-fill').fill('90');
  await page.getByTestId('sb-offline').click();
  await expect(status).toContainText('مش لاقي شبكة');
  await page.getByTestId('sb-reset').click();
  await expect(status).toContainText('شغال وفيه مكان');
});

test('the old static page address redirects', async ({ page }) => {
  await page.goto('/smart-bin-simulator.html');
  await expect(page).toHaveURL(/\/smart-bin$/);
});

test('the smart bin page works in English', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ftc.prefs.v1', JSON.stringify({ state: { lang: 'en' }, version: 0 })));
  await page.goto('/smart-bin');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { level: 1, name: 'Smart bin' })).toBeVisible();
  await page.getByTestId('sb-fill').fill('90');
  await expect(page.getByTestId('sb-status')).toContainText('The bin is full');
});

test('the home page links to the smart bin', async ({ page }) => {
  await signIn(page);
  await page.getByTestId('home-smart-bin').click();
  await expect(page).toHaveURL(/\/smart-bin$/);
});
