'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHead, FilterChipGroup, FilterChip, Card, ErrorState, Skeleton } from '@/components/ui';
import { getDashboard, getInsights } from '@/services/dashboard';
import { getIncidents } from '@/services/incidents';
import { useSession } from '@/lib/session';
import { formatLongDate, formatRelative } from '@/lib/format';
import { OverviewKpis } from '@/components/overview/OverviewKpis';
import { OpenByCategory } from '@/components/overview/OpenByCategory';
import { StatusChart } from '@/components/overview/StatusChart';
import { OverdueList } from '@/components/overview/OverdueList';
import { DepartmentsWorkload } from '@/components/overview/DepartmentsWorkload';
import { MapPreview } from '@/components/overview/MapPreview';
import { ActivityFeed } from '@/components/overview/ActivityFeed';
import { AiInsightCard } from '@/components/overview/AiInsightCard';

export default function OverviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useSession();

  const urlRange = searchParams.get('range');
  const range: 'today' | '7d' | '30d' =
    urlRange === 'today' || urlRange === '7d' || urlRange === '30d' ? urlRange : '7d';
  const [search, setSearch] = useState('');

  // Update URL when range changes (range is derived from the URL)
  const handleRangeChange = (newRange: 'today' | '7d' | '30d') => {
    router.push(`/?range=${newRange}`);
  };

  // Fetch dashboard data
  const {
    data: dashboard,
    isLoading: dashboardLoading,
    isError: dashboardError,
    refetch: refetchDashboard,
  } = useQuery({
    queryKey: ['dashboard', range],
    queryFn: () => getDashboard(range),
    staleTime: 30000,
  });

  // Fetch incidents for map preview
  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents', {}],
    queryFn: () => getIncidents({}),
    staleTime: 30000,
  });

  // Fetch AI insights
  const {
    data: insights,
    isError: insightsError,
  } = useQuery({
    queryKey: ['insights'],
    queryFn: getInsights,
    staleTime: 30000,
  });

  // Update document title
  useEffect(() => {
    document.title = 'CityFix — مركز القيادة: نظرة عامة';
  }, []);

  // Extract district name (after the · separator)
  const districtName = session?.district?.split(' · ').pop() || '';

  const handleSearch = () => {
    if (search.trim()) {
      router.push(`/incidents?q=${encodeURIComponent(search)}`);
    }
  };

  if (!session) return null;

  return (
    <div className="ftc-admin-main">
      <div className="page">
        {/* Page Head */}
        <PageHead
          title="نظرة عامة"
          subtitle={`${formatLongDate()} · ${districtName} · آخر تحديث ${formatRelative(dashboard?.nav ? new Date().toISOString() : '')}`}
          actions={
            <FilterChipGroup ariaLabel="الفترة">
              <FilterChip
                label="النهارده"
                pressed={range === 'today'}
                onClick={() => handleRangeChange('today')}
              />
              <FilterChip
                label="آخر 7 أيام"
                pressed={range === '7d'}
                onClick={() => handleRangeChange('7d')}
              />
              <FilterChip
                label="الشهر"
                pressed={range === '30d'}
                onClick={() => handleRangeChange('30d')}
              />
            </FilterChipGroup>
          }
          search={{
            value: search,
            onChange: setSearch,
            onSubmit: handleSearch,
            placeholder: 'ابحث برقم البلاغ أو الشارع',
            ariaLabel: 'ابحث في البلاغات',
          }}
        />

        {/* Error state for dashboard */}
        {dashboardError && (
          <Card>
            <ErrorState
              variant="error"
              title="حصلت مشكلة"
              onRetry={() => refetchDashboard()}
            />
          </Card>
        )}

        {/* KPIs */}
        <section aria-label="مؤشرات الأداء">
          <OverviewKpis
            dashboard={dashboard}
            range={range}
            loading={dashboardLoading}
          />
        </section>

        {/* AI Insight Card - Full width, only show if we have insights */}
        {insights && !insightsError && (
          <AiInsightCard insights={insights} />
        )}

        {/* Grid B: Open by category + Status */}
        <div className="grid-b">
          {dashboardLoading ? (
            <>
              <Card>
                <Skeleton variant="block" />
              </Card>
              <Card>
                <Skeleton variant="block" />
              </Card>
            </>
          ) : dashboard ? (
            <>
              <OpenByCategory
                data={dashboard.byCategory}
                open={dashboard.open}
                loading={dashboardLoading}
              />
              <StatusChart
                data={dashboard.byStatus}
                open={dashboard.open}
                resolved={dashboard.resolvedThisWeek}
                range={range}
                loading={dashboardLoading}
              />
            </>
          ) : null}
        </div>

        {/* Grid C: Overdue + Departments */}
        <div className="grid-c">
          {dashboardLoading ? (
            <>
              <Card>
                <Skeleton variant="block" />
              </Card>
              <Card>
                <Skeleton variant="block" />
              </Card>
            </>
          ) : dashboard ? (
            <>
              <OverdueList
                overdueList={dashboard.overdueList}
                overdueTotal={dashboard.overdueTotal}
                loading={dashboardLoading}
              />
              <DepartmentsWorkload
                departments={dashboard.departments}
                loading={dashboardLoading}
              />
            </>
          ) : null}
        </div>

        {/* Grid D: Map + Activity */}
        <div className="grid-d">
          {dashboardLoading ? (
            <>
              <Card>
                <Skeleton variant="block" />
              </Card>
              <Card>
                <Skeleton variant="block" />
              </Card>
            </>
          ) : dashboard ? (
            <>
              <MapPreview
                open={dashboard.open}
                incidents={incidents}
                loading={dashboardLoading}
              />
              <ActivityFeed
                activity={dashboard.activity}
                loading={dashboardLoading}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
