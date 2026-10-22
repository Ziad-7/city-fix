import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui';
import { ApiError } from '@/lib/http';
import { resetCityCycleDemo, getPickups, patchPickup } from '@/services/citycycle';

vi.mock('@/lib/session', () => ({ useSession: () => ({ role: 'admin', district: 'x', name: 'a', title: 't' }) }));
vi.mock('@/services/bins', () => ({ getSmartBins: vi.fn().mockResolvedValue([]), getSmartBinReadings: vi.fn() }));

import Page from '../page';

const notFound = () => Promise.resolve(new Response('{"detail":"x"}', { status: 404 }));

beforeEach(() => {
  resetCityCycleDemo();
  vi.stubGlobal('fetch', vi.fn(notFound));
});

describe('CityCycle admin', () => {
  it('falls back to demo data when endpoints are missing and updates a pickup', async () => {
    const list = await getPickups();
    expect(list.length).toBeGreaterThan(0);
    const updated = await patchPickup(list[0].id, { status: 'accepted' });
    expect(updated.status).toBe('accepted');
  });

  it('rethrows non-missing errors', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('', { status: 500 }))));
    await expect(getPickups()).rejects.toBeInstanceOf(ApiError);
  });

  it('renders the pickups queue and the demo notice', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={qc}><ToastProvider><Page /></ToastProvider></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText('RCY-3001')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('tab', { name: 'الجامعون' }));
    await waitFor(() => expect(screen.getByText('محمود')).toBeInTheDocument());
  });
});
