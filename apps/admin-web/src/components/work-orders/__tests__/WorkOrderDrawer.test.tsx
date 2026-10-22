import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/Toast';
import { WorkOrderDrawer } from '../WorkOrderDrawer';
import type { WorkOrder } from '@/domain/admin-types';
import { patchWorkOrder } from '@/services/workOrders';

vi.mock('@/services/workOrders', () => ({ patchWorkOrder: vi.fn() }));
vi.mock('@/services/departments', () => ({ getTeams: vi.fn().mockResolvedValue([]) }));

const workOrder: WorkOrder = {
  id: 'WO-1',
  serviceRequestId: 'SR/with space',
  title: 'إصلاح رصيف',
  address: 'شارع التحرير',
  department: 'النظافة',
  external: false,
  status: 'open',
  dueAt: '2026-10-22T12:00:00Z',
  overdue: false,
  estimatedCostEgp: 100,
  tasks: [],
  updates: [],
  createdAt: '2026-10-21T12:00:00Z',
  updatedAt: '2026-10-21T12:00:00Z',
};

function renderDrawer() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <WorkOrderDrawer open workOrder={workOrder} onClose={() => {}} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('WorkOrderDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the note and reports failure when a status update request rejects', async () => {
    vi.mocked(patchWorkOrder).mockRejectedValue(new Error('PATCH failed'));
    renderDrawer();

    fireEvent.change(screen.getByRole('combobox', { name: 'الحالة الجديدة' }), {
      target: { value: 'assigned' },
    });
    const note = screen.getByRole('textbox', { name: 'رسالة للمواطنين' });
    fireEvent.change(note, { target: { value: 'هنبدأ الإصلاح غدًا' } });
    fireEvent.click(screen.getByRole('button', { name: /حدّث الحالة وابلّغ المواطنين/i }));

    await waitFor(() => expect(patchWorkOrder).toHaveBeenCalled());
    await waitFor(() => expect(screen.getAllByText('PATCH failed')).toHaveLength(1));
    expect(screen.getByRole('textbox', { name: 'رسالة للمواطنين' })).toHaveValue('هنبدأ الإصلاح غدًا');
    expect(screen.queryByText('اتحدّثت الحالة. المواطنين هيشوفوا رسالتك في التتبع.')).not.toBeInTheDocument();
  });

  it('links service requests to the list with an encoded open query', () => {
    renderDrawer();

    expect(screen.getByRole('link', { name: 'SR/with space' })).toHaveAttribute(
      'href',
      '/service-requests?open=SR%2Fwith%20space',
    );
    expect(screen.getByRole('link', { name: 'افتح الطلب' })).toHaveAttribute(
      'href',
      '/service-requests?open=SR%2Fwith%20space',
    );
  });
});
