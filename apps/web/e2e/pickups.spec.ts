import { expect, test } from '@playwright/test';
import { at, signIn, trackGeocoder } from './helpers';

test.beforeEach(async ({ context }) => {
  await at(context, 30.07, 31.36);
  await trackGeocoder(context);
});

async function createPickup(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/services/recycling');
  await expect(page.getByTestId('address-line')).toHaveText('موقعك الحالي');
  await page.getByTestId('material-pet_plastic').click();
  await page.getByTestId('recycling-submit').click();
  await expect(page).toHaveURL(/\/requests\/RCY-[\w-]+$/);
  return new URL(page.url()).pathname.split('/').pop() as string;
}

test('a new pickup shows under the Recycling filter and its detail has the timeline', async ({ page }) => {
  await signIn(page);
  const id = await createPickup(page);

  await expect(page.getByTestId('timeline')).toBeVisible();
  await expect(page.getByTestId('timeline').locator('li')).toHaveCount(4);

  await page.goto('/requests');
  await page.getByRole('button', { name: 'تدوير' }).click();
  await expect(page.getByTestId(`request-${id}`)).toBeVisible();

  // The reports filter never shows pickups.
  await page.getByRole('button', { name: 'بلاغات' }).click();
  await expect(page.getByTestId(`request-${id}`)).toHaveCount(0);

  await page.getByRole('button', { name: 'تدوير' }).click();
  await page.getByTestId(`request-${id}`).click();
  await expect(page).toHaveURL(new RegExp(`/requests/${id}$`));
  await expect(page.getByTestId('timeline')).toBeVisible();
});

test('a requested pickup can be cancelled after an inline confirmation', async ({ page }) => {
  await signIn(page);
  await createPickup(page);

  await page.getByTestId('pickup-cancel').click();
  // Asking again is not cancelling yet: "no" keeps the pickup.
  await expect(page.getByTestId('pickup-cancel-dialog')).toBeVisible();
  await page.getByTestId('pickup-cancel-dialog').getByRole('button', { name: 'لأ' }).click();
  await expect(page.getByTestId('pickup-cancel')).toBeVisible();

  await page.getByTestId('pickup-cancel').click();
  await page.getByTestId('pickup-cancel-confirm').click();
  await expect(page.getByTestId('pickup-cancel')).toHaveCount(0);
  await expect(page.getByTestId('timeline').locator('li')).toHaveCount(2);
});

test('an unknown RCY- id shows the not-found message', async ({ page }) => {
  await signIn(page);
  await page.goto('/requests/RCY-999999');
  await expect(page.getByText('مش لاقيين الطلب ده')).toBeVisible();
});
