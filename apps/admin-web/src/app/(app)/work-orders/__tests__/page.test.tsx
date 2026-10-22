import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { WorkOrder } from '@/domain/admin-types';
import { ToastProvider } from '@/components/ui/Toast';

const push = vi.fn();
let search = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock('@/lib/session', () => ({
  useSession: () => ({ role: 'admin', name: 'مدير', userId: 'u1', title: 't', district: 'd', token: 'x' }),
}));
vi.mock('@/services/departments', () => ({
  getDepartments: vi.fn().mockResolvedValue([]),
  getTeams: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/services/workOrders', () => ({
  getWorkOrders: vi.fn(),
  getWorkOrder: vi.fn(),
  patchWorkOrder: vi.fn().mockResolvedValue({}),
}));

import { getWorkOrders, getWorkOrder } from '@/services/workOrders';
import WorkOrdersPage from '../page';

const future = new Date(Date.now() + 2 * 86400000).toISOString();
const wo = (id: string, status: WorkOrder['status'], extra: Partial<WorkOrder> = {}): WorkOrder => ({
  id,
  incidentId: `INC-${id}`,
  title: `عنوان ${id}`,
  address: 'شارع',
  department: 'صيانة الطرق',
  external: false,
  status,
  dueAt: future,
  overdue: false,
  estimatedCostEgp: 1000,
  tasks: [{ label: 'مهمة', done: false }],
  updates: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...extra,
});

const orders = [
  wo('WO-1', 'open'),
  wo('WO-2', 'assigned'),
  wo('WO-3', 'assigned'),
  wo('WO-4', 'in_progress'),
  wo('WO-5', 'done', { resolvedAt: new Date().toISOString() }),
  wo('WO-6', 'done', { resolvedAt: new Date(Date.now() - 20 * 86400000).toISOString() }),
];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <WorkOrdersPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('WorkOrdersPage kanban', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    search = '';
    vi.mocked(getWorkOrders).mockResolvedValue(orders);
    vi.mocked(getWorkOrder).mockImplementation(async (id) => orders.find((o) => o.id === id)!);
  });

  it('groups cards by status with counts and hides done orders older than 7 days', async () => {
    renderPage();
    await screen.findByText('عنوان WO-1');
    const col = (name: string) => within(screen.getByRole('region', { name }));
    expect(col('اتسلّم').getByText('عنوان WO-1')).toBeInTheDocument();
    expect(col('اتوزّع').getByText('عنوان WO-2')).toBeInTheDocument();
    expect(col('اتوزّع').getByText('عنوان WO-3')).toBeInTheDocument();
    expect(col('شغالين عليه').getByText('عنوان WO-4')).toBeInTheDocument();
    expect(col('اتحلّت').getByText('عنوان WO-5')).toBeInTheDocument();
    expect(screen.queryByText('عنوان WO-6')).not.toBeInTheDocument();
    expect(col('اتوزّع').getByRole('heading').textContent).toContain('2');
    expect(col('اتسلّم').getByRole('heading').textContent).toContain('1');
  });

  it('opens the drawer from the ?wo= deep link', async () => {
    search = 'wo=WO-4';
    renderPage();
    await waitFor(() => expect(getWorkOrder).toHaveBeenCalledWith('WO-4'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('still accepts ?open= as an alias', async () => {
    search = 'open=WO-2';
    renderPage();
    await waitFor(() => expect(getWorkOrder).toHaveBeenCalledWith('WO-2'));
  });

  it('shows the error state with a working retry', async () => {
    vi.mocked(getWorkOrders).mockRejectedValueOnce(new Error('x'));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'جرّب تاني' }));
    await waitFor(() => expect(getWorkOrders).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('عنوان WO-1')).toBeInTheDocument();
  });
});
