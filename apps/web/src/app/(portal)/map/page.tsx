'use client';

import type L from 'leaflet';
import Link from 'next/link';
import { useCallback, useMemo, useRef, useState } from 'react';
import { CATEGORIES, getCategory } from '@/domain/categories';
import type { CategoryId } from '@/domain/types';
import { MAP_STATUS_FILTERS, filterPins, incidentToPin, type MapStatusFilter } from '@/components/map-screen/filters';
import { isCriticalIncident, priorityReason } from '@/logic/priority';
import { useAreaCenter } from '@/lib/area';
import { refreshAll, useFollowingSet, useReports, useSession } from '@/store';
import { toArabicDigits } from '@/utils/digits';
import { normalizeArabic } from '@/components/services/filter';
import { formatDistanceAr, haversineM } from '@/utils/geo';
import { relativeTimeAr } from '@/utils/time';
import { PinIcon } from '@/ui/brand';
import { Pills, SelectField } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { IncidentMap } from '@/ui/map';
import { pinColor, pinGlyph } from '@/ui/map/pinColor';
import { reportsCountAr } from '@/lib/plural';
import { StateMessage } from '@/ui/StateMessage';
import { CRITICAL_COLOR, STATUS_COLOR, StatusChip, StatusChips } from '@/ui/StatusChip';
import { usePageTitle } from '@/lib/usePageTitle';

const LEGEND = [
  { label: 'وصل', color: STATUS_COLOR.received },
  { label: 'اتحوّل', color: STATUS_COLOR.assigned },
  { label: 'جاري التنفيذ', color: STATUS_COLOR.in_progress },
  { label: 'اتصلّح', color: STATUS_COLOR.resolved },
  { label: 'خطر', color: CRITICAL_COLOR },
];

