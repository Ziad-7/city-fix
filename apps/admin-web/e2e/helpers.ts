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
