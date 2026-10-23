import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { API, ADMIN, STAFF, login, citizenToken, apiToken, bearer, watch } from './helpers';

/**
 * Feature matrix for admin-web (admin + department staff) against the real local backend.
 * Evidence for docs/feature-verification.md. Screenshots go to test-results/matrix/ (not committed).
 * IDs are discovered through the API; only the demo-seed IDs seed_db always creates are hard-coded
 * (COL-1, COL-2, INC-501).
 */
const SHOTS = process.env.MATRIX_SHOTS ?? 'test-results/matrix';
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

let admin = '';
const H = () => bearer(admin);

async function getJson(request: APIRequestContext, path: string, token = admin) {
  const res = await request.get(`${API}${path}`, { headers: bearer(token) });
  expect(res.ok(), `${path} -> ${res.status()}`).toBeTruthy();
  return res.json();
}

test.describe.serial('feature matrix', () => {
  test.beforeAll(async ({ request }) => {
    admin = await apiToken(request, ADMIN);
    const reset = await request.post(`${API}/admin/demo/reset`, { headers: H() });
    expect(reset.ok()).toBeTruthy();
    admin = await apiToken(request, ADMIN); // the reset recreates accounts
  });

  test('1. admin login, overview KPIs and AI insight card', async ({ page }) => {
    const w = watch(page);
    await login(page, ADMIN);
    await expect(page.getByText('بلاغات مفتوحة', { exact: true })).toBeVisible();
    await expect(page.getByText('اقتراح الذكاء الاصطناعي')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'الشغل على كل جهة' })).toBeVisible();
    await page.getByRole('button', { name: 'النهارده', exact: true }).click();
    await page.getByRole('button', { name: 'الشهر', exact: true }).click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await shot(page, '01-overview');
    w.expectClean();
  });

  test('2. incidents: filters, search, view chips, sort, 100-row cap', async ({ page }) => {
    const w = watch(page);
    await login(page, ADMIN);
    await page.goto('/incidents');
    const rows = page.locator('table.inc-table tbody tr');
    await expect(rows.first()).toBeVisible();
    const open = await rows.count();
    expect(open).toBeLessThanOrEqual(100); // the page caps the table at 100 rows (no server pagination)
    if (open === 100) await expect(page.getByText('بنعرض أول 100 بلاغ')).toBeVisible(); // large seed: cap notice

    await page.locator('#status-select').selectOption('all');
    await expect.poll(() => rows.count()).toBeGreaterThanOrEqual(open);
    await page.locator('#status-select').selectOption('resolved');
    await expect(rows.first()).toBeVisible();
    await expect(page.locator('table.inc-table tbody')).toContainText('اتصلّح');
    await page.locator('#status-select').selectOption('open');

    await page.locator('#category-select').selectOption('pothole');
    // default seed: fewer rows; large seed: both lists hit the 100-row cap, so only "not more" holds
    await expect.poll(() => rows.count()).toBeLessThanOrEqual(open);
    await page.locator('#category-select').selectOption('');

    await page.getByRole('textbox', { name: 'ابحث برقم البلاغ أو الشارع' }).fill('INC-502');
    await expect.poll(() => rows.count()).toBe(1);
    await page.getByRole('textbox', { name: 'ابحث برقم البلاغ أو الشارع' }).fill('');

    for (const chip of ['أولوية عالية', 'خطر', 'متأخرة', 'في خطة الميزانية']) {
      await page.getByRole('button', { name: chip, exact: true }).click();
      await expect(page.getByRole('button', { name: chip, exact: true })).toHaveAttribute('aria-pressed', 'true');
      await page.waitForLoadState('networkidle').catch(() => {});
    }
    await page.getByRole('button', { name: 'كل البلاغات', exact: true }).click();

    const first = async () => (await rows.first().locator('a.ttl').getAttribute('href')) ?? '';
    const byPriority = await first();
    await page.getByRole('button', { name: 'الأولوية', exact: true }).click();
    await expect.poll(first).not.toBe(byPriority);
    await shot(page, '02-incidents');
    w.expectClean();
  });

  test('3. duplicates: two nearby reports, DuplicateCard, merge', async ({ page, request }) => {
    const w = watch(page);
    const token = await citizenToken(request);
    const make = async (lat: number) => {
      const res = await request.post(`${API}/reports`, {
        headers: bearer(token),
        data: {
          categoryId: 'garbage',
          description: `زبالة متراكمة جنب المدرسة ${Date.now()}`,
          photoUris: [],
          location: { lat, lng: 31.3612, address: 'شارع الاختبار المكرر، مدينة نصر' },
          anonymous: false,
          blurFaces: false,
        },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
      return (await res.json()).incident.id as string;
    };
    const older = await make(30.0911);
    const newer = await make(30.09128); // about 20 m away; a new report without linkToIncidentId is a new incident
    expect(newer).not.toBe(older);

    await login(page, ADMIN);
    await page.goto(`/incidents/${newer}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(older).first()).toBeVisible();
    await shot(page, '03-duplicate-card');
    await page.getByRole('button', { name: /ادمجهم/ }).click();
    await expect(page.getByRole('dialog').getByText('تأكيد دمج البلاغات')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'أكّد الدمج' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // exactly one of the two is closed (the source); the other (target) now carries both reports
    await expect
      .poll(async () => {
        const statuses = await Promise.all(
          [older, newer].map(async (id) => (await getJson(request, `/admin/incidents/${id}`)).status as string),
        );
        return statuses.filter((s) => s === 'closed').length;
      })
      .toBe(1);
    const both = await Promise.all([older, newer].map((id) => getJson(request, `/admin/incidents/${id}`)));
    const target = both.find((i) => i.status !== 'closed');
    expect(target.linkedReportIds.length).toBe(2);
    w.expectClean();
  });

  test('4. work orders: department filter, drawer, move to in_progress with a note', async ({ page, request }) => {
    const w = watch(page);
    await login(page, ADMIN);
    await page.goto('/work-orders');
    const cards = page.locator('.wo');
    await expect(cards.first()).toBeVisible();
    const total = await cards.count();
    await page.getByRole('button', { name: 'صيانة الطرق', exact: true }).click();
    await expect.poll(() => cards.count()).toBeLessThan(total);
    await page.getByRole('button', { name: 'الكل', exact: true }).click();

    // an "open"/"assigned" internal work order, found through the API
    const orders = (await getJson(request, '/admin/work-orders')) as { id: string; status: string; external?: boolean; incidentId?: string }[];
    const target = orders.find((o) => (o.status === 'open' || o.status === 'assigned') && !o.external && !!o.incidentId);
    expect(target, 'no movable work order in the seed').toBeTruthy();
    await page.locator('.wo', { hasText: target!.id }).first().click({ position: { x: 8, y: 8 } });
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await drawer.getByLabel('الحالة الجديدة').selectOption('in_progress');
    await drawer.getByLabel('رسالة للمواطنين').fill(`بدأ التنفيذ ${Date.now()}`);
    await drawer.getByRole('button', { name: /حدّث الحالة/ }).click();
    await expect(page.getByText('اتحدّثت الحالة.').first()).toBeVisible();
    await expect
      .poll(async () => (await getJson(request, `/admin/work-orders/${target!.id}`)).status)
      .toBe('in_progress');
    await shot(page, '04-work-orders');
    w.expectClean();
  });

  test('5. service requests: select, reschedule, send message, status filter', async ({ page, request }) => {
    const w = watch(page);
    await login(page, ADMIN);
    await page.goto('/service-requests');
    await expect(page.getByRole('heading', { name: 'طلبات الخدمات', level: 1 })).toBeVisible();
    await page.locator('#sr-status').selectOption('received');
    await page.locator('#sr-status').selectOption('');
    const row = page.locator('table tbody tr').first();
    await expect(row).toBeVisible();
    await row.click();
    await page.getByRole('button', { name: 'ابعت رسالة للمواطن' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('رسالة للمواطن').fill(`رسالة اختبار ${Date.now()}`);
    await dialog.getByRole('button').filter({ hasText: /ابعت|إرسال/ }).last().click();
    await expect(page.getByText(/اتبعتت|اتبعت|اتحدّث/).first()).toBeVisible();
    await shot(page, '05-service-requests');
    w.expectClean();
    const list = await getJson(request, '/admin/service-requests');
    expect(list.length).toBeGreaterThan(0);
  });

  test('6. budget: slider, plan KPIs, commit, API latency', async ({ page, request }) => {
    const w = watch(page);
    const timings: number[] = [];
    page.on('response', async (r) => {
      if (r.url().endsWith('/admin/budget/optimize')) timings.push(r.request().timing().responseEnd);
    });
    await login(page, ADMIN);
    await page.goto('/budget');
    await expect(page.getByText('تكلفة الخطة', { exact: true })).toBeVisible();
    const slider = page.getByRole('slider');
    await slider.focus();
    const wait = page.waitForResponse((r) => r.url().endsWith('/admin/budget/optimize'));
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    const resp = await wait;
    expect(resp.status()).toBe(200);
    await page.getByRole('button', { name: 'حوّل الخطة لأوامر شغل' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'حوّل الخطة', exact: true }).click();
    await expect(page.getByText(/اتعمل .* أمر شغل من الخطة/).first()).toBeVisible();
    await shot(page, '06-budget');
    w.expectClean();
    // direct latency probe (the numbers belong in the doc, not as a flaky UI assertion)
    const t0 = Date.now();
    const direct = await request.post(`${API}/admin/budget/optimize`, { headers: H(), data: { budgetEgp: 300000 } });
    const ms = Date.now() - t0;
    expect(direct.ok()).toBeTruthy();
    console.log(`BUDGET_OPTIMIZE_MS=${ms}`);
    expect(ms).toBeLessThan(2000);
  });

  test('7. map: leaflet, hotspots toggle, period filter', async ({ page }) => {
    const w = watch(page);
    await login(page, ADMIN);
    await page.goto('/map');
    await expect(page.locator('.leaflet-container').first()).toBeVisible();
    const hot = page.waitForResponse((r) => r.url().includes('/admin/hotspots'));
    await page.getByRole('button', { name: /بؤر رمي المخلفات/ }).click();
    expect((await hot).status()).toBe(200);
    await page.locator('#map-period').selectOption('today');
    await page.locator('#map-period').selectOption('30d');
    await page.waitForLoadState('networkidle').catch(() => {});
    await shot(page, '07-map');
    w.expectClean();
  });

  test('8. bins: register, device key, device reading, full state, bad key 401', async ({ page, request }) => {
    const w = watch(page);
    const id = `BIN-E2E-${Date.now()}`;
    await login(page, ADMIN);
    await page.goto('/bins');
    await page.getByRole('button', { name: 'تسجيل حاوية' }).click();
    await page.getByLabel('رقم الجهاز').fill(id);
    await page.getByLabel('اسم الحاوية').fill('حاوية اختبار');
    await page.getByLabel('خط العرض').fill('30.0561');
    await page.getByLabel('خط الطول').fill('31.3305');
    await page.getByLabel('جهاز محاكاة').check();
    await page.getByRole('dialog').getByRole('button').filter({ hasText: /تسجيل|حفظ/ }).last().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('مفتاح الجهاز')).toBeVisible();
    const key = (await dialog.locator('code').innerText()).trim();
    expect(key.length).toBeGreaterThan(16);
    await dialog.getByLabel('نسخت المفتاح').check();
    await dialog.getByRole('button', { name: 'تم', exact: true }).click();

    const now = Date.now();
    const iso = (min: number) => new Date(now - min * 60_000).toISOString();
    const readings = [
      { seq: 1, at: iso(125), fillPct: 40.0, tempC: 30.0, batteryV: 3.9 },
      { seq: 2, at: iso(65), fillPct: 70.0, tempC: 30.0, batteryV: 3.9 },
      { seq: 3, at: iso(5), fillPct: 95.0, tempC: 31.0, batteryV: 3.9 },
    ];
    const bad = await request.post(`${API}/iot/bins/${id}/readings`, {
      headers: { 'X-Device-Key': 'wrong-key' },
      data: { readings },
    });
    expect(bad.status()).toBe(401);
    const ok = await request.post(`${API}/iot/bins/${id}/readings`, { headers: { 'X-Device-Key': key }, data: { readings } });
    expect(ok.status()).toBe(202);

    await page.getByRole('button', { name: 'تحديث', exact: true }).click();
    const row = page.getByRole('button', { name: new RegExp(id) });
    await expect(row).toBeVisible();
    await expect(row).toContainText('ممتلئة');
    await shot(page, '08-bins');
    // 401 above is the device probe made through `request` (not the page), so the page itself stays clean
    w.expectClean();
  });

  test('9. citycycle tabs: pickups, collectors, prices, routes, payouts, bin alerts, impact', async ({
    page,
    request,
  }) => {
    const w = watch(page);
    await login(page, ADMIN);
    await page.goto('/citycycle');
    await expect(page.getByRole('heading', { name: 'إعادة التدوير', level: 1 })).toBeVisible();
    // no in-memory demo banner: the page must be talking to the real backend
    await expect(page.getByText(/البيانات هنا تجريبية/)).toHaveCount(0);

    // الطلبات: admin cancels one requested pickup
    const requested = ((await getJson(request, '/admin/recycling/pickups?status=requested')) as { id: string }[]);
    expect(requested.length).toBeGreaterThan(1);
    await expect(page.getByRole('button', { name: 'إلغاء', exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'إلغاء', exact: true }).first().click();
    const confirm = page.getByRole('dialog');
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.getByRole('button', { name: /تأكيد|إلغاء الطلب|أيوه/ }).last().click();
    }
    await expect
      .poll(async () => ((await getJson(request, '/admin/recycling/pickups?status=cancelled')) as unknown[]).length)
      .toBeGreaterThan(0);
    await shot(page, '09a-citycycle-pickups');

    // الجامعون: verify one pending collector, then suspend it (the large seed has many collectors, so the row is
    // picked by its button, and the effect is checked through the API as a status-count change)
    await page.getByRole('tab', { name: 'الجامعون' }).click();
    const statusCount = async (status: string) =>
      ((await getJson(request, '/admin/collectors')) as { status: string }[]).filter((c) => c.status === status).length;
    const rows = page.getByRole('region', { name: 'الجامعون' }).locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    const idx = await rows.evaluateAll((trs) =>
      trs.findIndex((tr) => [...tr.querySelectorAll('button')].some((b) => b.textContent === 'توثيق')),
    );
    expect(idx, 'no unverified collector to act on').toBeGreaterThanOrEqual(0);
    const verifiedBefore = await statusCount('verified');
    const suspendedBefore = await statusCount('suspended');
    await rows.nth(idx).getByRole('button', { name: 'توثيق' }).click();
    await expect.poll(() => statusCount('verified')).toBe(verifiedBefore + 1);
    await rows.nth(idx).getByRole('button', { name: 'إيقاف' }).click();
    await expect.poll(() => statusCount('suspended')).toBe(suspendedBefore + 1);
    await shot(page, '09b-citycycle-collectors');

    // الأسعار: edit one price and save
    await page.getByRole('tab', { name: 'الأسعار' }).click();
    const price = page.getByRole('textbox').first();
    await price.fill('6.5');
    await page.getByRole('button', { name: 'حفظ الأسعار' }).click();
    await expect
      .poll(async () => ((await getJson(request, '/admin/material-prices')) as { priceEgpPerKg: number | null }[]).some((p) => p.priceEgpPerKg === 6.5))
      .toBe(true);
    await shot(page, '09c-citycycle-prices');

    // مسارات الجمع: select requested pickups, run the optimiser (~3 s by design)
    await page.getByRole('tab', { name: 'مسارات الجمع' }).click();
    await page.getByRole('button', { name: 'وسط الطلبات المختارة' }).click();
    await page.getByLabel('سعة المركبة (كجم)').fill('500');
    const run = page.getByRole('button', { name: 'اقترح المسارات' });
    await expect(run).toBeEnabled();
    const routes = page.waitForResponse((r) => r.url().includes('/routes/optimize'), { timeout: 30_000 });
    await run.click();
    expect((await routes).status()).toBe(200);
    await expect(page.getByText('إجمالي المسافة')).toBeVisible();
    await shot(page, '09d-citycycle-routes');

    // مستحقات الجامعين: date filter
    await page.getByRole('tab', { name: 'مستحقات الجامعين' }).click();
    await page.getByLabel('من تاريخ').fill('2020-01-01');
    await page.getByLabel('لحد تاريخ').fill('2099-12-31');
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByRole('region', { name: 'مستحقات الجامعين' })).toBeVisible();
    await shot(page, '09e-citycycle-payouts');

    await page.getByRole('tab', { name: 'تنبيهات الحاويات' }).click();
    await expect(page.getByRole('region', { name: 'تنبيهات الحاويات' })).toBeVisible();
    await page.getByRole('tab', { name: 'الأثر' }).click();
    await expect(page.getByRole('region', { name: 'الأثر' })).toBeVisible();
    await shot(page, '09f-citycycle-impact');
    w.expectClean();
  });

  test('10. department staff (roads): scoped incidents, no routes tab, no collector writes, budget blocked', async ({
    page,
    request,
  }) => {
    const w = watch(page);
    const staffToken = await apiToken(request, STAFF);
    expect((await request.patch(`${API}/admin/collectors/COL-2`, { headers: bearer(staffToken), data: { status: 'verified' } })).status()).toBe(403);

    await login(page, STAFF);
    await page.goto('/incidents');
    const body = (await getJson(request, '/admin/incidents', staffToken)) as { department: string }[];
    await expect(page.locator('table.inc-table tbody tr').first()).toBeVisible();
    expect(body.length).toBeGreaterThan(0);
    expect(new Set(body.map((i) => i.department))).toEqual(new Set(['صيانة الطرق']));
    await shot(page, '10a-staff-incidents');

    await page.goto('/citycycle');
    await expect(page.getByRole('heading', { name: 'إعادة التدوير', level: 1 })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'مسارات الجمع' })).toHaveCount(0);
    await page.getByRole('tab', { name: 'الجامعون' }).click();
    await expect(page.getByRole('region', { name: 'الجامعون' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'توثيق' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'إيقاف' })).toHaveCount(0);
    await shot(page, '10b-staff-citycycle');

    await page.goto('/budget');
    await page.waitForLoadState('networkidle').catch(() => {});
    await shot(page, '10c-staff-budget');
    await expect(page.getByRole('button', { name: 'حوّل الخطة لأوامر شغل' })).toHaveCount(0);
    // the budget page is admin-only and must not fire any API call for staff, so nothing may have failed
    w.expectClean();
  });
});