export default function MapPage() {
  usePageTitle('الخريطة');
  const incidents = useReports((s) => s.incidents);
  const reports = useReports((s) => s.reports);
  const status = useReports((s) => s.status);
  const followIncident = useReports((s) => s.followIncident);
  const district = useSession((s) => s.district);
  const followed = useFollowingSet();
  const center = useAreaCenter();
  const map = useRef<L.Map | null>(null);
  const onReady = useCallback((m: L.Map) => {
    map.current = m;
  }, []);

  const [statusFilter, setStatusFilter] = useState<MapStatusFilter>('all');
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [followFailed, setFollowFailed] = useState(false);

  const pins = useMemo(() => incidents.map(incidentToPin), [incidents]);
  const visible = useMemo(() => {
    const q = normalizeArabic(query);
    const byId = new Map(incidents.map((i) => [i.id, i]));
    return filterPins(pins, statusFilter, category).filter((p) => {
      if (!q) return true;
      const i = byId.get(p.id);
      return normalizeArabic(`${p.title} ${i?.location.address ?? ''}`).includes(q);
    });
  }, [pins, incidents, statusFilter, category, query]);

  const selected = incidents.find((i) => i.id === selectedId) ?? null;
  // Hide the card when the filters remove the selected pin.
  const card = selected && visible.some((p) => p.id === selected.id) ? selected : null;
  const myReport = card ? reports.find((r) => r.incidentId === card.id) : undefined;

  const select = (id: string) => {
    setSelectedId(id);
    setFollowFailed(false);
    const p = pins.find((x) => x.id === id);
    if (p) map.current?.flyTo([p.lat, p.lng], Math.max(map.current.getZoom(), 16), { duration: 0.5 });
  };

  const follow = async () => {
    if (!card) return;
    setFollowBusy(true);
    setFollowFailed(false);
    try {
      await followIncident(card.id);
    } catch {
      setFollowFailed(true); // the button is available again
    } finally {
      setFollowBusy(false);
    }
  };

  const following = card ? followed.has(card.id) : false;

  return (
    <main className="m-wrap" id="main">
      <aside className="m-side" aria-label="فلاتر الخريطة">
        <div className="m-side__h"><h1>الخريطة</h1><p>{reportsCountAr(visible.length)} حوالين {district}</p></div>
        <div className="m-filters">
          <div className="ftc-field">
            <span className="ftc-label" id="stl">الحالة</span>
            <Pills options={MAP_STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} labelledBy="stl" />
          </div>
          <SelectField
            id="cat"
            label="نوع المشكلة"
            value={category}
            onChange={(v) => setCategory(v as CategoryId | 'all')}
            options={[{ value: 'all', label: 'كل الأنواع' }, ...CATEGORIES.map((c) => ({ value: c.id, label: c.labelAr }))]}
          />
          <div className="m-legend" aria-label="دليل ألوان الدبابيس">
            {LEGEND.map((l) => (
              <span key={l.label}><i style={{ background: l.color }} />{l.label}</span>
            ))}
          </div>
        </div>
        <div className="m-list" role="list">
          {status === 'ready' && visible.length === 0 ? <p className="w-sub" style={{ padding: 10 }}>مفيش بلاغات بالفلتر ده</p> : null}
          {visible.map((p) => (
            <div role="listitem" key={p.id}>
              <button type="button" className={`m-item${p.id === card?.id ? ' is-sel' : ''}`} aria-pressed={p.id === card?.id} onClick={() => select(p.id)} data-testid={`map-item-${p.id}`}>
                <PinIcon className="pn" color={pinColor(p)} glyph={pinGlyph(p)} />
                <span className="w-grow">
                  <span className="w-t">{p.title}</span>
                  <StatusChip status={p.status} />
                  {p.critical ? <span className="ftc-tag-danger" style={{ marginInlineStart: 4, height: 22 }}>خطر</span> : null}
                </span>
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section className="m-stage" aria-label="خريطة المدينة">
        <IncidentMap pins={visible} selectedId={card?.id ?? null} onSelect={select} center={center} onReady={onReady} />
        <div className="m-top">
          <div className="search">
            <label className="w-sr" htmlFor="ms">ابحث عن شارع</label>
            <Icon name="search" size={20} />
            <input className="ftc-input" id="ms" type="search" placeholder="ابحث عن شارع أو مكان" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        <div className="m-zoom">
          <button type="button" aria-label="تكبير" onClick={() => map.current?.zoomIn()}><Icon name="plus" size={20} /></button>
          <button type="button" aria-label="تصغير" onClick={() => map.current?.zoomOut()}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M5 12h14" /></svg></button>
        </div>
        <button className="m-loc" type="button" aria-label="منطقتي" onClick={() => map.current?.flyTo([center.lat, center.lng], 15, { duration: 0.5 })}><Icon name="locate" size={22} /></button>

        {status === 'loading' && incidents.length === 0 ? (
          <div className="m-card"><StateMessage loading title="بنحمّل الخريطة…" /></div>
        ) : null}
        {status === 'error' && incidents.length === 0 ? (
          <div className="m-card"><StateMessage tone="error" icon="wifi" title="مقدرناش نحمّل البلاغات" actionLabel="جرّب تاني" onAction={() => void refreshAll()} /></div>
        ) : null}

        {card ? (
          <article className="m-card" aria-label="تفاصيل البلاغ" data-testid="pin-card">
            <div className="m-card__top">
              <span className={`ftc-icon-well${isCriticalIncident(card) ? ' ftc-icon-well--danger' : ''}`} style={{ width: 44, height: 44 }}><Icon name={getCategory(card.categoryId).icon} size={22} /></span>
              <h2>{card.title}</h2>
              <button className="x" type="button" aria-label="إغلاق" onClick={() => setSelectedId(null)}><Icon name="x" size={18} /></button>
            </div>
            <div className="meta">
              <StatusChips status={card.status} critical={isCriticalIncident(card)} />
              <span>{toArabicDigits(card.followers)} متابع</span>
              <span>{formatDistanceAr(haversineM(center, card.location))} من منطقتك</span>
            </div>
            <dl>
              <dt>الجهة المسؤولة</dt><dd>{card.department}</dd>
              <dt>الأولوية</dt><dd>{priorityReason(card.priority, card.linkedReportIds.length, card.sensitivePlace)}</dd>
              <dt>المكان</dt><dd>{card.location.address}</dd>
              <dt>آخر تحديث</dt><dd>{relativeTimeAr(card.updatedAt)}</dd>
            </dl>
            <div className="btns">
              <button className={`ftc-btn ${following ? 'ftc-btn--secondary' : 'ftc-btn--primary'}`} type="button" disabled={following || followBusy} onClick={() => void follow()} data-testid="pin-follow">
                {following ? <><Icon name="check" size={18} strokeWidth={2.5} />متابَع</> : 'أنا كمان'}
              </button>
              {myReport ? <Link className="ftc-btn ftc-btn--secondary" href={`/requests/${myReport.id}`}>تابع بلاغك</Link> : null}
            </div>
            {followFailed ? <span className="a-err" role="alert">معرفناش نسجّل متابعتك، جرّب تاني.</span> : null}
          </article>
        ) : null}
        <span className="m-note">الخريطة من OpenStreetMap</span>
      </section>
    </main>
  );
}
