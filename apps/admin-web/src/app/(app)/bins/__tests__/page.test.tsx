import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SmartBin, SmartBinReading } from '@/domain/admin-types';

vi.mock('@/services/bins', () => ({
  getSmartBins: vi.fn(),
  getSmartBinReadings: vi.fn(),
}));

import { getSmartBinReadings, getSmartBins } from '@/services/bins';
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
  return render(
    <QueryClientProvider client={queryClient}>
      <SmartBinsPage />
    </QueryClientProvider>,
  );
}

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
