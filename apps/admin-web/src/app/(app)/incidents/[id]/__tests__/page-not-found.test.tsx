import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/http';

const { getIncident } = vi.hoisted(() => ({ getIncident: vi.fn() }));

vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'missing-id' }) }));
vi.mock('@/lib/session', () => ({ useSession: () => null }));
vi.mock('@/services/incidents', () => ({ getIncident, getSimilarIncidents: vi.fn() }));
vi.mock('@/services/workOrders', () => ({ getWorkOrder: vi.fn() }));
vi.mock('@/services/departments', () => ({ getDepartments: vi.fn().mockResolvedValue([]), getTeams: vi.fn().mockResolvedValue([]) }));

describe('IncidentDetailPage', () => {
  beforeEach(() => {
    getIncident.mockReset();
  });

  it('renders not-found for an API 404', async () => {
    getIncident.mockRejectedValue(new ApiError(404, 'not found'));
    const { default: IncidentDetailPage } = await import('../page');
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <IncidentDetailPage />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByText('مش موجود')).toBeInTheDocument(), { timeout: 4000 });
  });
});
