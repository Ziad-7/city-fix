import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('the sorting guide opens signed out', async ({ page }) => {
  await page.goto('/recycling-guide');
  await expect(page).toHaveURL(/\/recycling-guide$/);
  await expect(page.getByRole('heading', { level: 1, name: 'دليل الفرز' })).toBeVisible();
  await expect(page.getByTestId('guide-pet_plastic')).toBeVisible();
  await expect(page.getByTestId('guide-print')).toBeVisible();
});

test('the bins layer shows pins', async ({ page }) => {
  await signIn(page, '/map');
  await page.getByTestId('layer-bins').click();
  await expect(page.locator('.cc-binpin').first()).toBeVisible();
  await expect(page.locator('[data-testid^="bin-item-"]').first()).toBeVisible();
  await page.locator('[data-testid^="bin-item-"]').first().click();
  await expect(page.getByTestId('bin-sheet')).toBeVisible();
});

test('the impact page loads after sign-in', async ({ page }) => {
  await signIn(page, '/impact');
  await expect(page).toHaveURL(/\/impact$/);
  await expect(page.getByRole('heading', { level: 1, name: 'أثري في التدوير' })).toBeVisible();
});
