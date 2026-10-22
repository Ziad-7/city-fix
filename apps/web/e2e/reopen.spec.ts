import { expect, test } from '@playwright/test';
import { at, signIn, trackGeocoder } from './helpers';

test.beforeEach(async ({ context }) => {
  await at(context, 30.07, 31.36);
  await trackGeocoder(context);
});

test('a resolved report can be reopened from the tracking page', async ({ page }) => {
  await signIn(page);
  await page.goto('/report/new?category=pothole');
  await page.getByTestId('description-input').fill('حفرة كبيرة في نص الشارع قدام العمارة');
  await expect(page.getByTestId('ai-suggestion')).toBeVisible();
  await page.getByTestId('submit-report').click();
  await expect(page.getByRole('heading', { name: 'تسلم إيدك!' })).toBeVisible();
  await page.getByTestId('track-report').click();

  // Open: no reopen card yet.
  const simulate = page.getByTestId('simulate-progress');
  await expect(simulate).toBeEnabled();
  await expect(page.getByTestId('reopen-card')).toHaveCount(0);

  // received -> triaged -> assigned -> in progress -> resolved
  for (let i = 0; i < 4; i++) {
    await simulate.click();
    if (i < 3) await expect(simulate).toBeEnabled();
  }
  await expect(page.getByTestId('timeline')).toContainText('اتصلّح');
  const card = page.getByTestId('reopen-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('لسه المشكلة موجودة؟');

  await page.getByTestId('reopen-note').fill('الحفرة اتردمت بس النزلة لسه مكسورة');
  await page.getByTestId('reopen-submit').click();
  await expect(page.getByTestId('reopen-done')).toContainText('اتفتح البلاغ تاني');
  await expect(page.getByTestId('reopen-card')).toHaveCount(0);
  // The report is open again, so it can move on.
  await expect(simulate).toBeEnabled();
  await expect(page.getByTestId('timeline')).toContainText('اتفتح');
});

test('an open report has no reopen card', async ({ page }) => {
  await signIn(page);
  await page.goto('/requests/FTC-1042');
  await expect(page.getByTestId('detail-title')).toBeVisible();
  await expect(page.getByTestId('reopen-card')).toHaveCount(0);
});

test('map pins carry a status word in their title and a glyph in the list', async ({ page }) => {
  await signIn(page);
  await page.goto('/map');
  await expect(page.locator('[data-testid^="map-item-"]')).toHaveCount(10);
  // The list draws a status glyph inside each pin: "!" for a critical one (INC-502)...
  await expect(page.getByTestId('map-item-INC-502').locator('.pn path[d^="M32 19v9"]')).toHaveCount(1);
  // ...and a check mark for the resolved ones.
  await page.getByRole('button', { name: 'اتصلّح', exact: true }).click();
  const resolved = page.locator('[data-testid^="map-item-"] .pn');
  await expect(resolved).toHaveCount(2);
  await expect(page.locator('[data-testid^="map-item-"] .pn path[d^="M26 26.8l4.4 4.4"]')).toHaveCount(2);
  // The map's own markers are named "title · status" (and "· خطر"), not just the title.
  await page.getByRole('button', { name: 'الكل', exact: true }).click();
  await expect(page.locator('.leaflet-marker-icon[title^="بالوعة مفتوحة في شارع حسن المأمون · "][title$="· خطر"]')).toHaveCount(1);
});
