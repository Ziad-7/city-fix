import { describe, it, expect } from 'vitest';
import type { AdminServiceRequest } from '@/domain/admin-types';
import { bookedCount, chipCounts, computeKpis, filterRequests, EMPTY_FILTERS, paymentLabel } from '../sr-utils';

const NOW = new Date('2026-10-21T09:00:00Z').getTime();

type Over = Partial<AdminServiceRequest> & {
  day?: string;
  slot?: 'morning' | 'afternoon';
  payment?: 'cash' | 'fawry' | 'instapay' | 'wallet';
};

const mk = (o: Over = {}): AdminServiceRequest => {
  const { day = '2026-10-21', slot = 'morning', payment = 'cash', ...rest } = o;
  return {
    id: 'SRV-1',
    citizenId: 'c',
    serviceType: 'bulky_waste',
    details: { items: ['ثلاجة'], day, slot, payment },
    location: { lat: 1, lng: 1, address: 'شارع الطيران' },
    status: 'received',
    timeline: [],
    createdAt: '2026-10-20T00:00:00Z',
    department: 'النظافة',
    paid: false,
    ...rest,
  };
};

describe('filterRequests', () => {
  const list = [
    mk({ id: 'A' }),
    mk({ id: 'B', serviceType: 'tree_maintenance', day: '2026-10-22', status: 'assigned', payment: 'fawry' }),
    mk({ id: 'C', status: 'triaged', location: { lat: 1, lng: 1, address: 'شارع الحجاز' } }),
  ];
  it('chips filter by type and today', () => {
    expect(filterRequests(list, { ...EMPTY_FILTERS, chip: 'tree_maintenance' }, NOW).map((r) => r.id)).toEqual(['B']);
    expect(filterRequests(list, { ...EMPTY_FILTERS, chip: 'today' }, NOW).map((r) => r.id)).toEqual(['A', 'C']);
  });
  it('status received also covers triaged; payment and search apply', () => {
    expect(filterRequests(list, { ...EMPTY_FILTERS, status: 'received' }, NOW).map((r) => r.id)).toEqual(['A', 'C']);
    expect(filterRequests(list, { ...EMPTY_FILTERS, payment: 'fawry' }, NOW).map((r) => r.id)).toEqual(['B']);
    expect(filterRequests(list, { ...EMPTY_FILTERS, q: 'الحجاز' }, NOW).map((r) => r.id)).toEqual(['C']);
  });
  it('chip counts are over the whole list', () => {
    expect(chipCounts(list, NOW)).toEqual({ all: 3, bulky_waste: 2, tree_maintenance: 1, today: 2 });
  });
});

describe('computeKpis', () => {
  it('counts the four KPIs', () => {
    const list = [
      mk({ id: 'A' }),
      mk({ id: 'B', status: 'in_progress' }),
      mk({ id: 'C', payment: 'instapay', paid: false, day: '2026-10-25' }),
      mk({ id: 'D', payment: 'fawry', paid: true, day: '2026-10-25' }),
      mk({ id: 'E', status: 'resolved', timeline: [{ status: 'resolved', note: '', actor: 'x', at: '2026-10-19T10:00:00Z' }] }),
      mk({ id: 'F', status: 'resolved', timeline: [{ status: 'resolved', note: '', actor: 'x', at: '2026-10-10T10:00:00Z' }] }),
    ];
    const k = computeKpis(list, NOW);
    expect(k.fresh).toBe(3);
    expect(k.today).toBe(4);
    expect(k.todayInProgress).toBe(1);
    expect(k.awaitingPayment).toBe(1);
    expect(k.doneThisWeek).toBe(1);
    expect(k.doneLastWeek).toBe(1);
  });
});

describe('capacity and labels', () => {
  it('booked ignores finished requests and other slots', () => {
    const list = [mk({ id: 'A' }), mk({ id: 'B' }), mk({ id: 'C', status: 'resolved' }), mk({ id: 'D', slot: 'afternoon' })];
    expect(bookedCount(list, '2026-10-21', 'morning')).toBe(2);
  });
  it('payment label adds paid/pending markers', () => {
    expect(paymentLabel(mk({ payment: 'cash' }))).toBe('كاش مع العامل');
    expect(paymentLabel(mk({ payment: 'instapay', paid: true }))).toBe('إنستاباي · مدفوع');
    expect(paymentLabel(mk({ payment: 'fawry' }))).toBe('فوري · مستنية الدفع');
    expect(paymentLabel(mk({ payment: 'wallet' }))).toBe('محفظة موبايل');
  });
});
