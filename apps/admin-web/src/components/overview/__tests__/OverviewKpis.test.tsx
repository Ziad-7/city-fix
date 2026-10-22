import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OverviewKpis } from '../OverviewKpis';
import type { DashboardStats } from '@/domain/admin-types';

const mockDashboard: DashboardStats = {
  open: 42,
  openDelta: 5,
  overdue: 8,
  resolvedThisWeek: 12,
  resolvedDelta: -2,
  avgResolutionDays: 2.4,
  avgResolutionDeltaDays: 0.6,
  byCategory: [],
  byStatus: [],
  overdueList: [],
  overdueTotal: 8,
  departments: [],
  activity: [],
  nav: { incidentsOpen: 0, serviceRequestsOpen: 0 },
};

describe('OverviewKpis', () => {
  it('renders KPI values from dashboard', () => {
    render(
      <OverviewKpis
        dashboard={mockDashboard}
        range="7d"
        loading={false}
      />
    );

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('2.4 يوم')).toBeInTheDocument();
  });

  it('renders delta for open incidents', () => {
    render(
      <OverviewKpis
        dashboard={mockDashboard}
        range="7d"
        loading={false}
      />
    );

    expect(screen.getByText('+5')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    const { container } = render(
      <OverviewKpis
        dashboard={undefined}
        range="7d"
        loading={true}
      />
    );

    expect(container.querySelector('.ftc-skel')).toBeInTheDocument();
  });

  it('renders correct period label for 7d range', () => {
    const { container } = render(
      <OverviewKpis
        dashboard={mockDashboard}
        range="7d"
        loading={false}
      />
    );

    // Check that the period label appears anywhere in the component
    expect(container.textContent).toContain('الأسبوع اللي فات');
  });
});
