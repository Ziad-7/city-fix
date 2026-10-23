import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui';
import { ApiError } from '@/lib/http';
import { CollectorsSection, PickupsSection, PricesSection } from '@/components/citycycle/sections';
import {
  cancelPickup,
  getPickups,
  getRecyclingSummary,
  isCityCycleDemo,
  resetCityCycleDemo,
} from '@/services/citycycle';

let role = 'admin';
vi.mock('@/lib/session', () => ({ useSession: () => ({ role, district: 'x', name: 'a', title: 't' }) }));
vi.mock('@/services/bins', () => ({ getSmartBins: vi.fn().mockResolvedValue([]), getSmartBinReadings: vi.fn() }));

import Page from '../page';

const reply = (status: number, body: unknown = { detail: 'x' }) => () =>
  Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), { status }));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ToastProvider>{ui}</ToastProvider></QueryClientProvider>);
}

beforeEach(() => {
  role = 'admin';
  resetCityCycleDemo();
  vi.stubGlobal('fetch', vi.fn(reply(404)));
});

describe('demo fallback', () => {
  it.each([404, 405, 501])('switches to demo data when the list route answers %i', async (status) => {
    vi.stubGlobal('fetch', vi.fn(reply(status)));
    const list = await getPickups();
    expect(list.length).toBeGreaterThan(0);
    expect(isCityCycleDemo()).toBe(true);
    const c = await cancelPickup(list[0].id);
    expect(c.status).toBe('cancelled');
  });

  it.each([403, 500])('does not fall back on %i', async (status) => {
    vi.stubGlobal('fetch', vi.fn(reply(status)));
    await expect(getPickups()).rejects.toBeInstanceOf(ApiError);
    expect(isCityCycleDemo()).toBe(false);
  });

  it('a 404 on a mutation against a live backend surfaces as an error', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(reply(200, []))
      .mockImplementation(reply(404, { detail: 'مش موجود' })));
    await getPickups();
    expect(isCityCycleDemo()).toBe(false);
    await expect(cancelPickup('RCY-9')).rejects.toMatchObject({ status: 404 });
    expect(isCityCycleDemo()).toBe(false);
  });

  it('handles a null avgResponseMinutes in the summary', async () => {
    vi.stubGlobal('fetch', vi.fn(reply(200, { totalKg: 10, tonnes: 0.01, pickups: 2, avgResponseMinutes: null, byMaterial: [], byDistrict: [] })));
    const s = await getRecyclingSummary();
    expect(s.avgResponseMinutes).toBeNull();
    expect(s.totalKg).toBe(10);
  });
});

describe('page', () => {
  it('shows the demo notice, queue with cancel only, and collectors', async () => {
    wrap(<Page />);
    await waitFor(() => expect(screen.getByText('RCY-3001')).toBeInTheDocument());
    expect(screen.getByText(/البيانات هنا تجريبية/)).toBeInTheDocument();
    expect(screen.queryByText('قبول')).not.toBeInTheDocument();
    expect(screen.queryByText('إتمام')).not.toBeInTheDocument();
    expect(screen.getAllByText('إلغاء').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('tab', { name: 'الجامعون' }));
    await waitFor(() => expect(screen.getByText('محمود')).toBeInTheDocument());
  });
});

describe('prices', () => {
  it('lets an admin edit', async () => {
    wrap(<PricesSection isAdmin />);
    await waitFor(() => expect(screen.getByText('حفظ الأسعار')).toBeInTheDocument());
    expect(screen.getAllByRole('textbox')[0]).not.toHaveAttribute('readonly');
  });

  it('is read-only for staff', async () => {
    role = 'staff';
    wrap(<PricesSection isAdmin={false} />);
    await waitFor(() => expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0));
    for (const input of screen.getAllByRole('textbox')) expect(input).toHaveAttribute('readonly');
    expect(screen.queryByText('حفظ الأسعار')).not.toBeInTheDocument();
  });
});

describe('staff view', () => {
  it('hides Cancel for non-admin and tolerates a redacted address', async () => {
    vi.stubGlobal('fetch', vi.fn(reply(200, [
      { id: 'RCY-1', items: [], day: '2030-01-01', slot: 'morning', mode: 'free', status: 'requested', createdAt: '', location: {} },
      { id: 'RCY-2', items: [], day: '2030-01-01', slot: 'morning', mode: 'free', status: 'requested', createdAt: '' },
    ])));
    wrap(<PickupsSection isAdmin={false} />);
    await waitFor(() => expect(screen.getByText('RCY-2')).toBeInTheDocument());
    expect(screen.queryByText('إلغاء')).not.toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('shows Cancel for admin', async () => {
    wrap(<PickupsSection isAdmin />);
    await waitFor(() => expect(screen.getAllByText('إلغاء').length).toBeGreaterThan(0));
  });

  it('disables price save when the list is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(reply(200, [])));
    wrap(<PricesSection isAdmin />);
    await waitFor(() => expect(screen.getByText('حفظ الأسعار')).toBeDisabled());
  });
});

describe('routes and payouts tabs', () => {
  it('hides the route planner tab from staff but keeps payouts', async () => {
    role = 'staff';
    wrap(<Page />);
    expect(screen.queryByRole('tab', { name: 'مسارات الجمع' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'مستحقات الجامعين' })).toBeInTheDocument();
  });

  it('shows the planner tab to admins', () => {
    wrap(<Page />);
    expect(screen.getByRole('tab', { name: 'مسارات الجمع' })).toBeInTheDocument();
  });

  it('renders demo payout rows from recorded weights when the route is missing', async () => {
    wrap(<Page />);
    await userEvent.click(screen.getByRole('tab', { name: 'مستحقات الجامعين' }));
    const row = (await screen.findByText('محمود')).closest('tr')!;
    expect(row).toHaveTextContent('7.5');
    expect(screen.getByText('الإجمالي')).toBeInTheDocument();
    expect(screen.getByText(/النظام مش بيدفع فلوس/)).toBeInTheDocument();
  });

  it('shows an error for a forbidden payouts request', async () => {
    vi.stubGlobal('fetch', vi.fn(reply(403)));
    wrap(<Page />);
    await userEvent.click(screen.getByRole('tab', { name: 'مستحقات الجامعين' }));
    expect(await screen.findByText('مقدرناش نحمّل المستحقات.')).toBeInTheDocument();
  });
});

describe('collectors tab permissions', () => {
  const collectors = [
    { id: 'COL-9', userId: 'u', name: 'منى علي', district: 'مدينة نصر', status: 'pending', materials: [], joinedAt: '' },
  ];

  it('hides verify/suspend buttons from department staff (the API is admin-only)', async () => {
    vi.stubGlobal('fetch', vi.fn(reply(200, collectors)));
    wrap(<CollectorsSection isAdmin={false} />);
    await waitFor(() => expect(screen.getByText('منى علي')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'توثيق' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'إيقاف' })).not.toBeInTheDocument();
  });

  it('shows verify/suspend buttons to admins', async () => {
    vi.stubGlobal('fetch', vi.fn(reply(200, collectors)));
    wrap(<CollectorsSection isAdmin />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'توثيق' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'إيقاف' })).toBeInTheDocument();
  });
});
