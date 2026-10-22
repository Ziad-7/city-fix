import { test, expect, type Page } from '@playwright/test';
import { ADMIN, login } from './helpers';

const arDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

async function planCost(page: Page): Promise<number> {
  const kpi = page.locator('.kpis').getByText('تكلفة الخطة', { exact: true }).locator('..');
  const text = arDigits(await kpi.innerText()).replace(/[٬,]/g, '');
  const m = text
    .split('\n')
    .map((l) => l.match(/\d+/))
    .find(Boolean);
  return m ? Number(m[0]) : Number.NaN;
}

test('budget plan renders, respects budget, commits to work orders', async ({ page }) => {
  await login(page, ADMIN);

  await page.goto('/work-orders');
  await expect(page.getByRole('heading', { name: 'أوامر الشغل', level: 1 })).toBeVisible();
  const cards = page.locator('.wo');
  await expect(cards.first()).toBeVisible();
  const before = await cards.count();

  await page.goto('/budget');
  await expect(page.getByRole('heading', { name: 'ميزانية الإصلاحات' })).toBeVisible();
  await expect(page.getByText('تكلفة الخطة', { exact: true })).toBeVisible();
  expect(await planCost(page)).toBeLessThanOrEqual(300000);

  await page.getByRole('button', { name: /تقشّف/ }).click();
  await expect(page.getByRole('button', { name: /تقشّف/ })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => planCost(page)).toBeLessThanOrEqual(150000);

  await page.getByLabel('الميزانية المتاحة').fill('100000');
  await expect.poll(() => planCost(page)).toBeLessThanOrEqual(100000);

  await page.getByRole('button', { name: /الميزانية الحالية/ }).click();
  await expect.poll(() => planCost(page)).toBeLessThanOrEqual(300000);
  const commit = page.getByRole('button', { name: 'حوّل الخطة لأوامر شغل' });
  await expect(commit).toBeEnabled();
  await commit.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'حوّل الخطة', exact: true }).click();
  await expect(page.getByText(/اتعمل .* أمر شغل من الخطة/).first()).toBeVisible();

  await expect(page).toHaveURL(/\/work-orders/);
  await expect.poll(() => page.locator('.wo').count()).toBeGreaterThan(before);
});
