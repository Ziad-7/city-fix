import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DashboardStats } from '@/domain/admin-types';

const push = vi.fn();
let search = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock('@/lib/session', () => ({
  useSession: () => ({
    role: 'admin',
    name: 'مدير',
    userId: 'u1',
    title: 't',
    district: 'القاهرة · حي مدينة نصر أول',
    token: 'x',
  }),
}));
vi.mock('@/services/dashboard', () => ({
  getDashboard: vi.fn(),
  getInsights: vi.fn().mockRejectedValue(new Error('no insights')),
}));
vi.mock('@/services/incidents', () => ({
  getIncidents: vi.fn().mockResolvedValue([]),
}));

import { getDashboard } from '@/services/dashboard';
import OverviewPage from '../page';

const stats = (open: number): DashboardStats => ({
  open,
  openDelta: 0,
  overdue: 2,
  resolvedThisWeek: 4,
  resolvedDelta: 0,
  avgResolutionDays: 2.5,
  avgResolutionDeltaDays: 0,
  byCategory: [],
  byStatus: [],
  overdueList: [],
  overdueTotal: 2,
  departments: [],
  activity: [],
  nav: { incidentsOpen: open, serviceRequestsOpen: 0 },
});

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = () => (
    <QueryClientProvider client={qc}>
      <OverviewPage />
    </QueryClientProvider>
  );
  return { qc, ui };
}

describe('OverviewPage range tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    search = '';
    vi.mocked(getDashboard).mockImplementation(async (range) => stats(range === 'today' ? 11 : range === '30d' ? 300 : 77));
  });

  it('defaults to 7d and pushes the new range to the URL on tab change', async () => {
    const { ui } = wrapper();
    render(ui());
    await waitFor(() => expect(getDashboard).toHaveBeenCalledWith('7d'));
    expect(screen.getByRole('button', { name: 'آخر 7 أيام' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'النهارده' }));
    expect(push).toHaveBeenCalledWith('/?range=today');
  });

  it('refetches the dashboard with the new range once the URL changes', async () => {
    const { ui } = wrapper();
    const { rerender } = render(ui());
    await screen.findByText('77');
    search = 'range=today';
    rerender(ui());
    await waitFor(() => expect(getDashboard).toHaveBeenCalledWith('today'));
    expect(await screen.findByText('11')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'النهارده' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('reads ?range=30d on load', async () => {
    search = 'range=30d';
    const { ui } = wrapper();
    render(ui());
    await waitFor(() => expect(getDashboard).toHaveBeenCalledWith('30d'));
  });

  it('shows an error state with retry when the dashboard fails', async () => {
    vi.mocked(getDashboard).mockRejectedValueOnce(new Error('boom'));
    const { ui } = wrapper();
    render(ui());
    fireEvent.click(await screen.findByRole('button', { name: /جرّب تاني|حاول/ }));
    await waitFor(() => expect(getDashboard).toHaveBeenCalledTimes(2));
  });
});
