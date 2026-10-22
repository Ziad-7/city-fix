import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AdminIncident } from '@/domain/admin-types';
import { ToastProvider } from '@/components/ui/Toast';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ id: 'INC-501' }),
}));
vi.mock('@/lib/session', () => ({
  useSession: () => ({
    role: 'admin',
    name: 'مدير',
    userId: 'u1',
    title: 't',
    district: 'd',
    token: 'x',
  }),
}));
vi.mock('@/lib/http', () => ({ http: vi.fn() }));
vi.mock('@/services/workOrders', () => ({ getWorkOrder: vi.fn(), createWorkOrder: vi.fn() }));
vi.mock('@/services/departments', () => ({
  getDepartments: vi.fn().mockResolvedValue([{ id: 'roads', nameAr: 'صيانة الطرق', external: false }]),
  getTeams: vi.fn().mockResolvedValue([]),
}));

import { http } from '@/lib/http';
import IncidentDetailPage from '../page';

const incident = {
  id: 'INC-501',
  categoryId: 'pothole',
  title: 'حفرة كبيرة',
  severity: 'high',
  priority: { score: 78, factors: [{ key: 'severity', label: 'خطورة المشكلة', points: 20, max: 30 }] },
  status: 'received',
  department: 'صيانة الطرق',
  estimatedCostEgp: 1800,
  linkedReportIds: ['R1', 'R2'],
  followers: 2,
  location: { address: 'شارع النصر', lat: 30.05, lng: 31.3 },
  areaUnderserved: false,
  timeline: [],
  createdAt: '2026-10-10T10:00:00.000Z',
  updatedAt: '2026-10-10T10:00:00.000Z',
  linkedReports: [
    { id: 'R1', reporter: 'مواطن', description: 'حفرة', source: 'app', photoCount: 1, createdAt: '2026-10-10T10:00:00.000Z' },
    { id: 'R2', reporter: 'بلاغ بدون اسم', description: 'حفرة تانية', source: 'web', photoCount: 0, createdAt: '2026-10-11T10:00:00.000Z' },
  ],
  triage: {
    options: [{ categoryId: 'pothole', confidence: 0.91 }],
    severity: 'high',
    summary: 'حفرة في الطريق',
    source: 'model',
    confirmed: false,
  },
  dueAt: '2026-10-30T10:00:00.000Z',
  overdue: false,
  external: false,
  inBudgetPlan: false,
} as unknown as AdminIncident;

// Regression: the backend answers /similar with DuplicateMatch[] (no location); the page used to crash with
// "Cannot read properties of undefined (reading 'lat')". The real service layer runs here, only http is mocked.
const similarFull = { ...incident, id: 'INC-502', title: 'حفرة قريبة' };

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <IncidentDetailPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('IncidentDetailPage with a DuplicateMatch[] from /similar', () => {
  beforeEach(() => {
    vi.mocked(http).mockReset();
    vi.mocked(http).mockImplementation((async (_m: string, path: string) => {
      if (path === '/admin/incidents/INC-501') return incident;
      if (path === '/admin/incidents/INC-501/similar')
        return [{ incidentId: 'INC-502', title: 'حفرة قريبة', categoryId: 'pothole', distanceM: 40, followers: 1, status: 'received' }];
      if (path === '/admin/incidents/INC-502') return similarFull;
      return undefined;
    }) as never);
  });

  it('renders the incident and the merge suggestion instead of crashing', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'حفرة كبيرة' });
    expect(await screen.findByText(/INC-502/)).toBeTruthy();
  });
});
