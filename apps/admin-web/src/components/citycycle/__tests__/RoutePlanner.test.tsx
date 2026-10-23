import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui';
import { ApiError } from '@/lib/http';
import type { RecyclingPickup } from '@/domain/citycycle-types';

const getPickups = vi.fn();
const optimizeRoutes = vi.fn();
let demo = false;
vi.mock('@/services/citycycle', async (orig) => ({
  ...(await orig<typeof import('@/services/citycycle')>()),
  getPickups: (...a: unknown[]) => getPickups(...a),
  optimizeRoutes: (...a: unknown[]) => optimizeRoutes(...a),
  isCityCycleDemo: () => demo,
}));
vi.mock('next/dynamic', () => ({
  default: () =>
    function MapStub(props: { pins: { id: string; title: string }[] }) {
      return <div data-testid="map">{props.pins.map((p) => `${p.id}:${p.title}`).join('|')}</div>;
    },
}));

import { RoutesSection } from '../RoutePlanner';

const pickup = (id: string, lat: number, address: string): RecyclingPickup => ({
  id,
  items: [{ materialId: 'glass', estimatedKg: 5 }],
  location: { address, lat, lng: 31.3 },
  day: '2026-10-24',
  slot: 'morning',
  mode: 'free',
  status: 'requested',
  createdAt: '',
});

const RESULT = {
  algorithm: 'ortools',
  distanceModel: 'haversine',
  routes: [
    {
      vehicleIndex: 0,
      pickupIds: ['RCY-2', 'RCY-1'],
      loadKg: 10,
      distanceMeters: 4200,
      stops: [
        { pickupId: 'RCY-2', lat: 30.06, lng: 31.3 },
        { pickupId: 'RCY-1', lat: 30.05, lng: 31.3 },
      ],
    },
  ],
  unassignedPickupIds: [],
  totalDistanceMeters: 4200,
};

function renderSection() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <RoutesSection />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  demo = false;
  getPickups.mockReset().mockResolvedValue([
    pickup('RCY-1', 30.05, 'شارع أ'),
    pickup('RCY-2', 30.06, 'شارع ب'),
    { ...pickup('RCY-3', 30.07, 'شارع ج'), collectorId: 'COL-1' },
    { ...pickup('RCY-4', 30.08, 'بدون موقع'), location: { address: 'x' } },
  ]);
  optimizeRoutes.mockReset();
});

describe('RoutesSection', () => {
  it('lists only unassigned requests with a position', async () => {
    renderSection();
    expect(await screen.findByText(/شارع أ/)).toBeInTheDocument();
    expect(screen.getByText(/شارع ب/)).toBeInTheDocument();
    expect(screen.queryByText(/شارع ج/)).not.toBeInTheDocument();
    expect(screen.queryByText(/بدون موقع/)).not.toBeInTheDocument();
  });

  it('requires a capacity and then shows ordered stops, the preview notice and map pins', async () => {
    optimizeRoutes.mockResolvedValue(RESULT);
    const user = userEvent.setup();
    renderSection();
    await screen.findByText(/شارع أ/);
    await user.click(screen.getByRole('button', { name: 'وسط الطلبات المختارة' }));
    await user.click(screen.getByRole('button', { name: 'اقترح المسارات' }));
    expect(await screen.findByText(/سعة المركبة لازم/)).toBeInTheDocument();
    expect(optimizeRoutes).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('سعة المركبة (كجم)'), '500');
    await user.click(screen.getByRole('button', { name: 'اقترح المسارات' }));

    expect(await screen.findByText(/مركبة 1 · 2 محطات · 10 كجم · 4.2 كم/)).toBeInTheDocument();
    const call = optimizeRoutes.mock.calls[0][0];
    expect(call).toMatchObject({ pickupIds: ['RCY-1', 'RCY-2'], vehicleCount: 1, capacityKg: 500 });
    expect(call.depot).toEqual({ lat: 30.055, lng: 31.3 });
    const stops = Array.from(document.querySelectorAll('ol > li'));
    expect(stops.map((li) => li.textContent)).toEqual(['RCY-2 · شارع ب', 'RCY-1 · شارع أ']);
    expect(screen.getByText(/مفيش طلب اتوزّع على جامع/)).toBeInTheDocument();
    expect(screen.getByTestId('map')).toHaveTextContent('RCY-2:مركبة 1 · محطة 1|RCY-1:مركبة 1 · محطة 2');
  });

  it('toasts the OR-Tools message on 503', async () => {
    optimizeRoutes.mockRejectedValue(new ApiError(503, 'السيرفر مش متاح'));
    const user = userEvent.setup();
    renderSection();
    await screen.findByText(/شارع أ/);
    await user.click(screen.getByRole('button', { name: 'وسط الطلبات المختارة' }));
    await user.type(screen.getByLabelText('سعة المركبة (كجم)'), '500');
    await user.click(screen.getByRole('button', { name: 'اقترح المسارات' }));
    expect(await screen.findByText(/خدمة تحسين المسارات \(OR-Tools\) مش متاحة/)).toBeInTheDocument();
  });

  it('is disabled with a notice in demo mode', async () => {
    demo = true;
    renderSection();
    expect(await screen.findByText('تخطيط المسارات محتاج السيرفر الحقيقي')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'اقترح المسارات' })).toBeDisabled());
  });
});
