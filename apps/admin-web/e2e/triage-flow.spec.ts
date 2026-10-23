import { test, expect } from '@playwright/test';
import { API, ADMIN, login, citizenToken } from './helpers';

test('triage round trip: confirm AI, work order, status change with note, citizen sees note', async ({
  page,
  request,
}) => {
  await login(page, ADMIN);
  await page.goto('/incidents');

  const firstLink = page.locator('table.inc-table tbody tr', { hasNotText: 'جاري التنفيذ' }).locator('a.ttl').first();
  await expect(firstLink).toBeVisible();
  await firstLink.click();
  await expect(page).toHaveURL(/\/incidents\/INC-[A-Z0-9-]+/);
  const id = page.url().match(/INC-[A-Z0-9-]+/)![0];
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // AI suggestion: confirm if present and unconfirmed
  const confirmBtn = page.getByRole('button', { name: 'أكّد التصنيف' });
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click();
    await expect(page.getByText('اتأكّد التصنيف.').first()).toBeVisible();
  }

  // Work order: create if none (department prefilled)
  const createWo = page.getByRole('button', { name: 'أنشئ أمر شغل' });
  if (await createWo.isVisible().catch(() => false)) {
    await expect(page.getByLabel('الجهة')).not.toHaveValue('');
    await createWo.click();
    await expect(page.getByText(/اتعمل أمر الشغل WO-\d+/).first()).toBeVisible();
  }

  // Status change: blocked without note
  const submit = page.getByRole('button', { name: 'حدّث الحالة وابلّغ المواطنين' });
  const statusSelect = page.getByLabel('الحالة الجديدة');
  await statusSelect.selectOption({ label: 'جاري التنفيذ' });
  await submit.click();
  await expect(page.getByText('اكتب رسالة للمواطنين').first()).toBeVisible();

  const note = `الفريق وصل الموقع ${Date.now()}`;
  await page.getByLabel('رسالة للمواطنين').fill(note);
  await submit.click();
  await expect(page.getByText('اتحدّثت الحالة.').first()).toBeVisible();

  // Citizen sees the note on the timeline
  const token = await citizenToken(request);
  const res = await request.get(`${API}/incidents/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe('in_progress');
  expect(body.timeline.at(-1).note).toBe(note);
});
