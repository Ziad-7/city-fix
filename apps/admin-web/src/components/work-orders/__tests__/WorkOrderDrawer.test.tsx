import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { WorkOrder } from '@/domain/admin-types';
import { ToastProvider } from '@/components/ui/Toast';

vi.mock('@/services/workOrders', () => ({
  patchWorkOrder: vi.fn().mockResolvedValue({}),
}));
vi.mock('@/services/departments', () => ({
  getTeams: vi.fn().mockResolvedValue([]),
}));

import { patchWorkOrder } from '@/services/workOrders';
import { WorkOrderDrawer } from '../WorkOrderDrawer';

const base: WorkOrder = {
  id: 'WO-9',
  incidentId: 'INC-9',
  title: 'حفرة',
  address: 'شارع',
  department: 'صيانة الطرق',
  external: false,
  status: 'assigned',
  dueAt: new Date(Date.now() + 86400000).toISOString(),
  overdue: false,
  estimatedCostEgp: 1800,
  followers: 3,
  tasks: [
    { label: 'تأمين الموقع', done: true },
    { label: 'الردم', done: false },
  ],
  updates: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function renderDrawer(workOrder: WorkOrder = base) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <WorkOrderDrawer open workOrder={workOrder} onClose={() => {}} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('WorkOrderDrawer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('toggling a task patches the full task list with only that task flipped', async () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('checkbox', { name: /الردم/ }));
    await waitFor(() =>
      expect(patchWorkOrder).toHaveBeenCalledWith('WO-9', {
        tasks: [
          { label: 'تأمين الموقع', done: true },
          { label: 'الردم', done: true },
        ],
      }),
    );
    // original prop data is not mutated
    expect(base.tasks[1].done).toBe(false);
  });

  it('status change requires a note, then sends status + note', async () => {
    renderDrawer();
    fireEvent.change(screen.getByLabelText('الحالة الجديدة'), { target: { value: 'in_progress' } });
    fireEvent.click(screen.getByRole('button', { name: /حدّث الحالة وابلّغ المواطنين/ }));
    expect(await screen.findByText('اكتب رسالة للمواطنين')).toBeInTheDocument();
    expect(patchWorkOrder).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox', { name: /رسالة للمواطنين/ }), { target: { value: 'بدأنا الشغل' } });
    fireEvent.click(screen.getByRole('button', { name: /حدّث الحالة وابلّغ المواطنين/ }));
    await waitFor(() =>
      expect(patchWorkOrder).toHaveBeenCalledWith('WO-9', { status: 'in_progress', note: 'بدأنا الشغل' }),
    );
  });

  it('done orders show no form', () => {
    renderDrawer({ ...base, status: 'done', resolvedAt: new Date().toISOString() });
    expect(screen.getByText('الأمر ده اتحلّ خلاص.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /حدّث الحالة/ })).not.toBeInTheDocument();
  });

  it('offers only the current and forward statuses', () => {
    renderDrawer({ ...base, status: 'in_progress' });
    const values = Array.from(screen.getByLabelText('الحالة الجديدة').querySelectorAll('option')).map(
      (o) => (o as HTMLOptionElement).value,
    );
    expect(values).toEqual(['in_progress', 'done']);
  });

  it('resets the form to the new status after the work order status changes (no backwards move)', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const ui = (wo: WorkOrder) => (
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <WorkOrderDrawer open workOrder={wo} onClose={() => {}} />
        </ToastProvider>
      </QueryClientProvider>
    );
    const { rerender } = render(ui(base));
    expect((screen.getByLabelText('الحالة الجديدة') as HTMLSelectElement).value).toBe('assigned');
    rerender(ui({ ...base, status: 'in_progress' }));
    expect((screen.getByLabelText('الحالة الجديدة') as HTMLSelectElement).value).toBe('in_progress');
  });
});
