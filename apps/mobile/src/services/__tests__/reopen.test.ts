import { createMockServices } from '../mock';
import { resetMockDb } from '../mock/db';
import { DEMO_USER_ID } from '../mock/seed';

describe('reopenIncident (mock)', () => {
  beforeEach(async () => {
    await resetMockDb();
  });

  it('only works on a resolved incident', async () => {
    const s = createMockServices();
    const open = (await s.incidents.listIncidents()).find((i) => i.status === 'assigned')!;
    await expect(s.incidents.reopenIncident(DEMO_USER_ID, open.id, 'لسه')).rejects.toThrow();
    await expect(s.incidents.reopenIncident(DEMO_USER_ID, 'INC-nope', 'لسه')).rejects.toThrow();
  });

  it('goes back to received with a citizen timeline entry and a fresh eta', async () => {
    const s = createMockServices();
    const [report] = await s.incidents.listMyReports(DEMO_USER_ID);
    let inc = (await s.incidents.getIncident(report.incidentId))!;
    while (inc.status !== 'resolved') inc = await s.incidents.simulateProgress(inc.id);
    expect(inc.eta).toBeUndefined();

    const before = inc.updatedAt;
    const reopened = await s.incidents.reopenIncident(DEMO_USER_ID, inc.id, 'الحفرة رجعت');
    expect(reopened.status).toBe('received');
    expect(reopened.eta).toBe('خلال ٣ أيام');
    expect(reopened.updatedAt >= before).toBe(true);
    const last = reopened.timeline[reopened.timeline.length - 1];
    expect(last).toMatchObject({ status: 'received', actor: 'مواطن', note: 'اتفتح تاني: الحفرة رجعت' });
    expect((await s.incidents.getIncident(inc.id))?.status).toBe('received');
  });

  it('tree maintenance bookings get tree timeline titles', async () => {
    const s = createMockServices();
    const req = await s.serviceRequests.book(DEMO_USER_ID, {
      serviceType: 'tree_maintenance',
      details: { items: ['تقليم'], workType: 'تقليم', day: '2026-10-25', slot: 'morning' },
      location: { lat: 30.05, lng: 31.33, address: 'شارع تجريبي' },
    });
    expect(req.timeline[0].note).toContain('الشجرة');
    expect(req.details.payment).toBeUndefined();
  });
});
