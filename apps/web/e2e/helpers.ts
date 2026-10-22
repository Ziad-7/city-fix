import { expect, type BrowserContext, type Page } from '@playwright/test';

/** Pretend the browser is at a point (GPS granted). */
export async function at(context: BrowserContext, lat: number, lng: number) {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: lat, longitude: lng });
}

/**
 * Records every request that goes to a public street-name service. The citizen's GPS fix must never leave for one
 * (W18): the list stays empty, and the requests are blocked anyway so a regression cannot slow a test down.
 */
export async function trackGeocoder(context: BrowserContext): Promise<string[]> {
  const seen: string[] = [];
  await context.route(/nominatim|geocod/i, (route) => {
    seen.push(route.request().url());
    return route.abort();
  });
  return seen;
}

/** Signs in with the demo account (mock mode: any phone, code 123456). */
export async function signIn(page: Page, next = '/') {
  await page.goto(next === '/' ? '/sign-in' : `/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByTestId('phone-input').fill('01012345678');
  await page.getByTestId('sign-in-submit').click();
  await expect(page.getByRole('heading', { name: 'اكتب الكود' })).toBeVisible();
  // Typing the 6th digit submits, like the app.
  await page.getByTestId('otp-0').fill('123456');
  await page.waitForURL((u) => !u.pathname.startsWith('/sign-in'));
}

/**
 * Counts how many reports this tab creates in the mock "server" (the mock database in localStorage), so a test can
 * tell a report that was sent once from one that was sent twice. Call on the context before any page opens;
 * read the number with `reportCreates(page)`.
 */
export async function countReportCreates(context: BrowserContext) {
  await context.addInitScript(() => {
    const w = window as unknown as { __creates: number };
    w.__creates = 0;
    const count = (raw: string | null) => {
      try {
        return raw ? (JSON.parse(raw) as { reports: unknown[] }).reports.length : null;
      } catch {
        return null;
      }
    };
    let last = count(localStorage.getItem('ftc.mock.db.v1'));
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === 'ftc.mock.db.v1') {
        const n = count(value);
        if (n !== null) {
          if (last !== null && n > last) w.__creates += n - last;
          last = n;
        }
      }
      return original.call(this, key, value);
    };
  });
}

export const reportCreates = (page: Page) => page.evaluate(() => (window as unknown as { __creates: number }).__creates);

/**
 * Waits until the mock "server" exists. Its database is created lazily (seeded with the demo report) by the first
 * service call, so before that `serverReportCount` reads 0 and, once the page seeds it, jumps to 1 on its own:
 * a "before" taken too early looks like a report that was sent. Take baselines after this.
 */
export const mockServerSeeded = (page: Page) =>
  expect.poll(() => page.evaluate(() => localStorage.getItem('ftc.mock.db.v1') !== null), { message: 'the mock server is seeded' }).toBe(true);

/** Number of reports in the mock "server" right now. */
export const serverReportCount = (page: Page) =>
  page.evaluate(() => (JSON.parse(localStorage.getItem('ftc.mock.db.v1') ?? '{"reports":[]}') as { reports: unknown[] }).reports.length);

/** Id of the newest report in the mock "server". */
export const latestReportId = (page: Page) =>
  page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('ftc.mock.db.v1') ?? '{"reports":[]}') as { reports: { id: string; createdAt: string }[] };
    return [...db.reports].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1)?.id ?? '';
  });

/** Reports waiting in the offline queue (what is saved in localStorage). */
export const queuedCount = (page: Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('ftc.outbox.v1');
    return raw ? (JSON.parse(raw) as { state: { items: unknown[] } }).state.items.length : 0;
  });

export const mainNav =(page: Page) => page.getByRole('navigation', { name: 'التنقل الرئيسي' }).locator('visible=true').first();
