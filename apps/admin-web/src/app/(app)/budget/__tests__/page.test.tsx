import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { BudgetPlan } from '@/domain/admin-types';
import { ToastProvider } from '@/components/ui/Toast';

const push = vi.fn();
let role: 'admin' | 'staff' = 'admin';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/session', () => ({
  useSession: () => ({ role, name: 'x', userId: 'u', title: 't', district: 'd', token: 'x' }),
}));
vi.mock('@/services/budget', () => ({
  optimizeBudget: vi.fn(),
  commitBudgetPlan: vi.fn(),
}));

import { optimizeBudget, commitBudgetPlan } from '@/services/budget';
import BudgetPage from '../page';

const item = (id: string, score: number) => ({
  incidentId: id,
  title: `بلاغ ${id}`,
  priorityScore: score,
  costEgp: 10000,
  reason: 'سبب',
});
const plan = {
  budgetEgp: 300000,
  selected: [item('INC-1', 90), item('INC-2', 80)],
  skipped: [item('INC-3', 40)],
  totalCost: 20000,
  remaining: 280000,
  coveredPriority: 170,
  totalPriority: 210,
  citizensServed: 5,
  citizensTotal: 7,
} as unknown as BudgetPlan;

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <BudgetPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('BudgetPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    role = 'admin';
    vi.mocked(optimizeBudget).mockResolvedValue(plan);
    vi.mocked(commitBudgetPlan).mockResolvedValue([{ id: 'WO-1' }, { id: 'WO-2' }]);
  });
  afterEach(() => vi.useRealTimers());

  it('debounces the slider: optimizeBudget gets the new value only after 400ms', async () => {
    vi.useFakeTimers();
    renderPage();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(optimizeBudget).toHaveBeenCalledWith(300000);

    fireEvent.change(screen.getByRole('slider'), { target: { value: '200000' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(399);
    });
    expect(optimizeBudget).not.toHaveBeenCalledWith(200000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2);
    });
    expect(optimizeBudget).toHaveBeenCalledWith(200000);
  });

  it('commit needs confirmation and sends the selected incident ids', async () => {
    renderPage();
    await screen.findByText('بلاغ INC-1');
    fireEvent.click(screen.getByRole('button', { name: 'حوّل الخطة لأوامر شغل' }));
    expect(commitBudgetPlan).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'حوّل الخطة' }));
    await vi.waitFor(() => expect(commitBudgetPlan).toHaveBeenCalledWith(['INC-1', 'INC-2']));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/work-orders'));
  });

  it('cancel in the confirm dialog does not commit', async () => {
    renderPage();
    await screen.findByText('بلاغ INC-1');
    fireEvent.click(screen.getByRole('button', { name: 'حوّل الخطة لأوامر شغل' }));
    fireEvent.click(await screen.findByRole('button', { name: 'إلغاء' }));
    expect(commitBudgetPlan).not.toHaveBeenCalled();
  });

  it('staff see the no-permission state and no plan request is made', () => {
    role = 'staff';
    renderPage();
    expect(screen.getByText('ميزانية الإصلاحات متاحة للمشرفين بس.')).toBeInTheDocument();
    expect(optimizeBudget).not.toHaveBeenCalled();
  });
});
