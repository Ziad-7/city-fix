import { expect, test } from '@playwright/test';
import { at, latestReportId, queuedCount, serverReportCount, signIn, trackGeocoder } from './helpers';

let geocoderCalls: string[];

test.beforeEach(async ({ context }) => {
  await at(context, 30.07, 31.36);
  geocoderCalls = await trackGeocoder(context);
});

async function openForm(page: import('@playwright/test').Page) {
  await signIn(page);
  await page.goto('/report/new?category=pothole');
  await expect(page.getByTestId('description-input')).toBeVisible();
}

test('a GPS fix is never sent to a street-name service: the address keeps the placeholder', async ({ page }) => {
  await openForm(page);
  await expect(page.getByTestId('address-line')).toHaveText('موقعك الحالي');
  await page.waitForTimeout(1_000); // a service call would have started by now
  expect(geocoderCalls).toEqual([]);
});

test('a report written offline is saved and goes out when the connection is back', async ({ page, context }) => {
  await openForm(page);
  // What the (mock) server holds, read from its database: no waiting for a list to finish painting.
  const before = await serverReportCount(page);

  await page.getByTestId('description-input').fill('حفرة كبيرة قدام باب المدرسة');
  await expect(page.getByText('النت ضعيف؟ البلاغ هيتحفظ ويتبعت أول ما يرجع')).toBeVisible();
  await context.setOffline(true);
  await page.getByTestId('submit-report').click();
  await expect(page.getByTestId('report-queued')).toContainText('بلاغك اتحفظ');
  await expect(page.getByTestId('outbox-banner')).toContainText('عندك بلاغ متحفظ على جهازك');
  expect(await queuedCount(page)).toBe(1);
  expect(await serverReportCount(page)).toBe(before);

  await context.setOffline(false);
  await expect(page.getByTestId('report-queued')).toContainText('بلاغك اتبعت');
  await expect(page.getByTestId('outbox-banner')).toBeHidden();
  expect(await queuedCount(page)).toBe(0);
  await expect.poll(() => serverReportCount(page)).toBe(before + 1);

  // The new report is listed under my requests: look for that very report, not for a row count.
  const id = await latestReportId(page);
  await page.getByRole('link', { name: 'طلباتي' }).first().click();
  await expect(page.getByRole('heading', { name: 'طلباتي', level: 1 })).toBeVisible();
  await expect(page.getByTestId(`request-${id}`)).toBeVisible({ timeout: 15_000 });
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
