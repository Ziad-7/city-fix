import { expect, test } from '@playwright/test';
import { at, noGeocoder, signIn } from './helpers';

test.beforeEach(async ({ context }) => {
  await at(context, 30.07, 31.36); // in Nasr City, away from the seeded incidents
  await noGeocoder(context);
});

test('signed-out visitors go to sign-in and come back after the code', async ({ page }) => {
  await page.goto('/requests');
  await page.waitForURL(/\/sign-in\?next=%2Frequests/);
  await page.getByTestId('phone-input').fill('0101');
  await page.getByTestId('sign-in-submit').click();
  await expect(page.locator('.a-err')).toContainText('رقم الموبايل مش صح');
  await signIn(page, '/requests');
  await expect(page).toHaveURL(/\/requests$/);
  await expect(page.getByRole('heading', { name: 'طلباتي', level: 1 })).toBeVisible();
});

test('home shows the greeting, nearby incidents and my latest updates', async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/صباح الفل|مساء الفل/);
  await expect(page.getByTestId('request-FTC-1042')).toBeVisible();
  const nearby = page.locator('[data-testid^="nearby-"]');
  await expect(nearby.first()).toBeVisible();
  await nearby.first().getByRole('button', { name: /أنا كمان/ }).click();
  await expect(nearby.first().getByText('متابَع')).toBeVisible();
});

test('a report goes out end to end and shows up in my requests with its timeline', async ({ page }) => {
  await signIn(page);
  await page.goto('/report/category');
  await page.getByTestId('category-streetlight_out').click();
  await expect(page).toHaveURL(/category=streetlight_out/);

  // Validation: no photo and a short description.
  await page.getByTestId('submit-report').click();
  await expect(page.getByText('ضيف صورة أو اكتب وصف للمشكلة')).toBeVisible();

  await page.getByTestId('description-input').fill('عمود النور قدام العمارة مطفي من أسبوع');
  await expect(page.getByTestId('ai-suggestion')).toBeVisible();
  await expect(page.getByTestId('address-line')).toHaveText('موقعك الحالي');
  await page.getByTestId('landmark-input').fill('جنب الصيدلية');
  await page.getByTestId('submit-report').click();

  await expect(page.getByRole('heading', { name: 'تسلم إيدك!' })).toBeVisible();
  const number = (await page.getByTestId('report-number').textContent())!.replace('#', '').trim();
  expect(number).toMatch(/^FTC-\d{4}$/);
  await page.getByTestId('track-report').click();
  await expect(page).toHaveURL(new RegExp(`/requests/${number}$`));
  await expect(page.getByTestId('timeline')).toContainText('وصلنا بلاغك');

  await page.getByTestId('simulate-progress').click();
  await expect(page.getByTestId('timeline')).toContainText('اتصنّف');

  await page.goto('/requests');
  await expect(page.getByTestId(`request-${number}`)).toBeVisible();
});

test('a nearby same-category incident is offered as "نفس المشكلة، تابعها"', async ({ page, context }) => {
  await at(context, 30.059, 31.335); // next to the seeded garbage incident
  await signIn(page);
  await page.goto('/report/new?category=garbage');
  await page.getByTestId('description-input').fill('زبالة متراكمة على الناصية من يومين');
  await expect(page.getByTestId('duplicate-panel')).toBeVisible();
  await page.getByTestId('dup-join').click();
  await expect(page.getByText('اتضمّيت للبلاغ الموجود')).toBeVisible();
});

test('my own nearby report is shown as already reported, not as a join offer', async ({ page, context }) => {
  await at(context, 30.0562, 31.3305); // the demo user's pothole report FTC-1042
  await signIn(page);
  await page.goto('/report/new?category=pothole');
  await page.getByTestId('description-input').fill('حفرة كبيرة في نص الشارع');
  await expect(page.getByTestId('already-reported')).toBeVisible();
  await expect(page.getByTestId('duplicate-panel')).toHaveCount(0);
});

test('a bulky-waste booking lands in my requests', async ({ page }) => {
  await signIn(page);
  await page.goto('/services');
  await page.getByTestId('service-bulky').click();
  await page.getByTestId('book-submit').click();
  await expect(page.getByText('اختار حاجة واحدة على الأقل')).toBeVisible();
  await page.getByRole('checkbox', { name: 'كنبة' }).click();
  await page.getByRole('radio', { name: 'إنستاباي' }).click();
  await page.getByTestId('book-submit').click();
  await expect(page).toHaveURL(/\/requests\/SRV-\d+$/);
  await expect(page.getByText('إنستاباي')).toBeVisible();
  await page.goto('/requests');
  await page.getByRole('button', { name: 'خدمات' }).click();
  await expect(page.locator('[data-testid^="request-SRV-"]')).toHaveCount(2);
});

test('the map filters pins and opens a pin card', async ({ page }) => {
  await signIn(page);
  await page.goto('/map');
  await expect(page.locator('[data-testid^="map-item-"]')).toHaveCount(10);
  await page.getByRole('button', { name: 'اتصلّح', exact: true }).click();
  await expect(page.locator('[data-testid^="map-item-"]')).toHaveCount(2);
  await page.getByRole('button', { name: 'الكل', exact: true }).click();
  await page.getByTestId('map-item-INC-502').click();
  await expect(page.getByTestId('pin-card')).toContainText('بالوعة مفتوحة');
  await page.getByTestId('pin-follow').click();
  await expect(page.getByTestId('pin-follow')).toContainText('متابَع');
});

test('profile saves the name and signs out', async ({ page }) => {
  await signIn(page);
  await page.goto('/profile');
  await page.getByTestId('name-input').fill('منى');
  await page.getByTestId('name-save').click();
  await expect(page.getByText('اتحفظ الاسم')).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('منى');
  await page.goto('/profile');
  await page.getByTestId('sign-out').click();
  await page.getByTestId('sign-out-confirm').click();
  await page.waitForURL(/\/sign-in/);
});
