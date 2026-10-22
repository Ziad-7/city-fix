'use client';

import { useEffect, useMemo, useState } from 'react';
import type L from 'leaflet';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getIncidents } from '@/services/incidents';
import { getDepartments } from '@/services/departments';
import {
  PageHead,
  FilterChip,
  SelectField,
  TextField,
  Button,
  ErrorState,
  EmptyState,
  Skeleton,
  StatusChip,
  ScoreBadge,
  Notice,
  KvList,
  useToast,
} from '@/components/ui';
import { Icon } from '@/components/Icon';
import { incidentToPin, pinKind, pinSvg, filterPins, type PinKind } from '@/components/map/map-utils';
import { PERIOD_LABEL, PIN_KINDS, countByKind, inPeriod, searchIncidents, type Period } from '@/components/map/map-filters';
import { CATEGORIES } from '@/domain/categories';
import type { AdminIncident } from '@/domain/admin-types';
import type { IncidentStatus } from '@/domain/types';
import { priorityLevel, priorityReason } from '@/logic/priority';
import { formatRelative, formatWhen, formatDueLabel, hoursLateOf } from '@/lib/format';
import { ApiError } from '@/lib/http';
import { useSession } from '@/lib/session';

const MapView = dynamic(() => import('@/components/map/MapView').then((m) => ({ default: m.MapView })), {
  ssr: false,
  loading: () => <Skeleton variant="block" height={420} />,
});

const LEGEND_LABEL: Record<PinKind, string> = {
  received: 'وصل',
  assigned: 'اتحوّل',
  progress: 'جاري التنفيذ',
  resolved: 'اتصلّح',
  critical: 'خطر · محتاج تدخّل فوري',
};

const FILTER_LABEL: Record<PinKind, string> = {
  received: 'وصل',
  assigned: 'اتحوّل',
  progress: 'جاري التنفيذ',
  resolved: 'اتصلّح',
  critical: 'خطر',
};

const SUMMARY_STATUS: Record<Exclude<PinKind, 'critical'>, IncidentStatus> = {
  received: 'received',
  assigned: 'assigned',
  progress: 'in_progress',
  resolved: 'resolved',
};

const PERIODS: Period[] = ['7d', 'today', '30d', 'custom'];

function parseKinds(raw: string | null): Set<PinKind> {
  if (raw === null) return new Set(PIN_KINDS);
  return new Set(raw.split(',').filter((k): k is PinKind => (PIN_KINDS as string[]).includes(k)));
}

