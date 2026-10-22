import { usePrefs } from '@/store/usePrefs';
import { createMockServices } from '../mock';
import { resetMockDb } from '../mock/db';
import { DEMO_USER_ID } from '../mock/seed';

const setLang = (lang: 'ar' | 'en') => usePrefs.setState({ lang });
const ARABIC = /[؀-ۿ]/;

describe('mock backend in English', () => {
  beforeEach(async () => {
    await resetMockDb();
  });
  afterEach(() => setLang('ar'));

  it('answers with English titles and addresses at read time, Arabic as before otherwise', async () => {
    const s = createMockServices();
    const ar = await s.incidents.listIncidents();
    expect(ar.find((i) => i.id === 'INC-501')?.title).toBe('حفرة في شارع عباس العقاد');

    setLang('en');
    const en = await s.incidents.listIncidents();
    const first = en.find((i) => i.id === 'INC-501')!;
    expect(first.title).toBe('Pothole on Abbas El Akkad St');
    expect(first.location.address).toBe('Abbas El Akkad St, Nasr City');
    expect(first.eta).toBe('Tomorrow');
    for (const i of en) {
      expect(ARABIC.test(i.title)).toBe(false);
      expect(ARABIC.test(i.location.address)).toBe(false);
      expect(i.timeline.every((e) => !ARABIC.test(e.note) && !ARABIC.test(e.actor))).toBe(true);
    }
    // No internal fields leak into the API shape.
    expect(first).not.toHaveProperty('titleEn');
    expect(first).not.toHaveProperty('addressEn');
    expect(first.timeline[0]).not.toHaveProperty('noteEn');
    const pins = await s.incidents.listMapPins();
    expect(pins.find((p) => p.id === 'INC-502')?.title).toBe('Open manhole on Hassan El Maamoun St');
  });

  it('returns English timeline notes, seeded report and service request', async () => {
    const s = createMockServices();
    setLang('en');
    const [report] = await s.incidents.listMyReports(DEMO_USER_ID);
    expect(report.description).toMatch(/^There is a big pothole/);
    expect(report.location.landmark).toBe('In front of El Nasr Preparatory School');
    const inc = (await s.incidents.getIncident(report.incidentId))!;
    expect(inc.timeline.map((e) => e.note)).toEqual(['We got your report', 'Reviewed: Pothole or rough speed bump · High risk', 'Sent to Road Maintenance', 'The team is on site']);
    const [req] = await s.serviceRequests.listMine(DEMO_USER_ID);
    expect(req.location.address).toBe('Abbas El Akkad St, Nasr City');
    expect(req.timeline.map((e) => e.note)).toEqual(['We got your request', 'A team and a time are set']);
  });

  it('stores timeline text in both languages, so a switch re-reads it in the other one', async () => {
    const s = createMockServices();
    const [report] = await s.incidents.listMyReports(DEMO_USER_ID);
    let inc = (await s.incidents.getIncident(report.incidentId))!;
    while (inc.status !== 'resolved') inc = await s.incidents.simulateProgress(inc.id);
    await s.incidents.reopenIncident(DEMO_USER_ID, inc.id, 'الحفرة رجعت');

    setLang('en');
    const en = (await s.incidents.getIncident(inc.id))!;
    expect(en.timeline[en.timeline.length - 1]).toMatchObject({ actor: 'Citizen', note: 'Reopened: الحفرة رجعت' });
    expect(en.timeline[4].note).toBe('Fixed. Thank you for your report');
    setLang('ar');
    const ar = (await s.incidents.getIncident(inc.id))!;
    expect(ar.timeline[ar.timeline.length - 1]).toMatchObject({ actor: 'مواطن', note: 'اتفتح تاني: الحفرة رجعت' });
  });

  it('builds the title of a new report from the category label in the current language', async () => {
    const s = createMockServices();
    const res = await s.incidents.submitReport(DEMO_USER_ID, {
      categoryId: 'garbage',
      description: 'Garbage everywhere',
      photoUris: [],
      location: { lat: 30.05, lng: 31.33, address: 'Makram Ebeid St, Nasr City' },
      anonymous: false,
      blurFaces: false,
    });
    expect(res.incident.title).toBe('زبالة متراكمة · Makram Ebeid St');
    setLang('en');
    expect((await s.incidents.getIncident(res.incident.id))?.title).toBe('Garbage piling up · Makram Ebeid St');
    // An Arabic address is not mixed into an English title.
    setLang('ar');
    const ar = await s.incidents.submitReport(DEMO_USER_ID, {
      categoryId: 'pothole',
      description: 'حفرة',
      photoUris: [],
      location: { lat: 30.05, lng: 31.33, address: 'شارع التسعين، التجمع' },
      anonymous: false,
      blurFaces: false,
    });
    setLang('en');
    expect((await s.incidents.getIncident(ar.incident.id))?.title).toBe('Pothole or rough speed bump');
  });

  it('translates service request timelines and error messages', async () => {
    const s = createMockServices();
    setLang('en');
    const req = await s.serviceRequests.book(DEMO_USER_ID, {
      serviceType: 'tree_maintenance',
      details: { items: ['تقليم'], workType: 'تقليم', day: '2026-10-25', slot: 'morning' },
      location: { lat: 30.05, lng: 31.33, address: 'Test St' },
    });
    expect(req.timeline[0]).toMatchObject({ note: 'We got your tree trimming or removal request', actor: 'Parks Department' });
    await expect(s.serviceRequests.simulateProgress('SRV-nope')).rejects.toThrow("We couldn't find that request");
    await expect(s.auth.verifyCode('01012345678', '12')).rejects.toThrow('The code is 6 digits');
  });
});
