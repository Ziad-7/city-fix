'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  PageHead,
  KpiCard,
  FilterChip,
  SelectField,
  DataTable,
  type Column,
  Card,
  ScoreBadge,
  StatusChip,
  DangerTag,
  KvList,
  Button,
  PriorityBreakdown,
  EmptyState,
  ErrorState,
  SkeletonTable,
} from '@/components/ui';
import { Icon } from '@/components/Icon';
import { getIncidents } from '@/services/incidents';
import { getDashboard } from '@/services/dashboard';
import { getWorkOrder } from '@/services/workOrders';
import { getDepartments } from '@/services/departments';
import { useSession } from '@/lib/session';
import { CATEGORIES, getCategory } from '@/domain/categories';
import { isOpenStatus } from '@/domain/types';
import { priorityLevel } from '@/logic/priority';
import { SEVERITY_AI_AR } from '@/lib/text';
import {
  formatSpan,
  formatRelative,
  shortAddress,
  formatDayDM,
} from '@/lib/format';
import { StatusChangeForm } from '@/components/incidents/StatusChangeForm';
import { patchIncident } from '@/services/incidents';
import { getNextIncidentStatuses } from '@/logic/status-flow';
import type { AdminIncident } from '@/domain/admin-types';
import type { IncidentStatus } from '@/domain/types';

const INCIDENT_STATUS_OPTIONS: Record<string, string> = {
  '': 'المفتوحة',
  received: 'وصل',
  triaged: 'اتصنّف',
  assigned: 'اتحوّل',
  in_progress: 'جاري التنفيذ',
  resolved: 'اتصلّح',
  closed: 'اتقفل',
  all: 'كل الحالات',
};

export default function IncidentsPage() {
  return (
    <Suspense fallback={null}>
      <IncidentsPageInner />
    </Suspense>
  );
}

const VIEWS = ['all', 'high', 'critical', 'overdue', 'budget'] as const;
type View = (typeof VIEWS)[number];

