import AsyncStorage from '@react-native-async-storage/async-storage';
import { createMockServices, resetMockDb } from '../mock';
import { buildSeed, DEMO_USER_ID } from '../mock/seed';

describe('mock database saved before CityCycle', () => {
  it('gets pickups, bins and collectors from the seed, and keeps its own reports', async () => {
    await resetMockDb();
    const { pickups, bins, collectors, binReports, pickupCounter, ...old } = buildSeed();
    void pickups;
    void bins;
    void collectors;
    void binReports;
    void pickupCounter;
    old.reports[0].description = 'بلاغ قديم';
    await AsyncStorage.setItem('ftc.mock.db.v1', JSON.stringify(old));

    const s = createMockServices();
    expect((await s.cityCycle.listMyPickups(DEMO_USER_ID)).length).toBe(2);
    expect((await s.cityCycle.listBins()).length).toBeGreaterThanOrEqual(6);
    expect((await s.collector.getProfile('demo-collector')).status).toBe('verified');
    const created = await s.cityCycle.createPickup(DEMO_USER_ID, {
      items: [{ materialId: 'glass', estimatedKg: 1 }],
      location: { lat: 30.05, lng: 31.33, address: 'x' },
      day: '2026-10-25',
      slot: 'morning',
      mode: 'free',
    });
    expect(created.id).toBe('RCY-3007');
    expect((await s.incidents.listMyReports(DEMO_USER_ID))[0].description).toBe('بلاغ قديم');
  });
});
