import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
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
vi.mock('@/services/incidents', () => ({
  getIncident: vi.fn(),
  getSimilarIncidents: vi.fn(),
  patchIncident: vi.fn().mockResolvedValue({}),
  confirmTriage: vi.fn().mockResolvedValue({}),
  mergeIncidents: vi.fn().mockResolvedValue({}),
}));
vi.mock('@/services/workOrders', () => ({
  getWorkOrder: vi.fn(),
  createWorkOrder: vi.fn().mockResolvedValue({ id: 'WO-77' }),
}));
vi.mock('@/services/departments', () => ({
  getDepartments: vi.fn().mockResolvedValue([
    { id: 'roads', nameAr: 'صيانة الطرق', external: false },
    { id: 'water', nameAr: 'شركة مياه الشرب', external: true, externalHotline: '125' },
  ]),
  getTeams: vi.fn().mockResolvedValue([
    { name: 'فريق الطرق 1', department: 'صيانة الطرق', size: 4 },
    { name: 'فريق الطرق 2', department: 'صيانة الطرق', size: 6 },
  ]),
}));

import { getIncident, getSimilarIncidents, patchIncident, confirmTriage, mergeIncidents } from '@/services/incidents';
import { createWorkOrder } from '@/services/workOrders';
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

const similar = {
  ...incident,
  id: 'INC-502',
  title: 'حفرة قريبة',
  createdAt: '2026-10-12T10:00:00.000Z',
  linkedReports: [incident.linkedReports[0]],
} as unknown as AdminIncident;

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

describe('IncidentDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(getIncident).mockResolvedValue(incident);
    vi.mocked(getSimilarIncidents).mockResolvedValue([similar]);
  });

  it('shows reporters only as مواطن / بلاغ بدون اسم', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'حفرة كبيرة' });
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    const reporters = rows.map((r) => within(r).getAllByRole('cell')[1].textContent);
    expect(reporters).toEqual(['مواطن', 'بلاغ بدون اسم']);
  });

  it('confirming the AI suggestion calls confirmTriage with the top option', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'أكّد التصنيف' }));
    await waitFor(() =>
      expect(confirmTriage).toHaveBeenCalledWith('INC-501', { categoryId: 'pothole', severity: 'high' }),
    );
  });

  it('status change requires a note, then patches status + note', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'حفرة كبيرة' });
    // default status is the next logical one (assigned)
    const submit = screen.getByRole('button', { name: /حدّث الحالة وابلّغ المواطنين/ });
    fireEvent.click(submit);
    expect(await screen.findByText('اكتب رسالة للمواطنين')).toBeInTheDocument();
    expect(patchIncident).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox', { name: /رسالة للمواطنين/ }), {
      target: { value: 'اتحوّل للجهة' },
    });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(patchIncident).toHaveBeenCalledWith('INC-501', { status: 'assigned', note: 'اتحوّل للجهة' }),
    );
  });

  it('creates a work order with department, team, teamSize and dueAt', async () => {
    renderPage();
    const team = await screen.findByLabelText('الفريق المسؤول');
    await screen.findByRole('option', { name: /فريق الطرق 2/ });
    fireEvent.change(team, { target: { value: 'فريق الطرق 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'أنشئ أمر شغل' }));
    await waitFor(() =>
      expect(createWorkOrder).toHaveBeenCalledWith({
        incidentId: 'INC-501',
        department: 'صيانة الطرق',
        team: 'فريق الطرق 2',
        teamSize: 6,
        dueAt: incident.dueAt,
      }),
    );
  });

  it('merge needs confirmation and merges the newer incident into the older one', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /ادمجهم/ }));
    expect(mergeIncidents).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'أكّد الدمج' }));
    await waitFor(() => expect(mergeIncidents).toHaveBeenCalledWith('INC-502', 'INC-501'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/incidents/INC-501'));
  });

  it('status form defaults to the next logical status of the current one', async () => {
    vi.mocked(getIncident).mockResolvedValue({ ...incident, status: 'in_progress' } as AdminIncident);
    renderPage();
    const select = (await screen.findByLabelText('الحالة الجديدة')) as HTMLSelectElement;
    expect(select.value).toBe('resolved');
  });

  it('shows a not-found state on 404', async () => {
    const err = Object.assign(new Error('nf'), { status: 404 });
    vi.mocked(getIncident).mockRejectedValue(err);
    renderPage();
    expect(await screen.findByText('مش موجود', {}, { timeout: 4000 })).toBeInTheDocument();
  });
});
