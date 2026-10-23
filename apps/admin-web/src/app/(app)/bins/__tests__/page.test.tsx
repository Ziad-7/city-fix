import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { BinForecast, SmartBin, SmartBinReading } from '@/domain/admin-types';
import { ToastProvider } from '@/components/ui';

vi.mock('@/services/bins', () => ({
  getSmartBins: vi.fn(),
  getSmartBinReadings: vi.fn(),
  getBinForecast: vi.fn(),
  registerBin: vi.fn(),
}));
let role = 'admin';
vi.mock('@/lib/session', () => ({ useSession: () => ({ role, district: 'x', name: 'a', title: 't' }) }));
vi.mock('@/services/departments', () => ({ getDepartments: () => Promise.resolve([{ id: 'd1', nameAr: 'النظافة', external: false }]) }));

import { getBinForecast, getSmartBinReadings, getSmartBins, registerBin } from '@/services/bins';
import SmartBinsPage from '../page';

const bin: SmartBin = {
  id: 'BIN-SENSOR-FAULT',
  name: 'حاوية تجريبية',
  district: 'القاهرة',
  lat: 30,
  lng: 31,
  isActive: true,
  isSimulated: true,
  fullPct: 80,
  heatC: 60,
  intervalMin: 30,
  lastSeq: 1,
  fillPct: 25,
  tempC: null,
  batteryV: null,
  isFull: false,
  isHot: false,
  lastSeenAt: '2026-10-22T18:00:00Z',
  status: 'normal',
};

const reading: SmartBinReading = {
  id: 1,
  binId: bin.id,
  seq: 1,
  recordedAt: '2026-10-22T18:00:00Z',
  receivedAt: '2026-10-22T18:00:01Z',
  fillPct: 25,
  distanceCm: 140,
  tempC: null,
  batteryV: null,
  deviceAt: null,
  clockUnsynced: true,
  isFull: false,
  isHot: false,
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SmartBinsPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

const forecast = (o: Partial<BinForecast['items'][number]>): BinForecast => ({
  generatedAt: '2026-10-22T18:00:00Z',
  horizonHours: 24,
  items: [{ binId: bin.id, currentFillPct: 25, predictedFillPct: 60, hoursToFull: 10, sampleCount: 6, method: 'linear', reason: 'ok', ...o }],
});

beforeEach(() => {
  role = 'admin';
  vi.mocked(getSmartBins).mockResolvedValue([bin]);
  vi.mocked(getSmartBinReadings).mockResolvedValue([reading]);
  vi.mocked(getBinForecast).mockResolvedValue(forecast({}));
  vi.mocked(registerBin).mockReset();
});

describe('SmartBinsPage optional sensor readings', () => {
  it('shows unavailable markers and the receive time for a clock-unsynced sensor-fault reading', async () => {
    vi.mocked(getSmartBins).mockResolvedValue([bin]);
    vi.mocked(getSmartBinReadings).mockResolvedValue([reading]);

    renderPage();

    const row = await screen.findByRole('row', { name: /#1/ });
    expect(within(row).getAllByText('—')).toHaveLength(4);
    expect(within(row).getByText(/وقت الجهاز غير متاح/)).toHaveTextContent('وقت الاستلام');
    expect(screen.queryByText(/undefined °م|undefined V/)).not.toBeInTheDocument();
  });
});

describe('SmartBinsPage forecast', () => {
  it('shows time to full, the 24h prediction, the KPI and the not-AI caption', async () => {
    renderPage();
    expect(await screen.findByText('10 ساعات')).toBeInTheDocument();
    expect(screen.getByText(/بعد 24 ساعة:/)).toHaveTextContent('60%');
    expect(screen.getByText(/مش ذكاء اصطناعي/)).toBeInTheDocument();
    expect(screen.getByText('هتمتلئ خلال 24 ساعة').parentElement).toHaveTextContent('1');
  });

  it('names the reason when there is no estimate', async () => {
    vi.mocked(getBinForecast).mockResolvedValue(forecast({ reason: 'stale', hoursToFull: null, predictedFillPct: null }));
    renderPage();
    expect(await screen.findByText('القراءات قديمة')).toBeInTheDocument();
  });

  it('shows a notice when the server has no forecast route', async () => {
    vi.mocked(getBinForecast).mockResolvedValue(null);
    renderPage();
    expect(await screen.findByText('السيرفر ده مفيهوش توقع الامتلاء، فالخانة فاضية.')).toBeInTheDocument();
  });
});

describe('SmartBinsPage registration', () => {
  it('hides the register button from staff', async () => {
    role = 'staff';
    renderPage();
    await screen.findByText(bin.name);
    expect(screen.queryByRole('button', { name: 'تسجيل حاوية' })).not.toBeInTheDocument();
  });

  it('shows the device key once and only lets the admin finish after confirming the copy', async () => {
    vi.mocked(registerBin).mockResolvedValue({ bin, deviceKey: 'SECRET-KEY-1' });
    const user = userEvent.setup();
    const { queryClient } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'تسجيل حاوية' }));
    await user.type(screen.getByLabelText('رقم الجهاز'), 'BIN-9');
    await user.type(screen.getByLabelText('اسم الحاوية'), 'حاوية جديدة');
    await user.type(screen.getByLabelText('خط العرض'), '30.05');
    await user.type(screen.getByLabelText('خط الطول'), '31.33');
    await user.click(screen.getByRole('button', { name: 'تسجيل' }));

    expect(await screen.findByText('SECRET-KEY-1')).toBeInTheDocument();
    // Focus moves into the key step, and the key never reaches the React Query caches.
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
    const cached = JSON.stringify([
      queryClient.getMutationCache().getAll().map((mu) => mu.state.data),
      queryClient.getQueryCache().getAll().map((qu) => qu.state.data),
    ]);
    expect(cached).not.toContain('SECRET-KEY-1');
    expect(vi.mocked(registerBin).mock.calls[0][0]).toMatchObject({ id: 'BIN-9', lat: 30.05, lng: 31.33, fullPct: 80, intervalMin: 30 });
    const done = screen.getByRole('button', { name: 'تم' });
    expect(done).toBeDisabled();
    await user.click(screen.getByLabelText('نسخت المفتاح'));
    expect(done).toBeEnabled();
    await user.click(done);
    await waitFor(() => expect(screen.queryByText('SECRET-KEY-1')).not.toBeInTheDocument());
  });

  it('shows the duplicate-id message on 409', async () => {
    const { ApiError } = await import('@/lib/http');
    vi.mocked(registerBin).mockRejectedValue(new ApiError(409, 'bin id already exists'));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'تسجيل حاوية' }));
    await user.type(screen.getByLabelText('رقم الجهاز'), 'BIN-9');
    await user.type(screen.getByLabelText('اسم الحاوية'), 'x');
    await user.type(screen.getByLabelText('خط العرض'), '30');
    await user.type(screen.getByLabelText('خط الطول'), '31');
    await user.click(screen.getByRole('button', { name: 'تسجيل' }));
    expect((await screen.findAllByText('الرقم ده مستخدم لحاوية تانية')).length).toBeGreaterThan(0);
  });
});
