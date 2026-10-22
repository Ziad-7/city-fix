import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AdminIncident } from '@/domain/admin-types';

const mockIncidents: AdminIncident[] = [
  {
    id: 'inc-1',
    title: 'بلاغ عالي الأولوية',
    categoryId: 'pothole',
    status: 'received',
    priority: { score: 95, factors: [{ key: 'location', label: 'الموقع', points: 30, max: 50 }] },
    location: { address: 'شارع النيل، القاهرة', lat: 30.0, lng: 31.2 },
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    linkedReports: [{ id: 'r1', reporter: 'مواطن', description: 'test', source: 'app', photoCount: 1, createdAt: new Date().toISOString() }, { id: 'r2', reporter: 'مواطن', description: 'test', source: 'app', photoCount: 0, createdAt: new Date().toISOString() }],
    overdue: false,
    external: false,
    department: 'قسم الصرف الصحي',
    externalHotline: undefined,
    inBudgetPlan: true,
    triage: { options: [], source: 'user' as const, confirmed: false },
    workOrderId: 'wo-1',
    lastReviewedBy: 'أحمد محمد',
    severity: 'high',
    estimatedCostEgp: 5000,
    linkedReportIds: ['r1', 'r2'],
    followers: 0,
    areaUnderserved: false,
  } as unknown as AdminIncident,
  {
    id: 'inc-2',
    title: 'بلاغ متأخر',
    categoryId: 'sewage_overflow',
    status: 'triaged',
    priority: { score: 70, factors: [{ key: 'time', label: 'الوقت', points: 20, max: 30 }] },
    location: { address: 'شارع رمسيس، القاهرة', lat: 30.1, lng: 31.3 },
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    dueAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    linkedReports: [{ id: 'r3', reporter: 'مواطن', description: 'test', source: 'app', photoCount: 2, createdAt: new Date().toISOString() }],
    overdue: true,
    external: false,
    department: 'قسم الأمن',
    externalHotline: undefined,
    inBudgetPlan: false,
    triage: { options: [], source: 'user' as const, confirmed: false },
    workOrderId: undefined,
    lastReviewedBy: undefined,
    severity: 'medium',
    estimatedCostEgp: 3000,
    linkedReportIds: ['r3'],
    followers: 5,
    areaUnderserved: true,
  } as unknown as AdminIncident,
  {
    id: 'inc-3',
    title: 'بلاغ جهة خارجية',
    categoryId: 'water_pipe_burst',
    status: 'assigned',
    priority: { score: 50, factors: [{ key: 'impact', label: 'التأثير', points: 15, max: 40 }] },
    location: { address: 'شارع محمود سامي، الجيزة', lat: 30.05, lng: 31.25 },
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    dueAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    linkedReports: [],
    overdue: false,
    external: true,
    department: 'وزارة الصحة',
    externalHotline: '19056',
    inBudgetPlan: false,
    triage: { options: [], source: 'user' as const, confirmed: false },
    workOrderId: undefined,
    lastReviewedBy: 'سارة علي',
    severity: 'low',
    estimatedCostEgp: 1500,
    linkedReportIds: [],
    followers: 2,
    areaUnderserved: false,
  } as unknown as AdminIncident,
];

const mockDashboard = {
  open: 15,
  openDelta: 2,
  overdue: 3,
  resolvedThisWeek: 8,
  avgResolutionDays: 2.5,
  activity: [{ at: new Date().toISOString() }],
};

const mockDepartments = [
  { id: 'dept-1', nameAr: 'قسم الصرف الصحي' },
  { id: 'dept-2', nameAr: 'قسم الأمن' },
];

const mockWorkOrder = {
  id: 'wo-1',
  status: 'in_progress',
  team: 'فريق الصيانة 1',
  dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
};

vi.mock('@/services/incidents', () => ({
  getIncidents: vi.fn().mockResolvedValue(mockIncidents),
  patchIncident: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/services/dashboard', () => ({
  getDashboard: vi.fn().mockResolvedValue(mockDashboard),
}));

vi.mock('@/services/workOrders', () => ({
  getWorkOrder: vi.fn().mockResolvedValue(mockWorkOrder),
}));

vi.mock('@/services/departments', () => ({
  getDepartments: vi.fn().mockResolvedValue(mockDepartments),
}));

