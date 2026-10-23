import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const API = 'http://localhost:8020';
export const ADMIN = { email: 'admin@cityfix.demo', password: 'FixCity2026!' };
export const STAFF = { email: 'roads@cityfix.demo', password: 'FixCity2026!' };

export async function login(page: Page, creds: { email: string; password: string }) {
  await page.goto('/login');
  await page.getByLabel('البريد الإلكتروني للشغل').fill(creds.email);
  await page.getByLabel('كلمة السر', { exact: true }).fill(creds.password);
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'نظرة عامة', level: 1 })).toBeVisible();
}

export async function citizenToken(request: APIRequestContext): Promise<string> {
  const phone = '01012345678';
  const otp = await request.post(`${API}/auth/otp`, { data: { phone, channel: 'sms' } });
  expect(otp.ok()).toBeTruthy();
  const res = await request.post(`${API}/auth/verify`, { data: { phone, code: '123456' } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.token ?? body.accessToken;
}

export async function apiToken(
  request: APIRequestContext,
  creds: { email: string; password: string },
): Promise<string> {
  const res = await request.post(`${API}/auth/staff-login`, { data: creds });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).token;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/**
 * Collects everything that should never happen on a healthy page: console errors, uncaught exceptions, failed
 * requests and any response from the API with status >= 400. Unlike pages.spec.ts it does NOT ignore
 * "Failed to load resource" for API URLs; it asserts on the API responses instead.
 * Third-party map tiles (OpenStreetMap) are unreachable from some sandboxes, so those are always ignored.
 */
export function watch(page: Page) {
  const problems: string[] = [];
  const isTile = (s: string) => /openstreetmap|tile\./i.test(s);
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/favicon/i.test(t) || isTile(t)) return;
    // the browser's generic "Failed to load resource" line carries no URL; the response listener below reports API ones
    if (/Failed to load resource/i.test(t)) return;
    problems.push(`console: ${t}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => {
    if (isTile(r.url()) || r.failure()?.errorText === 'net::ERR_ABORTED') return;
    problems.push(`requestfailed: ${r.method()} ${r.url()} ${r.failure()?.errorText}`);
  });
  page.on('response', (r) => {
    if (r.url().startsWith(API) && r.status() >= 400) {
      problems.push(`api ${r.status()}: ${r.request().method()} ${r.url()}`);
    }
  });
  return {
    problems,
    /** Fails when something other than the allow-listed patterns was recorded. */
    expectClean(allow: RegExp[] = []) {
      expect(problems.filter((p) => !allow.some((a) => a.test(p)))).toEqual([]);
    },
  };
}
