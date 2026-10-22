import { test, expect } from '@playwright/test';
import { ADMIN, STAFF, login } from './helpers';

test.describe('auth', () => {
  test('admin logs in and sees overview, then logs out', async ({ page }) => {
    await login(page, ADMIN);
    await expect(page.getByRole('link', { name: /الميزانية/ })).toBeVisible();
    await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('wrong password shows error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('البريد الإلكتروني للشغل').fill(ADMIN.email);
    await page.getByLabel('كلمة السر', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: 'دخول', exact: true }).click();
    await expect(page.locator('.notice--danger[role=alert]')).toContainText('البريد أو كلمة السر غلط');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('protected route redirects to /login when signed out', async ({ page }) => {
    await page.goto('/incidents');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('staff login hides the budget nav', async ({ page }) => {
    await login(page, STAFF);
    await expect(page.getByRole('link', { name: 'البلاغات' })).toBeVisible();
    await expect(page.getByRole('link', { name: /الميزانية/ })).toHaveCount(0);
  });
});