function IncidentsPageInner() {
  const searchParams = useSearchParams();
  const session = useSession();
  const [view, setView] = useState<View>(() => {
    const v = searchParams?.get('view');
    return (VIEWS as readonly string[]).includes(v ?? '') ? (v as View) : 'all';
  });
  const [status, setStatus] = useState<'open' | 'all' | IncidentStatus>('open');
  const [categoryId, setCategoryId] = useState('');
  const [department, setDepartment] = useState('');
  const [search, setSearch] = useState(() => searchParams?.get('q') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams?.get('q') ?? '');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | undefined>();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Set document title
  useEffect(() => {
    document.title = 'FixTheCity — مركز القيادة: البلاغات';
  }, []);

  // Fetch data
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['dashboard', '7d'],
    queryFn: () => getDashboard('7d'),
    staleTime: 30000,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: getDepartments,
    staleTime: Infinity,
  });

  const { data: incidents = [], isLoading: incidentsLoading, error: incidentsError, refetch } = useQuery({
    queryKey: ['incidents', { status, categoryId, department, critical: view === 'critical', overdue: view === 'overdue', q: debouncedSearch }],
    queryFn: () =>
      getIncidents({
        status: status !== 'open' && status !== 'all' ? status : undefined,
        categoryId: categoryId || undefined,
        department: department || undefined,
        critical: view === 'critical' ? true : undefined,
        overdue: view === 'overdue' ? true : undefined,
        q: debouncedSearch || undefined,
      }),
    staleTime: 30000,
  });

  // Client-side filtering for high priority and budget
  const filteredIncidents = useMemo(() => {
    let result = incidents;

    if (view === 'high') {
      result = result.filter((inc) => {
        const level = priorityLevel(inc.priority.score);
        return level === 'high' || level === 'critical';
      });
    } else if (view === 'budget') {
      result = result.filter((inc) => inc.inBudgetPlan);
    }

    // Apply status filter: 'open' shows only open statuses, 'all' shows all
    if (status === 'open') {
      result = result.filter((inc) => isOpenStatus(inc.status));
    }
    // status === 'all' shows everything (already filtered by API if specific status)

    return result.slice(0, 100);
  }, [incidents, view, status]);

  const selectedIncident = filteredIncidents.find((inc) => inc.id === selectedIncidentId);
  const { data: workOrder } = useQuery({
    queryKey: ['work-order', selectedIncident?.workOrderId],
    queryFn: () => (selectedIncident?.workOrderId ? getWorkOrder(selectedIncident.workOrderId) : Promise.resolve(undefined)),
    enabled: !!selectedIncident?.workOrderId,
  });


  const handleClearFilters = () => {
    setView('all');
    setStatus('open');
    setCategoryId('');
    setDepartment('');
    setSearch('');
    setSelectedIncidentId(undefined);
  };

  const nextStatuses = selectedIncident ? getNextIncidentStatuses(selectedIncident.status) : [];
  const statusOptions = [
    { value: selectedIncident?.status || '', label: `${INCIDENT_STATUS_OPTIONS[selectedIncident?.status || '']} (الحالة الحالية)` },
    ...nextStatuses.map((s) => ({
      value: s,
      label: INCIDENT_STATUS_OPTIONS[s] || s,
    })),
  ];

  // KPI data
  const openCount = dashboard?.open ?? 0;
  const openDelta = dashboard?.openDelta ?? 0;
  const overdueCount = dashboard?.overdue ?? 0;
  const resolvedCount = dashboard?.resolvedThisWeek ?? 0;
  const avgResolutionDays = dashboard?.avgResolutionDays ?? 0;

  const columns: Column<AdminIncident>[] = [
    {
      id: 'priority',
      header: 'الأولوية',
      cell: (inc) => <ScoreBadge score={inc.priority.score} />,
      sortValue: (inc) => inc.priority.score,
    },
    {
      id: 'title',
      header: 'البلاغ',
      cell: (inc) => (
        <>
          <div>
            <Link href={`/incidents/${inc.id}`} className="ttl">
              {inc.title}
              {getCategory(inc.categoryId).danger && <DangerTag>خطر</DangerTag>}
            </Link>
          </div>
          <span className="mini num">{inc.id} · {shortAddress(inc.location.address)}</span>
        </>
      ),
    },
    {
      id: 'citizens',
      header: 'مواطنين',
      cell: (inc) => inc.linkedReports.length,
      sortValue: (inc) => inc.linkedReports.length,
    },
    {
      id: 'time',
      header: 'مفتوح / المستهدف',
      cell: (inc) => {
        const now = Date.now();
        const createdAt = new Date(inc.createdAt);
        const dueAt = new Date(inc.dueAt);
        const openMs = now - createdAt.getTime();
        const targetMs = dueAt.getTime() - createdAt.getTime();
        return (
          <span className={inc.overdue ? 'late-cell' : ''}>
            {formatSpan(openMs)} / {formatSpan(targetMs)}
            {inc.overdue && ' · متأخر'}
          </span>
        );
      },
      sortValue: (inc) => new Date(inc.createdAt).getTime(),
    },
    {
      id: 'status',
      header: 'الحالة',
      cell: (inc) => <StatusChip kind="incident" status={inc.status} />,
    },
    {
      id: 'department',
      header: 'الجهة',
      cell: (inc) => (
        <>
          <div>{inc.external ? inc.department || 'جهة خارجية' : inc.department}</div>
          {inc.external && inc.externalHotline && (
            <span className="mini" style={{ display: 'block' }}>
              جهة خارجية · {inc.externalHotline}
            </span>
          )}
        </>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHead
        title="قائمة البلاغات"
        subtitle={
          dashboard ? `مرتّبة حسب الأولوية · آخر تحديث ${formatRelative(new Date().toISOString())}` : undefined
        }
        search={{
          value: search,
          onChange: (v: string) => setSearch(v),
          placeholder: 'ابحث في البلاغات',
          ariaLabel: 'ابحث برقم البلاغ أو الشارع',
        }}
      />

      {/* KPIs */}
      {dashboardLoading ? (
        <div className="kpis kpis--auto">
          {[1, 2, 3, 4].map((i) => (
            <KpiCard key={i} label="" value="" loading />
          ))}
        </div>
      ) : (
        <div className="kpis kpis--auto">
          <KpiCard label="بلاغات مفتوحة" value={openCount} noteTone={openDelta > 0 ? 'bad' : 'good'} note={openDelta !== 0 ? `${openDelta > 0 ? '+' : ''}${openDelta}` : undefined} />
          <KpiCard label="متأخرة عن الميعاد" value={overdueCount} note={`من الـ ${openCount}`} noteTone={overdueCount > 0 ? 'bad' : 'good'} />
          <KpiCard label="اتحلّت الأسبوع ده" value={resolvedCount} />
          <KpiCard label="متوسط وقت الحل" value={`${avgResolutionDays.toFixed(1)} يوم`} />
        </div>
      )}

      {/* Filter row */}
      <Card padded={false} className="fbar">
        <div className="chips" role="group" aria-label="المشاهد">
          <FilterChip label="كل البلاغات" pressed={view === 'all'} onClick={() => { setView('all'); setStatus('open'); setCategoryId(''); setSelectedIncidentId(undefined); }} />
          <FilterChip label="أولوية عالية" pressed={view === 'high'} onClick={() => { setView('high'); setStatus('open'); setCategoryId(''); setSelectedIncidentId(undefined); }} />
          <FilterChip label="خطر" pressed={view === 'critical'} onClick={() => { setView('critical'); setStatus('open'); setCategoryId(''); setSelectedIncidentId(undefined); }} />
          <FilterChip label="متأخرة" pressed={view === 'overdue'} onClick={() => { setView('overdue'); setStatus('open'); setCategoryId(''); setSelectedIncidentId(undefined); }} />
          <FilterChip label="في خطة الميزانية" pressed={view === 'budget'} onClick={() => { setView('budget'); setStatus('open'); setCategoryId(''); setSelectedIncidentId(undefined); }} />
        </div>

        {/* Selects */}
        <SelectField
          id="status-select"
          label="الحالة"
          value={status}
          onChange={(v) => {
            setStatus(v as 'open' | 'all' | IncidentStatus);
            setSelectedIncidentId(undefined);
          }}
          options={[
            { value: 'open', label: 'الحالة: المفتوحة' },
            { value: 'received', label: 'وصل' },
            { value: 'triaged', label: 'اتصنّف' },
            { value: 'assigned', label: 'اتحوّل' },
            { value: 'in_progress', label: 'جاري التنفيذ' },
            { value: 'resolved', label: 'اتصلّح' },
            { value: 'closed', label: 'اتقفل' },
            { value: 'all', label: 'كل الحالات' },
          ]}
          variant="pill"
        />

        <SelectField
          id="category-select"
          label="النوع"
          value={categoryId}
          onChange={(v) => {
            setCategoryId(v);
            setSelectedIncidentId(undefined);
          }}
          options={[
            { value: '', label: 'النوع: كل الأنواع' },
            ...CATEGORIES.map((cat) => ({
              value: cat.id,
              label: cat.labelAr,
            })),
          ]}
          variant="pill"
        />

        {session?.role === 'admin' ? (
          <SelectField
            id="department-select"
            label="الجهة"
            value={department}
            onChange={(v) => {
              setDepartment(v);
              setSelectedIncidentId(undefined);
            }}
            options={[
              { value: '', label: 'الجهة: كل الجهات' },
              ...departments.map((d) => ({
                value: d.id,
                label: d.nameAr,
              })),
            ]}
            variant="pill"
          />
        ) : (
          <SelectField
            id="department-select"
            label="الجهة"
            value={session?.department || ''}
            onChange={() => {}}
            disabled
            options={[
              { value: session?.department || '', label: `الجهة: ${session?.department || '—'}` },
            ]}
            variant="pill"
          />
        )}
      </Card>

      {/* Main content */}
      <div className="inc-wrap">
        {/* Table card */}
        <Card className="inc-table-card" padded={false}>
          {incidentsError ? (
            <div className="ftc-body" style={{ padding: '24px' }}>
              <ErrorState
                variant="error"
                title="مقدرناش نحمّل البلاغات"
                onRetry={() => refetch()}
              />
            </div>
          ) : incidentsLoading ? (
            <table className="inc-table">
              <thead>
                <tr>
                  <th>الأولوية</th>
                  <th>البلاغ</th>
                  <th>مواطنين</th>
                  <th>مفتوح / المستهدف</th>
                  <th>الحالة</th>
                  <th>الجهة</th>
                </tr>
              </thead>
              <tbody>
                <SkeletonTable rows={6} cols={6} />
              </tbody>
            </table>
          ) : filteredIncidents.length === 0 ? (
            <div className="ftc-body" style={{ padding: '24px' }}>
              <EmptyState
                icon="search"
                title={incidents.length === 0 ? 'مفيش بلاغات مفتوحة' : 'مفيش بلاغات بالفلاتر دي'}
                message={incidents.length === 0 ? 'كل البلاغات اتحلّت.' : 'غيّر الفلاتر أو امسحها.'}
                action={
                  (view !== 'all' || (status !== 'open' && status !== 'all') || categoryId || department || search) ? (
                    <Button variant="secondary" size="sm" onClick={handleClearFilters}>
                      امسح الفلاتر
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              <DataTable<AdminIncident>
                ariaLabel="البلاغات"
                columns={columns}
                rows={filteredIncidents}
                getRowId={(inc) => inc.id}
                selectedId={selectedIncidentId}
                onSelect={(inc) => setSelectedIncidentId(inc.id)}
                tableClassName="inc-table"
                minWidth={640}
              />
              {filteredIncidents.length === 100 && incidents.length > 100 && (
                <p className="ftc-body-sm" style={{ color: 'var(--ftc-ink-muted)', padding: '12px 16px' }}>
                  بنعرض أول 100 بلاغ. ضيّق البحث بالفلاتر.
                </p>
              )}
            </>
          )}
        </Card>

        {/* Side panel */}
        <aside className="inc-aside" aria-label="تفاصيل البلاغ">
          {selectedIncident ? (
            <>
              <div className="head">
                <div style={{ flex: 1 }}>
                  <h2>{selectedIncident.title}</h2>
                  <span className="mini num">
                    {selectedIncident.id} · {shortAddress(selectedIncident.location.address)} · {selectedIncident.linkedReports.length} بلاغات مربوطة
                  </span>
                </div>
              </div>

              {/* Triage box */}
              {selectedIncident.triage && selectedIncident.triage.options.length > 0 && (
                <div className="aibox">
                  <div className="lab">
                    <Icon name="sparkles" size={16} />
                    اقتراح الذكاء الاصطناعي
                  </div>
                  <div className="line">
                    {getCategory(selectedIncident.triage.options[0].categoryId).labelAr} · {Math.round(selectedIncident.triage.options[0].confidence * 100)}% · {SEVERITY_AI_AR[selectedIncident.triage.severity || 'low']}
                  </div>
                  <span className="mini">
                    الجهة: {selectedIncident.department}
                  </span>
                  {selectedIncident.lastReviewedBy ? (
                    <span className="mini">راجعه: {selectedIncident.lastReviewedBy}</span>
                  ) : (
                    <span className="mini">لسه محدّش راجعه</span>
                  )}
                </div>
              )}

              {/* Priority breakdown */}
              <PriorityBreakdown variant="compact" priority={selectedIncident.priority} />

              {/* Work order summary */}
              {selectedIncident.workOrderId ? (
                workOrder ? (
                  <div className="wo-sum">
                    <span className="strong small">أمر الشغل {workOrder.id}</span>
                    <KvList
                      items={[
                        { label: 'الفريق', value: workOrder.team || '—' },
                        { label: 'الحالة', value: <StatusChip kind="workorder" status={workOrder.status} /> },
                        { label: 'التسليم', value: workOrder.dueAt ? formatDayDM(workOrder.dueAt) : '—' },
                      ]}
                    />
                    <Link href={`/work-orders?wo=${workOrder.id}`} className="ttl">
                      افتح أمر الشغل
                    </Link>
                  </div>
                ) : (
                  <div className="wo-sum" aria-busy="true">
                    <span className="strong small">أمر الشغل</span>
                    <p className="sr-only">جاري التحميل…</p>
                    <SkeletonTable rows={3} cols={2} />
                  </div>
                )
              ) : (
                <div className="wo-sum">
                  <span className="strong small">أمر الشغل</span>
                  <p className="mini">لسه مفيش أمر شغل للبلاغ ده</p>
                  <Link href={`/incidents/${selectedIncident.id}#work-order`}>
                    <Button variant="secondary" size="sm" block>
                      أنشئ أمر شغل
                    </Button>
                  </Link>
                </div>
              )}

              {/* Status change form */}
              <div>
                <span className="strong small">غيّر الحالة</span>
                <StatusChangeForm
                  key={`${selectedIncident.id}:${selectedIncident.status}`}
                  kind="incident"
                  currentStatus={selectedIncident.status}
                  options={statusOptions}
                  previewStatusFor={(value) => value as IncidentStatus}
                  citizensCount={selectedIncident.linkedReports.length}
                  compact
                  disabledReason={session?.role === 'staff' && session?.department && session.department !== selectedIncident.department ? 'ده بلاغ جهة تانية. تقدر تشوفه بس.' : undefined}
                  onSubmit={async ({ status: newStatus, note }) => {
                    await patchIncident(selectedIncident.id, { status: newStatus, note });
                  }}
                />
              </div>

              {/* Footer link */}
              <Link href={`/incidents/${selectedIncident.id}`}>
                <Button variant="secondary" size="sm" block>
                  افتح البلاغ
                </Button>
              </Link>
            </>
          ) : (
            <EmptyState
              icon="clipboard"
              title="اختار بلاغ من القائمة"
              message="هتشوف هنا سبب الأولوية وأمر الشغل."
            />
          )}
        </aside>
      </div>
    </div>
  );
}
