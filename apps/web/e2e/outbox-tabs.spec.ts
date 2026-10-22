import { expect, test, type Page } from '@playwright/test';
import { at, countReportCreates, queuedCount, reportCreates, serverReportCount, signIn, trackGeocoder } from './helpers';

// The offline queue lives in localStorage, shared by every tab of the browser. These tests open two tabs of one
// browser context (one localStorage) and check that they do not step on each other (review finding W3).

test.beforeEach(async ({ context }) => {
  await at(context, 30.07, 31.36);
  await trackGeocoder(context);
  await countReportCreates(context);
});

async function writeReport(tab: Page, text: string) {
  await tab.getByTestId('description-input').fill(text);
  await tab.getByTestId('submit-report').click();
  await expect(tab.getByTestId('report-queued')).toContainText('بلاغك اتحفظ');
}

test('two tabs queue a report each while offline: both are kept and both go out', async ({ page, context }) => {
  await signIn(page);
  await page.goto('/report/new?category=pothole');
  await expect.poll(() => serverReportCount(page)).toBeGreaterThan(0); // the mock server is seeded before a second tab opens
  const other = await context.newPage();
  await other.goto('/report/new?category=pothole');
  await expect(page.getByTestId('description-input')).toBeVisible();
  await expect(other.getByTestId('description-input')).toBeVisible();
  const before = await serverReportCount(page);

  await context.setOffline(true);
  await writeReport(page, 'حفرة كبيرة قدام باب المدرسة');
  // This tab was opened before the first report was queued: without the fix its write replaced the queue.
  await writeReport(other, 'حفرة تانية جنب الحديقة');
  expect(await queuedCount(other)).toBe(2);

  await page.close(); // the tab that queued the first report goes away
  await context.setOffline(false);
  await expect.poll(() => queuedCount(other)).toBe(0);
  await expect.poll(() => serverReportCount(other)).toBe(before + 2);
  expect(await reportCreates(other)).toBe(2);
});

test('a report queued in one tab is sent once even though two tabs see it', async ({ page, context }) => {
  await signIn(page);
  await page.goto('/report/new?category=pothole');
  await expect.poll(() => serverReportCount(page)).toBeGreaterThan(0); // the mock server is seeded before a second tab opens
  const other = await context.newPage();
  await other.goto('/requests');
  await expect(other.getByRole('heading', { name: 'طلباتي', level: 1 })).toBeVisible();
  await expect(page.getByTestId('description-input')).toBeVisible();
  const before = await serverReportCount(page);

  await context.setOffline(true);
  await writeReport(page, 'حفرة كبيرة قدام باب المدرسة');
  // The other tab learns about it (storage event) and shows the banner too.
  await expect(other.getByTestId('outbox-banner')).toContainText('عندك بلاغ متحفظ على جهازك');

  await context.setOffline(false); // both tabs get "online" and try to send
  await expect.poll(() => queuedCount(page)).toBe(0);
  await expect(other.getByTestId('outbox-banner')).toBeHidden();
  await page.waitForTimeout(500); // a duplicate send would have happened by now
  expect((await reportCreates(page)) + (await reportCreates(other))).toBe(1);
  expect(await serverReportCount(page)).toBe(before + 1);
});
