'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getServiceRequests } from '@/services/serviceRequests';
import {
  Button,
  DataTable,
  Delta,
  EmptyState,
  ErrorState,
  FilterChip,
  KpiCard,
  PageHead,
  SelectField,
  Skeleton,
  StatusChip,
  useToast,
  type Column,
} from '@/components/ui';
import { Icon } from '@/components/Icon';
import { SrDetailPanel } from '@/components/service-requests/SrDetailPanel';
import {
  EMPTY_FILTERS,
  chipCounts,
  computeKpis,
  filterRequests,
  paymentLabel,
  type SrFilters,
} from '@/components/service-requests/sr-utils';
import type { AdminServiceRequest } from '@/domain/admin-types';
import { SERVICE_TYPE_LABEL_AR } from '@/lib/text';
import { ApiError } from '@/lib/http';
import { formatDayDM, formatLongDate, formatSlot } from '@/lib/format';

const PAYMENT_OPTIONS = [
  { value: '', label: 'كل طرق الدفع' },
  { value: 'cash', label: 'كاش مع العامل' },
  { value: 'fawry', label: 'فوري' },
  { value: 'instapay', label: 'إنستاباي' },
  { value: 'wallet', label: 'محفظة موبايل' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'كل الحالات' },
  { value: 'received', label: 'وصل' },
  { value: 'assigned', label: 'اتحوّل' },
  { value: 'in_progress', label: 'جاري التنفيذ' },
  { value: 'resolved', label: 'اتصلّح' },
];

