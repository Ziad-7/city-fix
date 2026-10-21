import { expect, test } from '@playwright/test';
import { at, noGeocoder, signIn } from './helpers';

test.beforeEach(async ({ context }) => {
  await at(context, 30.07, 31.36);
  await noGeocoder(context);
});

async function openForm(page: import('@playwright/test').Page) {
  await signIn(page);
  await page.goto('/report/new?category=pothole');
  await expect(page.getByTestId('description-input')).toBeVisible();
}

test('a GPS fix fills in the street name', async ({ page }) => {
  await page.route('**/nominatim.openstreetmap.org/reverse**', (route) =>
    route.fulfill({ json: { address: { road: 'شارع عباس العقاد', suburb: 'مدينة نصر' } } }),
  );
  await openForm(page);
  await expect(page.getByTestId('address-line')).toHaveText('شارع عباس العقاد، مدينة نصر');
});

test('a report written offline is saved and goes out when the connection is back', async ({ page, context }) => {
  await openForm(page);
  await page.goto('/requests');
  const rows = page.locator('[data-testid^="request-FTC-"]');
  await expect(rows.first()).toBeVisible();
  const before = await rows.count();

  await page.goto('/report/new?category=pothole');
  await page.getByTestId('description-input').fill('حفرة كبيرة قدام باب المدرسة');
  await expect(page.getByText('النت ضعيف؟ البلاغ هيتحفظ ويتبعت أول ما يرجع')).toBeVisible();
  await context.setOffline(true);
  await page.getByTestId('submit-report').click();
  await expect(page.getByTestId('report-queued')).toContainText('بلاغك اتحفظ');
  await expect(page.getByTestId('outbox-banner')).toContainText('عندك بلاغ متحفظ على جهازك');

  await context.setOffline(false);
  await expect(page.getByTestId('report-queued')).toContainText('بلاغك اتبعت');
  await expect(page.getByTestId('outbox-banner')).toBeHidden();

  await page.getByRole('link', { name: 'طلباتي' }).first().click();
  await expect(rows).toHaveCount(before + 1);
});

test('speaking adds the words to the description', async ({ page }) => {
  // Stand-in for the browser's speech recognition: hears one sentence, then ends.
  await page.addInitScript(() => {
    class FakeRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        setTimeout(() => {
          const result = Object.assign([{ transcript: 'فيه حفرة كبيرة في نص الشارع' }], { isFinal: true });
          this.onresult?.({ resultIndex: 0, results: [result] });
          this.onend?.();
        }, 200);
      }
      stop() {}
      abort() {}
    }
    const w = window as unknown as Record<string, unknown>;
    delete w.SpeechRecognition;
    w.webkitSpeechRecognition = FakeRecognition;
  });
  await openForm(page);
  await page.getByTestId('description-input').fill('بص:');
  await page.getByTestId('voice-button').click();
  await expect(page.getByTestId('description-input')).toHaveValue('بص: فيه حفرة كبيرة في نص الشارع');
  await expect(page.getByTestId('ai-suggestion')).toBeVisible();
});
