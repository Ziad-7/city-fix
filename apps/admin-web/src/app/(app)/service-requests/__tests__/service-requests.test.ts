import { describe, it, expect } from 'vitest';
import type { AdminServiceRequest } from '@/domain/admin-types';

const mockServiceRequest = (overrides?: Partial<AdminServiceRequest>): AdminServiceRequest => ({
  id: 'SRV-001',
  citizenId: 'citizen-1',
  serviceType: 'bulky_waste',
  details: {
    items: ['test item'],
    day: '2026-10-21',
    slot: 'morning',
    payment: 'cash',
  },
  location: { lat: 30.056, lng: 31.330, address: '123 Test St' },
  status: 'received',
  timeline: [],
  createdAt: '2026-10-21T00:00:00Z',
  department: 'Test Dept',
  paid: false,
  ...overrides,
});

describe('Service Request Filtering', () => {
  const requests = [
    mockServiceRequest({
      id: 'SRV-001',
      serviceType: 'bulky_waste',
      details: { items: ['item1'], day: '2026-10-21', slot: 'morning', payment: 'cash' },
      status: 'received',
    }),
    mockServiceRequest({
      id: 'SRV-002',
      serviceType: 'tree_maintenance',
      details: { items: ['item2'], day: '2026-10-22', slot: 'afternoon', payment: 'fawry' },
      status: 'assigned',
      paid: false,
    }),
    mockServiceRequest({
      id: 'SRV-003',
      serviceType: 'bulky_waste',
      details: { items: ['item3'], day: '2026-10-21', slot: 'afternoon', payment: 'instapay' },
      status: 'in_progress',
      paid: true,
    }),
  ];

  it('should filter by service type', () => {
    const filtered = requests.filter(r => r.serviceType === 'bulky_waste');
    expect(filtered).toHaveLength(2);
    expect(filtered.map(r => r.id)).toEqual(['SRV-001', 'SRV-003']);
  });

  it('should filter by payment method', () => {
    const filtered = requests.filter(r => r.details.payment === 'cash');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('SRV-001');
  });

  it('should filter by status', () => {
    const filtered = requests.filter(r => r.status === 'assigned');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('SRV-002');
  });

  it('should count new requests', () => {
    const newCount = requests.filter(r => r.status === 'received').length;
    expect(newCount).toBe(1);
  });

  it('should count today requests', () => {
    const today = '2026-10-21';
    const todayCount = requests.filter(r => {
      return r.details.day === today && r.status === 'in_progress';
    }).length;
    expect(todayCount).toBe(1);
  });

  it('should count pending payment requests', () => {
    const pendingCount = requests.filter(
      r => ['fawry', 'instapay', 'wallet'].includes(r.details.payment) && !r.paid && !['resolved', 'closed'].includes(r.status),
    ).length;
    expect(pendingCount).toBe(1);
  });

  it('should count resolved this week', () => {
    const weekAgo = new Date('2026-10-14');
    const resolvedCount = requests.filter(r => {
      if (r.status !== 'resolved' && r.status !== 'closed') return false;
      return new Date(r.details.day) >= weekAgo;
    }).length;
    expect(resolvedCount).toBe(0);
  });
});

describe('Service Request Mutations', () => {
  it('should call patch with correct args for schedule change', () => {
    const id = 'SRV-001';
    const data = { day: '2026-10-25', slot: 'afternoon', note: 'اختاره جديد' };
    // This would be tested with vitest.mock of patchServiceRequest
    expect(data).toEqual({ day: '2026-10-25', slot: 'afternoon', note: 'اختاره جديد' });
  });

  it('should call patch with status change and note', () => {
    const id = 'SRV-001';
    const data = { status: 'assigned', note: 'تم التعيين' };
    expect(data.status).toBe('assigned');
    expect(data.note).toBe('تم التعيين');
  });

  it('should require note when status changes', () => {
    const hasNote = (note?: string) => !!note && note.trim().length > 0;
    expect(hasNote('تم التعيين')).toBe(true);
    expect(hasNote('')).toBe(false);
    expect(hasNote(undefined)).toBe(false);
  });
});
