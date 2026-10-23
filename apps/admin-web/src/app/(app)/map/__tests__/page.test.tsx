import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AdminIncident } from '@/domain/admin-types';
import { ToastProvider } from '@/components/ui';

const getIncidents = vi.fn();
vi.mock('@/services/incidents', () => ({ getIncidents: (...a: unknown[]) => getIncidents(...a) }));
const getHotspots = vi.fn();
vi.mock('@/services/map', () => ({ getHotspots: (...a: unknown[]) => getHotspots(...a) }));
vi.mock('@/services/departments', () => ({
  getDepartments: () => Promise.resolve([{ id: 'd1', nameAr: 'النظافة', external: false }]),
}));
vi.mock('@/lib/session', () => ({ useSession: () => ({ role: 'admin', district: 'حي مدينة نصر أول' }) }));
const replace = vi.fn();
let params = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => params,
}));
vi.mock('next/dynamic', () => ({
  default: () =>
    function MapStub(props: { pins: { id: string }[]; selectedId?: string | null; onSelect?: (id: string) => void }) {
      return (
        <div data-testid="map" data-selected={props.selectedId ?? ''}>
          {props.pins.map((p) => (
            <button key={p.id} onClick={() => props.onSelect?.(p.id)}>
              pin-{p.id}
            </button>
          ))}
        </div>
      );
    },
}));

import MapPage from '../page';

const now = new Date().toISOString();
const inc = (o: Partial<AdminIncident>): AdminIncident =>
  ({
    id: 'INC-1',
    categoryId: 'pothole',
    title: 'حفرة كبيرة',
    severity: 'medium',
    priority: { score: 50, factors: [] },
    status: 'received',
    department: 'النظافة',
    followers: 3,
    location: { lat: 30, lng: 31, address: 'شارع التسعين' },
    createdAt: now,
    updatedAt: now,
    dueAt: now,
    timeline: [],
    ...o,
  }) as AdminIncident;

const DATA = [
  inc({ id: 'INC-1' }),
  inc({ id: 'INC-2', priority: { score: 90, factors: [] }, title: 'سلك مكشوف' }),
  inc({ id: 'INC-3', status: 'resolved' }),
];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MapPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  params = new URLSearchParams();
  replace.mockReset();
  getIncidents.mockReset();
  getHotspots.mockReset();
  getIncidents.mockImplementation((p?: { status?: string }) =>
    Promise.resolve(p?.status === 'resolved' ? [] : DATA),
  );
});

describe('MapPage', () => {
  it('shows counts per kind with critical counted separately', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('sum-critical')).toHaveTextContent('1'));
    expect(screen.getByTestId('sum-received')).toHaveTextContent('1');
    expect(screen.getByTestId('sum-resolved')).toHaveTextContent('1');
    expect(screen.getByText('حي مدينة نصر أول', { exact: false })).toBeInTheDocument();
  });

  it('toggling a status chip removes those pins', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('pin-INC-2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^خطر/ }));
    expect(screen.queryByText('pin-INC-2')).not.toBeInTheDocument();
    expect(screen.getByText('pin-INC-1')).toBeInTheDocument();
  });

  it('clicking a pin fills the selected card and URL focus', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByText('pin-INC-2'));
    expect(await screen.findByRole('heading', { name: 'سلك مكشوف' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'افتح البلاغ' })).toHaveAttribute('href', '/incidents/INC-2');
    expect(screen.getByRole('link', { name: 'أنشئ أمر شغل' })).toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenLastCalledWith(expect.stringContaining('focus=INC-2'), expect.anything()));
  });

  it('deep link ?focus selects the incident and search reports no match', async () => {
    params = new URLSearchParams('focus=INC-1');
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('heading', { name: 'حفرة كبيرة' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('ابحث في الخريطة'), 'nothing{Enter}');
    expect(await screen.findByText('مفيش بلاغ بالاسم ده')).toBeInTheDocument();
  });

  it('shows error state with retry', async () => {
    getIncidents.mockRejectedValueOnce(new Error('x'));
    renderPage();
    expect(await screen.findByText('حصلت مشكلة وإحنا بنحمّل البيانات')).toBeInTheDocument();
  });

  it('does not ask for hotspots until the chip is toggled, then lists them by count with the privacy note', async () => {
    getHotspots.mockResolvedValue({
      generatedAt: 'x',
      days: 30,
      radiusMeters: 500,
      minCount: 3,
      items: [
        { id: 'H1', lat: 30, lng: 31, count: 3, categoryCounts: [], maxPriorityScore: 40 },
        { id: 'H2', lat: 30.1, lng: 31.1, count: 7, categoryCounts: [], maxPriorityScore: 80 },
      ],
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('pin-INC-1');
    expect(getHotspots).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /بؤر رمي المخلفات/ }));
    expect(await screen.findByRole('heading', { name: 'بؤر متكررة' })).toBeInTheDocument();
    const items = await screen.findAllByText(/أعلى أولوية/);
    expect(items[0]).toHaveTextContent('7 بلاغات');
    expect(items[1]).toHaveTextContent('3 بلاغات');
    expect(screen.getByText(/في نطاق 500 متر/)).toHaveTextContent('مفيش بيانات مبلّغين');
    expect(getHotspots).toHaveBeenCalledWith({ days: 30 });
  });

  it('shows a notice when the server has no hotspots route', async () => {
    getHotspots.mockResolvedValue(null);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /بؤر رمي المخلفات/ }));
    expect(await screen.findByText('السيرفر ده مفيهوش البؤر')).toBeInTheDocument();
  });
});