export default function MapPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const session = useSession();
  const toast = useToast();
  const isStaff = session?.role === 'staff';

  const [map, setMap] = useState<L.Map | null>(null);
  const [kinds, setKinds] = useState<Set<PinKind>>(() => parseKinds(searchParams.get('status')));
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') ?? '');
  const [department, setDepartment] = useState(searchParams.get('department') ?? '');
  const initialPeriod = searchParams.get('period') as Period | null;
  const [period, setPeriod] = useState<Period>(initialPeriod && PERIODS.includes(initialPeriod) ? initialPeriod : '7d');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('focus'));
  const [search, setSearch] = useState('');
  const [noMatch, setNoMatch] = useState(false);

  useEffect(() => {
    document.title = 'CityFix — مركز القيادة: الخريطة';
  }, []);

  // Filters and selection live in the URL.
  useEffect(() => {
    const qs = new URLSearchParams();
    qs.set('status', PIN_KINDS.filter((k) => kinds.has(k)).join(','));
    if (categoryId) qs.set('categoryId', categoryId);
    if (department) qs.set('department', department);
    qs.set('period', period);
    if (selectedId) qs.set('focus', selectedId);
    router.replace(`?${qs.toString()}`, { scroll: false });
  }, [kinds, categoryId, department, period, selectedId, router]);

  const effectiveDepartment = isStaff ? '' : department;

  const query = useQuery({
    queryKey: ['incidents', { categoryId, department: effectiveDepartment }],
    queryFn: () =>
      getIncidents({
        categoryId: categoryId || undefined,
        department: effectiveDepartment || undefined,
      }),
    staleTime: 30_000,
  });
  // If the backend returns open incidents only, also pull resolved ones and merge.
  const resolvedQuery = useQuery({
    queryKey: ['incidents', { categoryId, department: effectiveDepartment, status: 'resolved' }],
    queryFn: () =>
      getIncidents({
        status: 'resolved',
        categoryId: categoryId || undefined,
        department: effectiveDepartment || undefined,
      }),
    staleTime: 30_000,
  });
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: getDepartments,
    staleTime: Infinity,
  });

  const { isLoading, error, refetch, dataUpdatedAt } = query;

  // Failed background refetch while data is on screen: keep data, toast once.
  useEffect(() => {
    if (query.isRefetchError) toast.error('مقدرناش نحدّث البيانات. جرّب تاني.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.isRefetchError]);

  const dateError =
    period === 'custom' && fromDate && toDate && toDate <= fromDate ? 'التاريخ الأخير لازم يكون بعد الأول' : '';

  const incidents = useMemo(() => {
    const merged = new Map<string, AdminIncident>();
    [...(query.data ?? []), ...(resolvedQuery.data ?? [])].forEach((i) => merged.set(i.id, i));
    return Array.from(merged.values()).filter((i) => inPeriod(i, period, dateError ? '' : fromDate, dateError ? '' : toDate));
  }, [query.data, resolvedQuery.data, period, fromDate, toDate, dateError]);

  const counts = useMemo(() => countByKind(incidents), [incidents]);
  const pins = useMemo(() => filterPins(incidents.map(incidentToPin), Array.from(kinds)), [incidents, kinds]);
  const selected = incidents.find((i) => i.id === selectedId);

  const toggleKind = (k: PinKind) => {
    setKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const submitSearch = () => {
    const match = searchIncidents(incidents, search)[0];
    if (match) {
      setNoMatch(false);
      const k = pinKind(match);
      setKinds((prev) => (prev.has(k) ? prev : new Set(prev).add(k)));
      setSelectedId(match.id);
    } else {
      setNoMatch(search.trim().length > 0);
    }
  };

  const forbidden = error instanceof ApiError && error.status === 403;
  const updated = dataUpdatedAt ? formatRelative(new Date(dataUpdatedAt).toISOString()) : 'دلوقتي';
  const subtitle = `${session?.district ?? ''} · البلاغات المفتوحة والمحلولة ${PERIOD_LABEL[period]} · آخر تحديث ${updated}`;

  const deptOptions = [
    { value: '', label: 'كل الجهات' },
    ...departments.map((d) => ({ value: d.id, label: d.nameAr + (d.external ? ' · جهة خارجية' : '') })),
  ];

  return (
    <>
      <PageHead
        title="خريطة المدينة"
        subtitle={subtitle}
        search={{
          value: search,
          onChange: (v) => {
            setSearch(v);
            setNoMatch(false);
          },
          onSubmit: submitSearch,
          placeholder: 'ابحث برقم البلاغ أو الشارع',
          ariaLabel: 'ابحث في الخريطة',
        }}
      />
      {noMatch && (
        <p className="mini" role="status">
          مفيش بلاغ بالاسم ده
        </p>
      )}

      <section className="ftc-card filters" aria-label="فلاتر الخريطة">
        <div className="filter-group">
          <span id="fl-st" className="ftc-label">
            الحالة
          </span>
          <div className="chips" role="group" aria-labelledby="fl-st">
            {PIN_KINDS.map((k) => (
              <FilterChip key={k} label={FILTER_LABEL[k]} pressed={kinds.has(k)} onClick={() => toggleKind(k)} count={counts[k]} />
            ))}
          </div>
        </div>

        <div className="filter-group">
          <SelectField
            id="map-category"
            label="النوع"
            variant="pill"
            value={categoryId}
            onChange={setCategoryId}
            options={[
              { value: '', label: `كل الأنواع (${CATEGORIES.length})` },
              ...CATEGORIES.map((c) => ({ value: c.id, label: c.labelAr })),
            ]}
          />
        </div>

        <div className="filter-group">
          <SelectField
            id="map-department"
            label="الجهة"
            variant="pill"
            value={department}
            onChange={setDepartment}
            disabled={isStaff}
            options={deptOptions}
          />
        </div>

        <div className="filter-group">
          <SelectField
            id="map-period"
            label="الفترة"
            variant="pill"
            value={period}
            onChange={(v) => setPeriod(v as Period)}
            options={[
              { value: '7d', label: 'آخر 7 أيام' },
              { value: 'today', label: 'النهارده' },
              { value: '30d', label: 'آخر 30 يوم' },
              { value: 'custom', label: 'من تاريخ لتاريخ…' },
            ]}
          />
          {period === 'custom' && (
            <div className="date-range">
              <TextField type="date" id="map-from" label="من تاريخ" value={fromDate} onChange={setFromDate} />
              <TextField type="date" id="map-to" label="لحد تاريخ" value={toDate} onChange={setToDate} error={dateError || undefined} />
            </div>
          )}
        </div>
      </section>

      <div className="maplayout">
        {forbidden ? (
          <ErrorState variant="forbidden" />
        ) : error ? (
          <ErrorState variant="error" onRetry={() => refetch()} />
        ) : (
          <section className="mapframe" aria-label="الخريطة" aria-busy={isLoading}>
            {isLoading ? (
              <Skeleton variant="block" height={420} />
            ) : (
              <>
                <div style={{ height: 'clamp(420px, 66vh, 700px)' }}>
                  <MapView pins={pins} selectedId={selectedId} onSelect={setSelectedId} onMapReady={setMap} />
                </div>
                {pins.length === 0 && <div className="maptag">مفيش بلاغات بالفلاتر دي</div>}
                <div className="zoom">
                  <button type="button" aria-label="تكبير" onClick={() => map?.zoomIn()}>
                    +
                  </button>
                  <button type="button" aria-label="تصغير" onClick={() => map?.zoomOut()}>
                    −
                  </button>
                </div>
                <div className="legend" role="group" aria-label="دليل الدبابيس">
                  <span className="t">دليل الدبابيس</span>
                  {PIN_KINDS.map((k) => (
                    <span className="it" key={k}>
                      <span dangerouslySetInnerHTML={{ __html: pinSvg(k).replace('<svg ', '<svg width="20" height="19" ') }} />
                      {LEGEND_LABEL[k]}
                    </span>
                  ))}
                  <span className="it">
                    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                      <circle cx="10" cy="10" r="9" fill="#161616" />
                      <text x="10" y="14" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
                        8
                      </text>
                    </svg>
                    تجمّع بلاغات (قرّب عشان تفتحه)
                  </span>
                </div>
              </>
            )}
          </section>
        )}

        <div className="right-column" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isLoading ? (
            <section className="ftc-card" aria-busy="true">
              <Skeleton variant="title" />
              <Skeleton variant="line" />
              <Skeleton variant="line" />
            </section>
          ) : selected ? (
            <SelectedCard incident={selected} />
          ) : (
            <section className="ftc-card">
              <EmptyState icon="pin" title="اضغط على دبوس" message="هتشوف هنا تفاصيل البلاغ." />
            </section>
          )}

          <section className="ftc-card" aria-labelledby="h-sum">
            <h2 className="sec-title" id="h-sum">
              على الخريطة دلوقتي
            </h2>
            {isLoading ? (
              <div aria-busy="true">
                <Skeleton variant="line" />
                <Skeleton variant="line" />
              </div>
            ) : (
              <ul className="sum">
                {PIN_KINDS.map((k) => (
                  <li key={k}>
                    {k === 'critical' ? <StatusChip kind="critical" /> : <StatusChip kind="incident" status={SUMMARY_STATUS[k]} />}
                    <span className="n num" data-testid={`sum-${k}`}>
                      {counts[k]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mini">
              الدبابيس القريبة من بعض بتتجمّع في دايرة سودا بالعدد. بنحتفظ بالخريطة بسيطة عشان تشتغل على النت الضعيف.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

function SelectedCard({ incident }: { incident: AdminIncident }) {
  const critical = pinKind(incident) === 'critical';
  const level = priorityLevel(incident.priority.score);
  return (
    <section className="ftc-card sel" aria-labelledby="h-sel" style={{ border: '2px solid var(--ftc-gold)' }}>
      <div className="head">
        <span className="ftc-icon-well ftc-icon-well--danger">
          <Icon name="alert-triangle" />
        </span>
        <div>
          <h2 id="h-sel">{incident.title}</h2>
          <span className="mini num">
            {incident.id} · {incident.location.address}
          </span>
        </div>
      </div>
      <div className="chips">
        {critical && <StatusChip kind="critical" />}
        <StatusChip kind="incident" status={incident.status} />
      </div>
      {level !== 'low' && <Notice tone="danger">{priorityReason(incident.priority, incident.followers, incident.sensitivePlace)}</Notice>}
      <div className="score-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ScoreBadge score={incident.priority.score} size="lg" />
        <span className="small">
          من 100 · الميعاد {formatWhen(incident.dueAt)} ({formatDueLabel(hoursLateOf(incident.dueAt))})
        </span>
      </div>
      <hr className="ftc-divider" />
      <KvList
        items={[
          { label: 'الجهة', value: incident.department },
          { label: 'المُبلّغين', value: `${incident.followers} مواطنين`, numeric: true },
          { label: 'أمر الشغل', value: incident.workOrderId ?? 'لسه', numeric: !!incident.workOrderId },
        ]}
      />
      <div className="btn-split">
        <Button size="sm" href={`/incidents/${incident.id}`}>
          افتح البلاغ
        </Button>
        {incident.workOrderId ? (
          <Button variant="secondary" size="sm" href={`/work-orders?open=${incident.workOrderId}`}>
            افتح أمر الشغل
          </Button>
        ) : (
          <Button variant="secondary" size="sm" href={`/incidents/${incident.id}#work-order`}>
            أنشئ أمر شغل
          </Button>
        )}
      </div>
    </section>
  );
}
