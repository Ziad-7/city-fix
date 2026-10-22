import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import type { AdminServiceRequest } from '@/domain/admin-types';

const { getServiceRequestsMock } = vi.hoisted(() => ({ getServiceRequestsMock: vi.fn() }));
vi.mock('@/services/serviceRequests', () => ({ getServiceRequests: getServiceRequestsMock, patchServiceRequest: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('open=SRV-OPEN') }));

import ServiceRequestsPage from '../page';

describe('ServiceRequestsPage', () => {
  beforeEach(() => {
    getServiceRequestsMock.mockResolvedValue([{
      id: 'SRV-OPEN',
      citizenId: 'citizen-1',
      serviceType: 'bulky_waste',
      details: { items: ['chair'], day: '2026-10-22', slot: 'morning', payment: 'cash' },
      location: { lat: 30, lng: 31, address: 'Main Street' },
      status: 'received',
      timeline: [],
      createdAt: '2026-10-22T00:00:00Z',
      department: 'Sanitation',
      paid: false,
    } satisfies AdminServiceRequest]);
  });

  it('opens the request selected by the URL query', async () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider><ServiceRequestsPage /></ToastProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByRole('heading', { name: 'SRV-OPEN' })).toBeInTheDocument());
    expect(screen.getByText('chair')).toBeInTheDocument();
  });
});
