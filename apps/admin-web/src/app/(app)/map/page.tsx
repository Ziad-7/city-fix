'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { getIncidents } from '@/services/incidents';
import { getDepartments } from '@/services/departments';
import {
  PageHead,
  Card,
  FilterChip,
  SelectField,
  TextField,
  Button,
  ErrorState,
  EmptyState,
  Skeleton,
} from '@/components/ui';
import { Icon } from '@/components/Icon';
import { incidentToPin, filterPins, type MapPinModel, type PinKind, pinSvg, clusterIcon as clusterIconFn } from '@/components/map/map-utils';
import { formatRelative, formatDayDM } from '@/lib/format';
import { useSession } from '@/lib/session';
import type { AdminIncident } from '@/domain/admin-types';

const MapView = dynamic(() => import('@/components/map/MapView').then(m => ({ default: m.MapView })), {
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

interface FilterState {
  statuses: Set<PinKind>;
  categoryId?: string;
  department?: string;
  period: '7d' | 'today' | '30d' | 'custom';
  fromDate?: string;
  toDate?: string;
}

export default function MapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { district } = useSession();
  const [mapRef, setMapRef] = useState<any>(null);
  const [filters, setFilters] = useState<FilterState>({
    statuses: new Set(['received', 'assigned', 'progress', 'resolved', 'critical']),
    period: '7d',
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const focus = searchParams.get('focus');
    if (focus) setSelectedId(focus);
  }, [searchParams]);

  const { data: incidents = [], isLoading, error, refetch } = useQuery({
    queryKey: ['incidents', filters],
    queryFn: () =>
      getIncidents({
        categoryId: filters.categoryId,
        department: filters.department,
      }),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: getDepartments,
  });

  const pins = useMemo(() => {
    return incidents.filter(inc => {
      const statusArray = Array.from(filters.statuses);
      const pinKindMap: Record<string, PinKind> = {
        received: 'received',
        triaged: 'received',
        assigned: 'assigned',
        in_progress: 'progress',
        resolved: 'resolved',
        closed: 'resolved',
      };
      const kind = pinKindMap[inc.status] || 'received';

      // Check critical
      if (filters.statuses.has('critical') && inc.priority.score >= 85 && ['received', 'triaged', 'assigned', 'in_progress'].includes(inc.status)) {
        return true;
      }

      return statusArray.includes(kind);
    }).map(incidentToPin);
  }, [incidents, filters.statuses]);

  const selected = incidents.find(inc => inc.id === selectedId);

  const countByStatus = useMemo(() => {
    const counts: Record<PinKind, number> = { received: 0, assigned: 0, progress: 0, resolved: 0, critical: 0 };
    incidents.forEach(inc => {
      const statusMap: Record<string, PinKind> = {
        received: 'received',
        triaged: 'received',
        assigned: 'assigned',
        in_progress: 'progress',
        resolved: 'resolved',
        closed: 'resolved',
      };
      const kind = statusMap[inc.status] || 'received';
      if (inc.priority.score >= 85 && ['received', 'triaged', 'assigned', 'in_progress'].includes(inc.status)) {
        counts.critical++;
      } else {
        counts[kind]++;
      }
    });
    return counts;
  }, [incidents]);

  const handleStatusToggle = (status: PinKind) => {
    const newStatuses = new Set(filters.statuses);
    if (newStatuses.has(status)) {
      newStatuses.delete(status);
    } else {
      newStatuses.add(status);
    }
    setFilters({ ...filters, statuses: newStatuses });
  };

  const periodLabel = {
    '7d': 'آخر 7 أيام',
    today: 'النهارده',
    '30d': 'آخر 30 يوم',
    custom: 'في الفترة دي',
  }[filters.period];

  const dataUpdatedAt = new Date().toISOString();

  return (
    <main className="ftc-admin-main">
      <div className="page">
        <PageHead title="خريطة المدينة" subtitle={`${district} · البلاغات المفتوحة والمحلولة ${periodLabel} · آخر تحديث ${formatRelative(dataUpdatedAt)}`} />

        <section className="ftc-card filters" aria-label="فلاتر الخريطة">
          <div className="filter-group">
            <label id="fl-st">الحالة</label>
            <div className="chips" role="group" aria-labelledby="fl-st">
              {(['received', 'assigned', 'progress', 'resolved', 'critical'] as PinKind[]).map(status => (
                <FilterChip
                  key={status}
                  pressed={filters.statuses.has(status)}
                  onClick={() => handleStatusToggle(status)}
                  count={countByStatus[status]}
                >
                  {LEGEND_LABEL[status]}
                </FilterChip>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <SelectField
              label="النوع"
              id="category"
              value={filters.categoryId || ''}
              onChange={(v) => setFilters({ ...filters, categoryId: v || undefined })}
              options={[
                { value: '', label: 'كل الأنواع' },
                // Category options would be populated from API
              ]}
            />
          </div>

          <div className="filter-group">
            <SelectField
              label="الجهة"
              id="department"
              value={filters.department || ''}
              onChange={(v) => setFilters({ ...filters, department: v || undefined })}
              options={[
                { value: '', label: 'كل الجهات' },
                ...departments.map(d => ({ value: d.id, label: d.nameAr + (d.external ? ' · جهة خارجية' : '') })),
              ]}
            />
          </div>

          <div className="filter-group">
            <SelectField
              label="الفترة"
              id="period"
              value={filters.period}
              onChange={(v) => setFilters({ ...filters, period: v as FilterState['period'] })}
              options={[
                { value: '7d', label: 'آخر 7 أيام' },
                { value: 'today', label: 'النهارده' },
                { value: '30d', label: 'آخر 30 يوم' },
                { value: 'custom', label: 'من تاريخ لتاريخ…' },
              ]}
            />
            {filters.period === 'custom' && (
              <div className="date-range">
                <TextField type="date" label="من تاريخ" id="from-date" value={filters.fromDate || ''} onChange={(v) => setFilters({ ...filters, fromDate: v })} />
                <TextField type="date" label="لحد تاريخ" id="to-date" value={filters.toDate || ''} onChange={(v) => setFilters({ ...filters, toDate: v })} />
              </div>
            )}
          </div>
        </section>

        <div className="maplayout">
          <section className="mapframe" aria-label="الخريطة">
            {isLoading ? (
              <Skeleton variant="block" height={420} />
            ) : error ? (
              <ErrorState variant="error" action={<Button secondary onClick={() => refetch()}>جرّب تاني</Button>} />
            ) : pins.length === 0 ? (
              <div className="maptag">مفيش بلاغات بالفلاتر دي</div>
            ) : (
              <>
                <MapView pins={pins} selectedId={selectedId} onSelect={setSelectedId} onMapReady={setMapRef} />
                <div className="zoom">
                  <button type="button" aria-label="تكبير" onClick={() => mapRef?.zoomIn()}>
                    +
                  </button>
                  <button type="button" aria-label="تصغير" onClick={() => mapRef?.zoomOut()}>
                    −
                  </button>
                </div>
                <div className="legend" role="group" aria-label="دليل الدبابيس">
                  <span className="t">دليل الدبابيس</span>
                  {(['received', 'assigned', 'progress', 'resolved', 'critical'] as PinKind[]).map(k => (
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

          <div className="right-column">
            {selected ? (
              <section className="ftc-card sel" aria-labelledby="h-sel" style={{ border: '2px solid var(--ftc-gold)' }}>
                <div className="head">
                  <span className="ftc-icon-well ftc-icon-well--danger">
                    <Icon shape="alert-triangle" />
                  </span>
                  <div>
                    <h2 id="h-sel">{selected.title}</h2>
                    <span className="mini num">{selected.id} · {selected.location.address}</span>
                  </div>
                </div>
                <div className="chips">
                  {selected.priority.score >= 85 && <span className="ftc-chip ftc-chip--critical">خطر</span>}
                  <span className={`ftc-chip ftc-chip--${selected.status}`}>{selected.status}</span>
                </div>
                <span className="small">{selected.priority.score} من 100</span>
                <div className="kvlist">
                  <div className="kv">
                    <span className="k">الجهة</span>
                    <span className="v">{selected.department}</span>
                  </div>
                  <div className="kv">
                    <span className="k">المُبلّغين</span>
                    <span className="v">{selected.followers} مواطنين</span>
                  </div>
                </div>
                <div className="btn-split">
                  <Button primary sm href={`/incidents/${selected.id}`}>
                    افتح البلاغ
                  </Button>
                  {!selected.workOrderId && (
                    <Button secondary sm href={`/incidents/${selected.id}#work-order`}>
                      أنشئ أمر شغل
                    </Button>
                  )}
                </div>
              </section>
            ) : (
              <EmptyState icon="pin" title="اضغط على دبوس" message="هتشوف هنا تفاصيل البلاغ." />
            )}

            <section className="ftc-card" id="h-sum">
              <h3 className="sec-title">على الخريطة دلوقتي</h3>
              <ul className="sum">
                {(['received', 'assigned', 'progress', 'resolved', 'critical'] as PinKind[]).map(status => (
                  <li key={status}>
                    <span className={`ftc-chip ftc-chip--${status}`}></span>
                    <span className="n">{countByStatus[status]}</span>
                  </li>
                ))}
              </ul>
              <p className="mini">الدبابيس القريبة من بعض بتتجمّع في دايرة سودا بالعدد. بنحتفظ بالخريطة بسيطة عشان تشتغل على النت الضعيف.</p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
