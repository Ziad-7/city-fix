import { resetMockDb } from '../mock/db';
import { createMockServices } from '../mock';
import type { NewReportInput } from '@/domain/types';
import { DEMO_USER_ID } from '../mock/seed';

const input = (over: Partial<NewReportInput> = {}): NewReportInput => ({
  categoryId: 'garbage',
  description: 'زبالة متراكمة قدام العمارة',
  photoUris: [],
  location: { lat: 30.07, lng: 31.36, address: 'شارع تجريبي، مدينة نصر' },
  anonymous: false,
  blurFaces: true,
  ...over,
});

describe('mock services', () => {
  beforeEach(async () => {
    await resetMockDb();
  });

  it('seeds incidents around Nasr City, one demo report and one service request', async () => {
    const s = createMockServices();
    const incidents = await s.incidents.listIncidents();
    expect(incidents.length).toBeGreaterThanOrEqual(8);
    incidents.forEach((i) => {
      expect(Math.abs(i.location.lat - 30.056)).toBeLessThan(0.02);
      expect(Math.abs(i.location.lng - 31.33)).toBeLessThan(0.02);
    });
    expect(new Set(incidents.map((i) => i.status)).size).toBeGreaterThan(3);
    expect(await s.incidents.listMyReports(DEMO_USER_ID)).toHaveLength(1);
    expect(await s.serviceRequests.listMine(DEMO_USER_ID)).toHaveLength(1);
  });

  it('submit report -> listed first with status received', async () => {
    const s = createMockServices();
    const { report, incident } = await s.incidents.submitReport(DEMO_USER_ID, input());
    expect(report.id).toMatch(/^FTC-\d{4}$/);
    expect(incident.status).toBe('received');
    expect(incident.timeline[0].status).toBe('received');
    expect(incident.priority.score).toBeGreaterThan(0);
    const mine = await s.incidents.listMyReports(DEMO_USER_ID);
    expect(mine[0].id).toBe(report.id);
    expect((await s.incidents.getIncident(report.incidentId))?.status).toBe('received');
  });

  it('linking to an incident the user does not follow adds one follower and one reporter', async () => {
    const s = createMockServices();
    const garbage = (await s.incidents.listIncidents()).find((i) => i.categoryId === 'garbage')!;
    const { incident } = await s.incidents.submitReport(DEMO_USER_ID, input({ linkToIncidentId: garbage.id, location: garbage.location }));
    expect(incident.id).toBe(garbage.id);
    expect(incident.followers).toBe(garbage.followers + 1);
    expect(incident.linkedReportIds.length).toBe(garbage.linkedReportIds.length + 1);
  });

  it('follow then link counts the user once (+1, not +2) and listFollowing reports it', async () => {
    const s = createMockServices();
    const garbage = (await s.incidents.listIncidents()).find((i) => i.categoryId === 'garbage')!;
    await s.incidents.followIncident('u9', garbage.id);
    const { incident } = await s.incidents.submitReport('u9', input({ linkToIncidentId: garbage.id, location: garbage.location }));
    expect(incident.followers).toBe(garbage.followers + 1);
    expect(incident.linkedReportIds.length).toBe(garbage.linkedReportIds.length + 1);
    expect(await s.incidents.listFollowing('u9')).toEqual([garbage.id]);
  });

  it('new incident ids are zero-padded and the reporter follows it', async () => {
    const s = createMockServices();
    const { incident } = await s.incidents.submitReport(DEMO_USER_ID, input());
    expect(incident.id).toMatch(/^INC-\d{4}$/);
    expect(await s.incidents.listFollowing(DEMO_USER_ID)).toContain(incident.id);
  });

  it('listFollowing includes the incidents of the user\'s own reports', async () => {
    const s = createMockServices();
    expect(await s.incidents.listFollowing(DEMO_USER_ID)).toContain('INC-501');
  });

  it('followIncident increments followers once per user', async () => {
    const s = createMockServices();
    const [first] = await s.incidents.listIncidents();
    const a = await s.incidents.followIncident('u1', first.id);
    expect(a.followers).toBe(first.followers + 1);
    const b = await s.incidents.followIncident('u1', first.id);
    expect(b.followers).toBe(first.followers + 1);
    const c = await s.incidents.followIncident('u2', first.id);
    expect(c.followers).toBe(first.followers + 2);
  });

  it('simulateProgress walks the status forward and appends to the timeline', async () => {
    const s = createMockServices();
    const { incident } = await s.incidents.submitReport(DEMO_USER_ID, input());
    const next = await s.incidents.simulateProgress(incident.id);
    expect(next.status).toBe('triaged');
    expect(next.timeline).toHaveLength(2);
  });

  it('books a service request and lists it first', async () => {
    const s = createMockServices();
    const req = await s.serviceRequests.book(DEMO_USER_ID, {
      serviceType: 'bulky_waste',
      details: { items: ['سرير'], day: '2026-10-25', slot: 'afternoon', payment: 'fawry' },
      location: { lat: 30.056, lng: 31.33, address: 'مدينة نصر' },
    });
    expect(req.status).toBe('received');
    expect((await s.serviceRequests.listMine(DEMO_USER_ID))[0].id).toBe(req.id);
  });

  it('triage never offers the user\'s own pothole as a duplicate: it reports it as already reported', async () => {
    const s = createMockServices();
    const near = { lat: 30.0563, lng: 31.3306 };
    const res = await s.triage.analyze({ userId: DEMO_USER_ID, description: 'حفرة كبيرة في الشارع', categoryId: 'pothole', location: near });
    expect(res.duplicates).toHaveLength(0);
    expect(res.alreadyReported?.[0]).toMatchObject({ incidentId: 'INC-501', reportId: 'FTC-1042' });
  });

  it('triage offers the same pothole as a joinable duplicate to another user, until they follow it', async () => {
    const s = createMockServices();
    const near = { lat: 30.0563, lng: 31.3306 };
    const ask = () => s.triage.analyze({ userId: 'someone-else', description: 'حفرة كبيرة في الشارع', categoryId: 'pothole', location: near });
    const first = await ask();
    expect(first.duplicates[0].incidentId).toBe('INC-501');
    expect(first.alreadyReported).toHaveLength(0);
    await s.incidents.followIncident('someone-else', 'INC-501');
    expect((await ask()).duplicates).toHaveLength(0);
  });

  it('after reporting a new pothole the user gets the "already reported" note for it, not a join offer', async () => {
    const s = createMockServices();
    const spot = { lat: 30.07, lng: 31.36 };
    const { report } = await s.incidents.submitReport(DEMO_USER_ID, input({ categoryId: 'pothole', location: { ...spot, address: 'شارع تجريبي' } }));
    const res = await s.triage.analyze({ userId: DEMO_USER_ID, description: 'حفرة', categoryId: 'pothole', location: spot });
    expect(res.duplicates).toHaveLength(0);
    expect(res.alreadyReported?.[0].reportId).toBe(report.id);
  });

  it('serves concurrent first loads from a single seed', async () => {
    const s = createMockServices();
    const [a, b] = await Promise.all([s.incidents.listIncidents(), s.incidents.listIncidents()]);
    expect(a[0].createdAt).toBe(b[0].createdAt);
  });
});
