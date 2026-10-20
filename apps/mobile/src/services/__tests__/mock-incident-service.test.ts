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

  it('detects a duplicate and linking increments followers and reporters', async () => {
    const s = createMockServices();
    const [pothole] = (await s.incidents.listIncidents()).filter((i) => i.categoryId === 'pothole');
    const dups = await s.incidents.findDuplicates('pothole', { lat: pothole.location.lat + 0.0003, lng: pothole.location.lng });
    expect(dups[0].incidentId).toBe(pothole.id);

    const { incident } = await s.incidents.submitReport(DEMO_USER_ID, input({ categoryId: 'pothole', location: pothole.location, linkToIncidentId: pothole.id }));
    expect(incident.id).toBe(pothole.id);
    expect(incident.followers).toBe(pothole.followers + 1);
    expect(incident.linkedReportIds.length).toBe(pothole.linkedReportIds.length + 1);
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

  it('triage service returns duplicates for a nearby location', async () => {
    const s = createMockServices();
    const res = await s.triage.analyze({ description: 'حفرة كبيرة في الشارع', categoryId: 'pothole', location: { lat: 30.0563, lng: 31.3306 } });
    expect(res.options[0].categoryId).toBe('pothole');
    expect(res.duplicates.length).toBeGreaterThan(0);
  });
});
