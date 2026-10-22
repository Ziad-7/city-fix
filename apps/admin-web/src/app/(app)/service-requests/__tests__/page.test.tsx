import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AdminServiceRequest } from '@/domain/admin-types';
import { ToastProvider } from '@/components/ui';
import { cairoToday } from '@/components/service-requests/sr-utils';

const getServiceRequests = vi.fn();
const patchServiceRequest = vi.fn();
vi.mock('@/services/serviceRequests', () => ({
  getServiceRequests: (...a: unknown[]) => getServiceRequests(...a),
  patchServiceRequest: (...a: unknown[]) => patchServiceRequest(...a),
}));

import Page from '../page';

const today = cairoToday();

const mk = (o: Partial<AdminServiceRequest>): AdminServiceRequest => ({
  id: 'SRV-1',
  citizenId: 'c',
  serviceType: 'bulky_waste',
  details: { items: ['ثلاجة قديمة'], day: today, slot: 'morning', payment: 'cash' },
  location: { lat: 30, lng: 31, address: 'شارع الطيران' },
  status: 'received',
  timeline: [],
  createdAt: new Date().toISOString(),
  department: 'النظافة',
  paid: false,
  ...o,
});

const DATA = [
  mk({ id: 'SRV-1' }),
  mk({
    id: 'SRV-2',
    serviceType: 'tree_maintenance',
    location: { lat: 30, lng: 31, address: 'شارع الحجاز' },
    details: { items: ['تقليم شجرة'], day: '2030-01-01', slot: 'afternoon', payment: 'fawry' },
    status: 'assigned',
  }),
];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <Page />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getServiceRequests.mockReset();
  patchServiceRequest.mockReset();
  getServiceRequests.mockResolvedValue(DATA);
  patchServiceRequest.mockResolvedValue(DATA[0]);
});

describe('ServiceRequestsPage', () => {
  it('renders rows, chip counts and auto-selects the first row', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'SRV-1' });
    const table = screen.getByRole('table', { name: 'طلبات الخدمات' });
    expect(within(table).getByText('SRV-2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'الكل (2)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'صيانة أشجار (1)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'SRV-1' })).toBeInTheDocument();
  });

  it('filters by chip and shows empty state with a working clear button', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'SRV-1' });
    await user.click(screen.getByRole('button', { name: 'صيانة أشجار (1)' }));
    expect(screen.queryByText('SRV-1', { selector: 'span' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('ابحث في الطلبات'), 'zzz');
    expect(await screen.findByText('مفيش طلبات بالفلاتر دي')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'امسح الفلاتر' })[0]);
    expect(await screen.findByText('SRV-1', { selector: 'span' })).toBeInTheDocument();
  });

  it('requires a truck and a note, then patches status + assignee + note', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'SRV-1' });

    await user.click(screen.getByRole('button', { name: 'جدوِل العربية' }));
    expect(patchServiceRequest).not.toHaveBeenCalled();

    await user.selectOptions(screen.getByLabelText('العربية أو الفريق'), 'عربية نظافة 4');
    await user.click(screen.getByRole('button', { name: 'جدوِل العربية' }));
    expect(await screen.findByText('اكتب رسالة للمواطنين')).toBeInTheDocument();
    expect(patchServiceRequest).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('رسالة للمواطنين'), 'العربية جاية الصبح');
    await user.click(screen.getByRole('button', { name: 'جدوِل العربية' }));
    await waitFor(() =>
      expect(patchServiceRequest).toHaveBeenCalledWith('SRV-1', {
        status: 'assigned',
        note: 'العربية جاية الصبح',
        assignee: 'عربية نظافة 4',
      }),
    );
  });

  it('assigns a team without changing status or needing a note', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'SRV-1' });
    await user.click(screen.getByRole('button', { name: 'وزّع على فريق' }));
    expect(await screen.findByText('اختار الفريق أو العربية')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('العربية أو الفريق'), 'فريق مخلفات البناء 1');
    await user.click(screen.getByRole('button', { name: 'وزّع على فريق' }));
    await waitFor(() => expect(patchServiceRequest).toHaveBeenCalledWith('SRV-1', { assignee: 'فريق مخلفات البناء 1' }));
  });

  it('shows an error state with retry', async () => {
    getServiceRequests.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('حصلت مشكلة وإحنا بنحمّل البيانات')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'جرّب تاني' }));
    expect(await screen.findByRole('table', { name: 'طلبات الخدمات' })).toBeInTheDocument();
  });
});
