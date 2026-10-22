import { expect, test } from '@playwright/test';
import { at, signIn, trackGeocoder } from './helpers';

// 1x1 PNG: enough for the photo picker (the page re-encodes it as a JPEG).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test.beforeEach(async ({ context }) => {
  await at(context, 30.07, 31.36);
  await trackGeocoder(context);
});

test('every service card opens a real page (no 404)', async ({ page }) => {
  await signIn(page);
  const cards = [
    { testId: 'service-bulky', title: 'رفع مخلفات كبيرة', url: /\/services\/bulky-waste$/ },
    { testId: 'service-tree', title: 'تقليم أو إزالة شجرة', url: /\/services\/tree$/ },
    { testId: 'service-garbage-schedule', title: 'مواعيد جمع القمامة', url: /\/services\/garbage-schedule$/ },
  ];
  for (const c of cards) {
    await page.goto('/services');
    await page.getByTestId(c.testId).click();
    await expect(page).toHaveURL(c.url);
    await expect(page.getByRole('heading', { name: c.title, level: 1 })).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(`${c.title} · سيتي فيكس`));
  }
});

test('the schedule card says "شوف المواعيد", not "احجز"', async ({ page }) => {
  await signIn(page);
  await page.goto('/services');
  await expect(page.getByTestId('service-garbage-schedule')).toContainText('شوف المواعيد');
  await expect(page.getByTestId('service-tree')).toContainText('احجز دلوقتي');
});

test('the home tiles for trees and garbage go to their pages', async ({ page }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'صيانة الشجر' }).click();
  await expect(page).toHaveURL(/\/services\/tree$/);
  await page.goto('/');
  await page.getByRole('link', { name: 'مواعيد جمع القمامة' }).click();
  await expect(page).toHaveURL(/\/services\/garbage-schedule$/);
});

test('the garbage schedule shows the next pickup and the weekly days', async ({ page }) => {
  await signIn(page);
  await page.goto('/services/garbage-schedule');
  await expect(page.getByTestId('garbage-next')).toContainText('الجاية');
  await expect(page.getByTestId('garbage-next')).toContainText('العربية بتعدّي');
  // The demo district (مدينة نصر أول) is collected on Sunday, Tuesday and Thursday.
  await expect(page.getByTestId('garbage-day-sun')).toHaveAttribute('aria-label', /فيه جمع/);
  await expect(page.getByTestId('garbage-day-mon')).toHaveAttribute('aria-label', /مفيش جمع/);
  await page.getByTestId('garbage-missed').click();
  await expect(page).toHaveURL(/\/report\/new\?category=garbage/);
});

test('a tree booking (with a photo from the gallery) lands in my requests with tree details', async ({ page }) => {
  await signIn(page);
  await page.goto('/services/tree');
  await expect(page.getByTestId('address-line')).toHaveText('موقعك الحالي');
  await expect(page.getByTestId('tree-free')).toContainText('الخدمة مجانية من إدارة الحدائق');

  await page.getByTestId('tree-submit').click();
  await expect(page.getByText('اختار نوع الشغل')).toBeVisible();

  await page.getByTestId('tree-photo-gallery').setInputFiles({ name: 'tree.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('img', { name: 'صورة الشجرة' })).toBeVisible();
  await page.getByRole('radio', { name: 'شجرة مايلة أو خطر' }).click();
  await page.getByTestId('tree-note').fill('الفرع قريب من أسلاك الكهربا');
  await page.getByTestId('tree-submit').click();

  await expect(page).toHaveURL(/\/requests\/SRV-\d+$/);
  const details = page.getByRole('region', { name: 'تفاصيل الحجز' });
  await expect(details).toContainText('نوع الشغل');
  await expect(details).toContainText('شجرة مايلة أو خطر');
  await expect(details).toContainText('الخدمة مجانية من إدارة الحدائق');
  await expect(details).toContainText('الفرع قريب من أسلاك الكهربا');
  await expect(details).not.toContainText('طريقة الدفع');
  await expect(details).not.toContainText('اللي هيترفع');
  await expect(page.getByText('إدارة الحدائق · حي')).toBeVisible();
});

test('the bulky-waste options can all be reached with the arrow keys', async ({ page }) => {
  await signIn(page);
  await page.goto('/services/bulky-waste');

  // Payment: cash -> fawry -> instapay -> wallet. (Right-to-left: ArrowLeft goes to the next one.)
  const cash = page.getByRole('radio', { name: 'كاش مع العامل' });
  await cash.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('radio', { name: 'فوري' })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  const instapay = page.getByRole('radio', { name: 'إنستاباي' });
  await expect(instapay).toBeFocused();
  await expect(instapay).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('radio', { name: 'محفظة موبايل' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(instapay).toBeFocused();

  // Days: the arrows move through every day, not only the selected one.
  const days = page.locator('[data-testid^="day-"]');
  await expect(days).toHaveCount(5);
  await days.nth(0).focus();
  for (let i = 1; i < 5; i++) {
    await page.keyboard.press('ArrowLeft');
    await expect(days.nth(i)).toBeFocused();
    await expect(days.nth(i)).toHaveAttribute('aria-checked', 'true');
  }
  // Only the chosen day is a tab stop.
  await expect(days.nth(4)).toHaveAttribute('tabindex', '0');
  await expect(days.nth(0)).toHaveAttribute('tabindex', '-1');
});

test('the AI category options are a roving radiogroup', async ({ page }) => {
  await signIn(page);
  await page.goto('/report/new?category=pothole');
  await page.getByTestId('description-input').fill('بالوعة مفتوحة وسط الشارع وفيها خطر');
  await expect(page.getByTestId('ai-suggestion')).toBeVisible();
  const options = page.locator('[data-testid^="ai-option-"]');
  expect(await options.count()).toBeGreaterThan(1);
  await options.nth(0).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(options.nth(1)).toBeFocused();
  await expect(options.nth(1)).toHaveAttribute('aria-checked', 'true');
  await expect(options.nth(1)).toHaveAttribute('tabindex', '0');
  await expect(options.nth(0)).toHaveAttribute('tabindex', '-1');
});

test('the report photo picker has a camera input and a gallery input', async ({ page }) => {
  await signIn(page);
  await page.goto('/report/new?category=pothole');
  // Camera: takes a new photo on a phone. Gallery: no `capture`, so a photo that was already taken can be picked.
  await expect(page.getByTestId('photo-camera')).toHaveAttribute('capture', 'environment');
  await expect(page.getByTestId('photo-input')).not.toHaveAttribute('capture', /.*/);
  await expect(page.getByTestId('photo-input')).toHaveAttribute('multiple', '');
  await expect(page.getByText('أو من المعرض')).toHaveAttribute('for', 'photo-gallery');
  await page.getByTestId('photo-input').setInputFiles({ name: 'pothole.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('img', { name: /صورة ١/ })).toBeVisible();
});
