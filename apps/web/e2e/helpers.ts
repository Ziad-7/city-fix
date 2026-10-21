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

export const mainNav = (page: Page) => page.getByRole('navigation', { name: 'التنقل الرئيسي' }).locator('visible=true').first();
