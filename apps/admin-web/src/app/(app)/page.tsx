'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHead, FilterChipGroup, FilterChip, Card, CardHead, ErrorState, Skeleton } from '@/components/ui';
import { Icon } from '@/components/Icon';
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

  const [range, setRange] = useState<'today' | '7d' | '30d'>('7d');
  const [search, setSearch] = useState('');

  // Sync range from URL
  useEffect(() => {
    const urlRange = searchParams.get('range') as 'today' | '7d' | '30d' | null;
    if (urlRange && ['today', '7d', '30d'].includes(urlRange)) {
      setRange(urlRange);
    }
  }, [searchParams]);

  // Update URL when range changes
  const handleRangeChange = (newRange: 'today' | '7d' | '30d') => {
    setRange(newRange);
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
    document.title = 'FixTheCity — مركز القيادة: نظرة عامة';
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
    <main className="ftc-admin-main">
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
        <section className="kpis" aria-label="مؤشرات الأداء">
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
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: '20px' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '20px' }}>
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
    </main>
  );
}
