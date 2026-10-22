import { test, expect, type Page } from '@playwright/test';
import { ADMIN, login } from './helpers';

const routes: { path: string; ready: (page: Page) => Promise<void> }[] = [
  { path: '/', ready: (p) => expect(p.getByRole('heading', { name: 'نظرة عامة', level: 1 })).toBeVisible() },
  { path: '/incidents', ready: (p) => expect(p.getByRole('heading', { name: 'قائمة البلاغات' })).toBeVisible() },
  { path: '/incidents/INC-501', ready: (p) => expect(p.getByRole('heading', { level: 1 })).toBeVisible() },
  { path: '/map', ready: (p) => expect(p.locator('.leaflet-container').first()).toBeVisible() },
  { path: '/service-requests', ready: (p) => expect(p.locator('.page h1').first()).toBeVisible() },
  { path: '/work-orders', ready: (p) => expect(p.getByRole('heading', { name: 'أوامر الشغل', level: 1 })).toBeVisible() },
  { path: '/budget', ready: (p) => expect(p.getByRole('heading', { name: 'ميزانية الإصلاحات' })).toBeVisible() },
];

test.describe('page smoke', () => {
  for (const { path, ready } of routes) {
    test(`${path} loads without console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        const t = m.text();
        if (/favicon|net::ERR|Failed to load resource/i.test(t)) return;
        errors.push(t);
      });
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

      await login(page, ADMIN);
      await page.goto(path);
      await ready(page);
      await page.waitForLoadState('networkidle').catch(() => {});
      expect(errors).toEqual([]);
    });
  }
});