export default function ServiceRequestsPage() {
  const toast = useToast();
  const [filters, setFilters] = useState<SrFilters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    document.title = 'CityFix — مركز القيادة: طلبات الخدمات';
  }, []);

  const query = useQuery({
    queryKey: ['service-requests'],
    queryFn: () => getServiceRequests(),
    staleTime: 30_000,
  });
  const { data, isLoading, error, refetch } = query;
  const requests = useMemo(() => data ?? [], [data]);

  useEffect(() => {
    if (query.isRefetchError) toast.error('مقدرناش نحدّث البيانات. جرّب تاني.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.isRefetchError]);

  const counts = useMemo(() => chipCounts(requests, now), [requests, now]);
  const kpis = useMemo(() => computeKpis(requests, now), [requests, now]);
  const rows = useMemo(() => filterRequests(requests, filters, now), [requests, filters, now]);
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0];

  const set = (patch: Partial<SrFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const columns: Column<AdminServiceRequest>[] = [
    {
      id: 'request',
      header: 'الطلب',
      cell: (r) => (
        <div className="type">
          <span className="ftc-icon-well">
            <Icon name={r.serviceType === 'bulky_waste' ? 'trash' : 'tree'} size={18} />
          </span>
          <div>
            <span className="strong num">{r.id}</span>
            <span className="mini" style={{ display: 'block' }}>
              {SERVICE_TYPE_LABEL_AR[r.serviceType]}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'address',
      header: 'العنوان والجهة',
      cell: (r) => (
        <>
          {r.location.address}
          <span className="mini" style={{ display: 'block' }}>
            {r.department}
          </span>
        </>
      ),
    },
    {
      id: 'when',
      header: 'اليوم والفترة',
      nowrap: true,
      cell: (r) => (
        <>
          {formatDayDM(r.details.day, now)}
          <span className="mini num" style={{ display: 'block' }}>
            {formatSlot(r.details.slot)}
          </span>
        </>
      ),
    },
    { id: 'payment', header: 'الدفع', nowrap: true, cell: (r) => paymentLabel(r) },
    { id: 'status', header: 'الحالة', cell: (r) => <StatusChip kind="incident" status={r.status} /> },
  ];

  const forbidden = error instanceof ApiError && error.status === 403;
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  const empty =
    requests.length === 0 ? (
      <EmptyState icon="truck" title="مفيش طلبات خدمات" message="الطلبات الجديدة هتظهر هنا." />
    ) : (
      <EmptyState
        icon="truck"
        title="مفيش طلبات بالفلاتر دي"
        message="غيّر الفلاتر أو امسحها."
        action={
          <Button variant="secondary" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
            امسح الفلاتر
          </Button>
        }
      />
    );

  const chip = (value: SrFilters['chip'], label: string, n: number) => (
    <FilterChip
      label={`${label} (${n})`}
      pressed={filters.chip === value}
      onClick={() => set({ chip: value })}
    />
  );

  return (
    <>
      <PageHead
        title="طلبات الخدمات"
        subtitle={`CityServe · رفع مخلفات كبيرة وصيانة أشجار بميعاد · ${formatLongDate(now)}`}
        search={{
          value: filters.q,
          onChange: (q) => set({ q }),
          placeholder: 'ابحث برقم الطلب أو الشارع',
          ariaLabel: 'ابحث في الطلبات',
        }}
      />

      {forbidden ? (
        <ErrorState variant="forbidden" />
      ) : (
        <>
          <div className="mini-kpis">
            <KpiCard size="md" loading={isLoading} label="طلبات جديدة" value={kpis.fresh} note="محتاجة جدولة" />
            <KpiCard
              size="md"
              loading={isLoading}
              label="متجدولة النهارده"
              value={kpis.today}
              note={`${kpis.todayInProgress} جاري التنفيذ`}
            />
            <KpiCard
              size="md"
              loading={isLoading}
              label="مستنية تأكيد دفع"
              value={kpis.awaitingPayment}
              note="فوري وإنستاباي"
            />
            <KpiCard
              size="md"
              loading={isLoading}
              label="اتنفّذت الأسبوع ده"
              value={kpis.doneThisWeek}
              note={
                kpis.doneLastWeek > 0 ? (
                  <>
                    <Delta value={kpis.doneThisWeek - kpis.doneLastWeek} /> عن الأسبوع اللي فات
                  </>
                ) : undefined
              }
              noteTone={kpis.doneThisWeek - kpis.doneLastWeek > 0 ? 'good' : 'mute'}
            />
          </div>

          <div className="fbar" role="group" aria-label="فلاتر">
            {chip('all', 'الكل', counts.all)}
            {chip('bulky_waste', 'رفع مخلفات كبيرة', counts.bulky_waste)}
            {chip('tree_maintenance', 'صيانة أشجار', counts.tree_maintenance)}
            {chip('today', 'النهارده', counts.today)}
            <SelectField
              id="sr-payment"
              label="طريقة الدفع"
              variant="pill"
              value={filters.payment}
              onChange={(payment) => set({ payment })}
              options={PAYMENT_OPTIONS}
            />
            <SelectField
              id="sr-status"
              label="الحالة"
              variant="pill"
              value={filters.status}
              onChange={(status) => set({ status })}
              options={STATUS_OPTIONS}
            />
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                امسح الفلاتر
              </Button>
            )}
          </div>

          <div className="sr-layout">
            {error ? (
              <section className="ftc-card">
                <ErrorState variant="error" onRetry={() => refetch()} />
              </section>
            ) : (
              <section className="ftc-card" style={{ padding: 0 }}>
                <DataTable
                  ariaLabel="طلبات الخدمات"
                  tableClassName="sr-table"
                  minWidth={640}
                  columns={columns}
                  rows={rows}
                  getRowId={(r) => r.id}
                  selectedId={selected?.id ?? null}
                  onSelect={(r) => setSelectedId(r.id)}
                  loading={isLoading}
                  skeletonRows={6}
                  empty={empty}
                />
              </section>
            )}

            {isLoading ? (
              <aside className="ftc-card" aria-busy="true">
                <Skeleton variant="title" />
                <Skeleton variant="line" />
                <Skeleton variant="block" height={120} />
              </aside>
            ) : error ? null : selected ? (
              <SrDetailPanel key={selected.id} request={selected} all={requests} />
            ) : (
              <aside className="ftc-card">
                <EmptyState icon="truck" title="اختار طلب من القائمة" />
              </aside>
            )}
          </div>
        </>
      )}
    </>
  );
}
