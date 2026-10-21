import { buildSeed } from '@/services/mock/seed';
import { findDuplicates, pickDuplicateView, splitByUser } from '../duplicates';
import { haversineM } from '@/utils/geo';

const { incidents } = buildSeed(Date.UTC(2026, 9, 21, 12));
const pothole = incidents.find((i) => i.categoryId === 'pothole')!;

describe('findDuplicates', () => {
  it('haversine is sane (~111 m per 0.001 deg latitude)', () => {
    const d = haversineM({ lat: 30, lng: 31 }, { lat: 30.001, lng: 31 });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(117);
  });
  it('finds open same-category incidents within 250 m, nearest first', () => {
    const at = { lat: pothole.location.lat + 0.0004, lng: pothole.location.lng };
    const res = findDuplicates(incidents, 'pothole', at);
    expect(res).toHaveLength(1);
    expect(res[0].incidentId).toBe(pothole.id);
    expect(res[0].distanceM).toBeLessThan(60);
  });
  it('ignores other categories, far points and resolved incidents', () => {
    expect(findDuplicates(incidents, 'garbage', pothole.location)).toHaveLength(0);
    expect(findDuplicates(incidents, 'pothole', { lat: 30.2, lng: 31.5 })).toHaveLength(0);
    const resolved = incidents.map((i) => (i.id === pothole.id ? { ...i, status: 'resolved' as const } : i));
    expect(findDuplicates(resolved, 'pothole', pothole.location)).toHaveLength(0);
  });
  it('respects the radius', () => {
    const at = { lat: pothole.location.lat + 0.004, lng: pothole.location.lng };
    expect(findDuplicates(incidents, 'pothole', at)).toHaveLength(0);
    expect(findDuplicates(incidents, 'pothole', at, 600)).toHaveLength(1);
  });
});

describe('splitByUser', () => {
  const near = findDuplicates(incidents, 'pothole', pothole.location);
  it('moves the user\'s own incident to alreadyReported with its report id', () => {
    const r = splitByUser(near, new Map([[pothole.id, 'FTC-1042']]), new Set());
    expect(r.duplicates).toHaveLength(0);
    expect(r.alreadyReported).toEqual([expect.objectContaining({ incidentId: pothole.id, reportId: 'FTC-1042' })]);
  });
  it('drops followed incidents entirely', () => {
    const r = splitByUser(near, new Map(), new Set([pothole.id]));
    expect(r).toEqual({ duplicates: [], alreadyReported: [] });
  });
  it('keeps everything else joinable', () => {
    expect(splitByUser(near, new Map(), new Set()).duplicates).toHaveLength(1);
  });
});

describe('pickDuplicateView', () => {
  const match = { incidentId: 'A', title: 't', categoryId: 'pothole' as const, distanceM: 120, followers: 3, status: 'received' as const };
  const own = { incidentId: 'B', reportId: 'FTC-1', title: 't', categoryId: 'pothole' as const, distanceM: 40 };
  it('shows the own-report note when the nearest match is the user\'s own', () => {
    expect(pickDuplicateView({ duplicates: [match], alreadyReported: [own] }, 'pothole')).toEqual({ kind: 'own', own });
  });
  it('offers the join panel when a joinable duplicate is nearer than the own one', () => {
    expect(pickDuplicateView({ duplicates: [{ ...match, distanceM: 10 }], alreadyReported: [own] }, 'pothole').kind).toBe('join');
  });
  it('ignores matches of another category than the one being submitted', () => {
    expect(pickDuplicateView({ duplicates: [match], alreadyReported: [own] }, 'garbage')).toEqual({ kind: 'none' });
    expect(pickDuplicateView(null, 'pothole')).toEqual({ kind: 'none' });
  });
});
