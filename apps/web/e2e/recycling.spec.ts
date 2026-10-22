import { expect, test } from '@playwright/test';
import { at, signIn, trackGeocoder } from './helpers';

test.beforeEach(async ({ context }) => {
  await at(context, 30.07, 31.36);
  await trackGeocoder(context);
});

test('the services page has a CityCycle section that opens the pickup form', async ({ page }) => {
  await signIn(page);
  await page.goto('/services');
  await expect(page.getByTestId('service-guide')).toBeVisible();
  await expect(page.getByTestId('service-impact')).toBeVisible();
  await page.getByTestId('service-recycling').click();
  await expect(page).toHaveURL(/\/services\/recycling$/);
  await expect(page.getByRole('heading', { name: 'جمع تدوير من بيتك', level: 1 })).toBeVisible();
});

test('a recycling pickup with PET and paper lands on its RCY- page', async ({ page }) => {
  await signIn(page);
  await page.goto('/services/recycling');
  await expect(page.getByTestId('address-line')).toHaveText('موقعك الحالي');

  // Nothing chosen yet: the form says so and stays on the page.
  await page.getByTestId('recycling-submit').click();
  await expect(page.getByTestId('items-error')).toContainText('اختار خامة واحدة على الأقل');

  await page.getByTestId('material-pet_plastic').click();
  await page.getByTestId('material-paper_cardboard').click();
  await expect(page.getByTestId('weight-pet_plastic')).toBeVisible();
  await expect(page.getByTestId('weight-paper_cardboard')).toBeVisible();
  await page.getByTestId('kg-pet_plastic-plus').click();

  await page.getByTestId('mode-free').click();
  await expect(page.getByTestId('mode-free')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('mode-paid').click();
  await expect(page.getByTestId('recycling-estimate')).toBeVisible();

  await page.getByTestId('recycling-note').fill('الخامات في الجراج، رن الجرس');
  await page.getByTestId('recycling-submit').click();

  await expect(page).toHaveURL(/\/requests\/RCY-[\w-]+$/);
});