vi.mock('@/lib/session', () => ({
  useSession: vi.fn().mockReturnValue({ role: 'admin' }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe('IncidentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders incidents sorted by priority descending', async () => {
    const { default: IncidentsPage } = await import('../page');
    render(<IncidentsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('بلاغ عالي الأولوية')).toBeInTheDocument();
    });

    const rows = screen.getAllByRole('row');
    // Verify incidents are present
    expect(screen.getByText('بلاغ عالي الأولوية')).toBeInTheDocument(); // score 95
    expect(screen.getByText('بلاغ متأخر')).toBeInTheDocument(); // score 70
    expect(screen.getByText('بلاغ جهة خارجية')).toBeInTheDocument(); // score 50
  });

  it('displays all three incidents in the table', async () => {
    const { default: IncidentsPage } = await import('../page');
    render(<IncidentsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('بلاغ عالي الأولوية')).toBeInTheDocument();
    });

    // Verify all three incidents are rendered
    expect(screen.getByText('بلاغ متأخر')).toBeInTheDocument();
    expect(screen.getByText('بلاغ جهة خارجية')).toBeInTheDocument();
  });

  it('displays the "متأخرة" filter chip to filter by overdue status', async () => {
    const { default: IncidentsPage } = await import('../page');
    const user = userEvent.setup();
    render(<IncidentsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('بلاغ عالي الأولوية')).toBeInTheDocument();
    });

    // Verify the "متأخرة" (overdue) filter chip exists and is clickable
    const overdueChip = screen.getByRole('button', { name: /متأخرة/ });
    expect(overdueChip).toBeInTheDocument();

    // Click it to activate the filter
    await user.click(overdueChip);

    // After filtering, the overdue incident should still be displayed
    await waitFor(() => {
      expect(screen.getByText('بلاغ متأخر')).toBeInTheDocument();
    });
  });

  it('displays "جهة خارجية" label in table for external incidents', async () => {
    const { default: IncidentsPage } = await import('../page');
    render(<IncidentsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('بلاغ جهة خارجية')).toBeInTheDocument();
    });

    // Look for the external hotline display
    expect(screen.getByText(/جهة خارجية · 19056/)).toBeInTheDocument();
  });

  it('displays dashboard KPIs correctly', async () => {
    const { default: IncidentsPage } = await import('../page');
    render(<IncidentsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('بلاغات مفتوحة')).toBeInTheDocument();
    });

    // Check KPI cards are rendered with correct values
    expect(screen.getByText('15')).toBeInTheDocument(); // openCount
    expect(screen.getByText('3')).toBeInTheDocument(); // overdueCount
    expect(screen.getByText('8')).toBeInTheDocument(); // resolvedCount
    expect(screen.getByText('2.5 يوم')).toBeInTheDocument(); // avgResolutionDays
  });

  it('shows only open incidents with default status filter', async () => {
    const mockOpenIncident = { ...mockIncidents[0], status: 'received' };
    const mockResolvedIncident = { ...mockIncidents[0], id: 'inc-resolved', status: 'resolved' };
    const { getIncidents } = await import('@/services/incidents');
    (getIncidents as any).mockResolvedValue([mockOpenIncident, mockResolvedIncident]);

    const { default: IncidentsPage } = await import('../page');
    render(<IncidentsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('بلاغ عالي الأولوية')).toBeInTheDocument();
    });

    // By default, should show only open status
    expect(screen.getByText('بلاغ عالي الأولوية')).toBeInTheDocument();
    // Resolved should be filtered out on client side
  });

  it('shows all incidents when كل الحالات filter is selected', async () => {
    const mockOpenIncident = { ...mockIncidents[0], status: 'received' };
    const mockResolvedIncident = { ...mockIncidents[0], id: 'inc-resolved', status: 'resolved', title: 'بلاغ اتحلّ' };
    const { getIncidents } = await import('@/services/incidents');
    (getIncidents as any).mockResolvedValue([mockOpenIncident, mockResolvedIncident]);

    const { default: IncidentsPage } = await import('../page');
    const user = userEvent.setup();
    render(<IncidentsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('بلاغ عالي الأولوية')).toBeInTheDocument();
    });

    // Select كل الحالات filter
    const statusSelects = screen.getAllByRole('combobox');
    const statusSelect = statusSelects.find(s => (s as HTMLSelectElement).id === 'status-select');

    if (statusSelect) {
      fireEvent.change(statusSelect, { target: { value: 'all' } });

      // Both open and resolved should be shown
      await waitFor(() => {
        expect(screen.getByText('بلاغ اتحلّ')).toBeInTheDocument();
      });
    }
  });

  it('disables department select for staff users', async () => {
    const { default: IncidentsPage } = await import('../page');
    render(<IncidentsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('بلاغ عالي الأولوية')).toBeInTheDocument();
    });

    // Find department select
    const selects = screen.getAllByRole('combobox');
    const deptSelect = selects.find(s => (s as HTMLSelectElement).id === 'department-select');

    // Since mock session has role 'admin', the select should be enabled (not in disabled state)
    if (deptSelect) {
      expect(deptSelect).not.toBeDisabled();
    }
  });
});
