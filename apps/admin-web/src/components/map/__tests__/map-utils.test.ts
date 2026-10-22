import { describe, it, expect } from 'vitest';
import { pinKind, incidentToPin, filterPins, pinSvg, isCriticalOpen } from '../map-utils';
import type { AdminIncident } from '@/domain/admin-types';

const mockIncident = (overrides?: Partial<AdminIncident>): AdminIncident => ({
  id: 'INC-001',
  categoryId: 'pothole',
  title: 'Test issue',
  severity: 'medium',
  priority: { score: 50, factors: [] },
  status: 'received',
  department: 'Test Dept',
  estimatedCostEgp: 1000,
  linkedReportIds: [],
  followers: 0,
  location: { lat: 30.056, lng: 31.330, address: '123 Test St' },
  areaUnderserved: false,
  timeline: [],
  createdAt: '2026-10-21T00:00:00Z',
  updatedAt: '2026-10-21T00:00:00Z',
  linkedReports: [],
  dueAt: '2026-10-25T00:00:00Z',
  overdue: false,
  external: false,
  inBudgetPlan: false,
  ...overrides,
});

describe('pinKind', () => {
  it('should return critical for high-priority open incidents', () => {
    const incident = mockIncident({ priority: { score: 90, factors: [] }, status: 'received' });
    expect(pinKind(incident)).toBe('critical');
  });

  it('should return received for received status', () => {
    const incident = mockIncident({ status: 'received' });
    expect(pinKind(incident)).toBe('received');
  });

  it('should return received for triaged status', () => {
    const incident = mockIncident({ status: 'triaged' });
    expect(pinKind(incident)).toBe('received');
  });

  it('should return assigned for assigned status', () => {
    const incident = mockIncident({ status: 'assigned' });
    expect(pinKind(incident)).toBe('assigned');
  });

  it('should return progress for in_progress status', () => {
    const incident = mockIncident({ status: 'in_progress' });
    expect(pinKind(incident)).toBe('progress');
  });

  it('should return resolved for resolved status', () => {
    const incident = mockIncident({ status: 'resolved' });
    expect(pinKind(incident)).toBe('resolved');
  });

  it('should return resolved for closed status', () => {
    const incident = mockIncident({ status: 'closed' });
    expect(pinKind(incident)).toBe('resolved');
  });

  it('should not return critical if score is below 85', () => {
    const incident = mockIncident({ priority: { score: 84, factors: [] }, status: 'received' });
    expect(pinKind(incident)).toBe('received');
  });

  it('should not return critical for resolved incidents even if score is high', () => {
    const incident = mockIncident({ priority: { score: 90, factors: [] }, status: 'resolved' });
    expect(pinKind(incident)).toBe('resolved');
  });
});

describe('incidentToPin', () => {
  it('should convert incident to map pin', () => {
    const incident = mockIncident({
      id: 'INC-123',
      title: 'Pothole on Main St',
      location: { lat: 30.056, lng: 31.330, address: 'Main St' },
    });
    const pin = incidentToPin(incident);
    expect(pin.id).toBe('INC-123');
    expect(pin.lat).toBe(30.056);
    expect(pin.lng).toBe(31.330);
    expect(pin.title).toBe('Pothole on Main St');
  });
});

describe('filterPins', () => {
  it('should filter pins by status', () => {
    const pins = [
      { id: '1', lat: 0, lng: 0, kind: 'received' as const, title: 'Test' },
      { id: '2', lat: 0, lng: 0, kind: 'assigned' as const, title: 'Test' },
      { id: '3', lat: 0, lng: 0, kind: 'progress' as const, title: 'Test' },
    ];
    const filtered = filterPins(pins, ['received', 'assigned']);
    expect(filtered).toHaveLength(2);
    expect(filtered.map(p => p.id)).toEqual(['1', '2']);
  });

  it('should return all pins when all statuses included', () => {
    const pins = [
      { id: '1', lat: 0, lng: 0, kind: 'received' as const, title: 'Test' },
      { id: '2', lat: 0, lng: 0, kind: 'assigned' as const, title: 'Test' },
    ];
    const filtered = filterPins(pins, ['received', 'assigned', 'progress', 'resolved', 'critical']);
    expect(filtered).toHaveLength(2);
  });

  it('should return empty array when no statuses match', () => {
    const pins = [
      { id: '1', lat: 0, lng: 0, kind: 'received' as const, title: 'Test' },
      { id: '2', lat: 0, lng: 0, kind: 'assigned' as const, title: 'Test' },
    ];
    const filtered = filterPins(pins, ['progress', 'resolved']);
    expect(filtered).toHaveLength(0);
  });
});

describe('critical detection', () => {
  it('treats severity=critical with a low score as critical when open', () => {
    const inc = mockIncident({ severity: 'critical', priority: { score: 30, factors: [] }, status: 'assigned' });
    expect(isCriticalOpen(inc)).toBe(true);
    expect(pinKind(inc)).toBe('critical');
  });

  it('never marks resolved incidents critical', () => {
    const inc = mockIncident({ severity: 'critical', status: 'closed' });
    expect(isCriticalOpen(inc)).toBe(false);
  });
});

describe('pinSvg', () => {
  it('uses the spec colour for each kind', () => {
    expect(pinSvg('critical')).toContain('#A50E25');
    expect(pinSvg('resolved')).toContain('#1F6B33');
    expect(pinSvg('progress')).toContain('#D4A20B');
  });
});
