'use client';

import type L from 'leaflet';
import Link from 'next/link';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES, getCategory } from '@/domain/categories';
import { binDisplayName, binStateLabel, type Bin, type BinState } from '@/domain/citycycle';
import { departmentLabel, labelOfCategory, statusLabel, useLang, useTr } from '@/i18n';
import { services } from '@/services';
import { STATUS_LABEL_AR, type CategoryId, type IncidentStatus } from '@/domain/types';
import { MAP_STATUS_FILTERS, filterPins, incidentToPin, type MapStatusFilter } from '@/components/map-screen/filters';
import { isCriticalIncident, priorityReason } from '@/logic/priority';
import { useAreaCenter } from '@/lib/area';
import { refreshAll, useFollowingSet, useReports, useSession } from '@/store';
import { localDigits } from '@/utils/digits';
import { normalizeArabic } from '@/components/services/filter';
import { formatDistance, haversineM } from '@/utils/geo';
import { relativeTime } from '@/utils/time';
import { PinIcon } from '@/ui/brand';
import { Pills, SelectField } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { BIN_COLOR, BIN_ICON, BinSheet, BinStateChip } from '@/ui/citycycle';
import { BinMap, IncidentMap } from '@/ui/map';
import { pinColor, pinGlyph } from '@/ui/map/pinColor';
import { reportsCountAr } from '@/lib/plural';
import { StateMessage } from '@/ui/StateMessage';
import { CRITICAL_COLOR, STATUS_COLOR } from '@/ui/StatusChip';
import { usePageTitle } from '@/lib/usePageTitle';

const LEGEND: { id: string; ar: string; en: string; color: string }[] = [
  { id: 'received', ar: 'وصل', en: 'Received', color: STATUS_COLOR.received },
  { id: 'assigned', ar: 'اتحوّل', en: 'Assigned', color: STATUS_COLOR.assigned },
  { id: 'in_progress', ar: 'جاري التنفيذ', en: 'In progress', color: STATUS_COLOR.in_progress },
  { id: 'resolved', ar: 'اتصلّح', en: 'Fixed', color: STATUS_COLOR.resolved },
  { id: 'critical', ar: 'خطر', en: 'Danger', color: CRITICAL_COLOR },
];

const BIN_STATES: BinState[] = ['ok', 'full', 'hot', 'low_battery', 'offline'];

const CHIP_CLASS: Record<IncidentStatus, string> = {
  received: 'ftc-chip--received',
  triaged: 'ftc-chip--received',
  assigned: 'ftc-chip--assigned',
  in_progress: 'ftc-chip--progress',
  resolved: 'ftc-chip--resolved',
  closed: 'ftc-chip--received',
};

/** Status chip with the word in the current language (the shared StatusChip is Arabic only). */
function StatusWord({ status }: { status: IncidentStatus }) {
  return <span className={`ftc-chip ${CHIP_CLASS[status]}`}>{statusLabel(status, STATUS_LABEL_AR[status])}</span>;
}

type Layer = 'incidents' | 'bins';
type BinsState = 'idle' | 'loading' | 'ready' | 'error';

export default function MapPage() {
  const tr = useTr();
  const lang = useLang();
  const router = useRouter();
  usePageTitle(tr('الخريطة', 'Map'));
  const incidents = useReports((s) => s.incidents);
  const reports = useReports((s) => s.reports);
  const status = useReports((s) => s.status);
  const followIncident = useReports((s) => s.followIncident);
  const district = useSession((s) => s.district);
  const userId = useSession((s) => s.userId);
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

  const [layer, setLayer] = useState<Layer>('incidents');
  const [bins, setBins] = useState<Bin[]>([]);
  const [binsState, setBinsState] = useState<BinsState>('idle');
  const [binId, setBinId] = useState<string | null>(null);
  const [binBusy, setBinBusy] = useState(false);
  const [binResult, setBinResult] = useState<'sent' | 'error' | null>(null);

  const loadBins = useCallback(async () => {
    setBinsState('loading');
    try {
      setBins(await services.bins.list());
      setBinsState('ready');
    } catch {
      setBinsState('error');
    }
  }, []);
  const showLayer = (l: Layer) => {
    setLayer(l);
    if (l === 'bins' && binsState === 'idle') void loadBins();
  };
  const selectedBin = bins.find((b) => b.id === binId) ?? null;
  const selectBin = (id: string) => {
    setBinId(id);
    setBinResult(null);
    const b = bins.find((x) => x.id === id);
    if (b) map.current?.flyTo([b.location.lat, b.location.lng], Math.max(map.current.getZoom(), 16), { duration: 0.5 });
  };
  const reportFull = async () => {
    if (!selectedBin || !userId) return;
    setBinBusy(true);
    try {
      await services.bins.reportFull(userId, selectedBin.id, {});
      setBinResult('sent');
      void refreshAll();
    } catch {
      setBinResult('error');
    } finally {
      setBinBusy(false);
    }
  };
  const isBins = layer === 'bins';
  const reportsCount = (n: number) => (lang === 'en' ? (n === 0 ? 'No reports' : n === 1 ? '1 report' : `${n} reports`) : reportsCountAr(n));
  const binsCount = (n: number) => (n === 0 ? tr('مفيش صناديق', 'No bins') : tr(`${localDigits(n)} صندوق`, n === 1 ? '1 bin' : `${n} bins`));

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

  const statusOptions = MAP_STATUS_FILTERS.map((f) => ({ id: f.id, labelAr: lang === 'en' ? f.labelEn : f.labelAr }));

  return (
    <main className="m-wrap" id="main">
      <aside className="m-side" aria-label={tr('فلاتر الخريطة', 'Map filters')}>
        <div className="m-side__h">
          <h1>{tr('الخريطة', 'Map')}</h1>
          <p>{isBins ? binsCount(bins.length) : reportsCount(visible.length)} {tr('حوالين', 'around')} {district}</p>
        </div>
        <div className="m-filters">
          <div className="cc-layer" role="group" aria-label={tr('طبقة الخريطة', 'Map layer')}>
            <button type="button" className={`ftc-filter${!isBins ? ' is-active' : ''}`} aria-pressed={!isBins} onClick={() => showLayer('incidents')} data-testid="layer-incidents">
              <Icon name="alert-triangle" size={16} />{tr('البلاغات', 'Reports')}
            </button>
            <button type="button" className={`ftc-filter${isBins ? ' is-active' : ''}`} aria-pressed={isBins} onClick={() => showLayer('bins')} data-testid="layer-bins">
              <Icon name="trash" size={16} />{tr('صناديق ذكية', 'Smart bins')}
            </button>
          </div>
          {isBins ? (
            <div className="m-legend" aria-label={tr('دليل حالات الصناديق', 'Bin state key')}>
              {BIN_STATES.map((st) => (
                <span key={st} style={{ ['--cc-bin' as string]: BIN_COLOR[st] }}>
                  <span className="cc-legend-icon"><Icon name={BIN_ICON[st]} size={14} /></span>{binStateLabel(st)}
                </span>
              ))}
            </div>
          ) : (
            <>
              <div className="ftc-field">
                <span className="ftc-label" id="stl">{tr('الحالة', 'Status')}</span>
                <Pills options={statusOptions} value={statusFilter} onChange={setStatusFilter} labelledBy="stl" />
              </div>
              <SelectField
                id="cat"
                label={tr('نوع المشكلة', 'Problem type')}
                value={category}
                onChange={(v) => setCategory(v as CategoryId | 'all')}
                options={[{ value: 'all', label: tr('كل الأنواع', 'All types') }, ...CATEGORIES.map((c) => ({ value: c.id, label: labelOfCategory(c) }))]}
              />
              <div className="m-legend" aria-label={tr('دليل ألوان الدبابيس', 'Pin colour key')}>
                {LEGEND.map((l) => (
                  <span key={l.id}><i style={{ background: l.color }} />{tr(l.ar, l.en)}</span>
                ))}
              </div>
            </>
          )}
        </div>
        {isBins ? (
          <div className="m-list" role="list">
            {binsState === 'loading' ? <StateMessage loading title={tr('بنحمّل الصناديق…', 'Loading bins…')} /> : null}
            {binsState === 'error' ? (
              <StateMessage tone="error" icon="wifi" title={tr('مقدرناش نحمّل الصناديق', "We couldn't load the bins")} actionLabel={tr('جرّب تاني', 'Try again')} onAction={() => void loadBins()} />
            ) : null}
            {binsState === 'ready' && bins.length === 0 ? <p className="w-sub" style={{ padding: 10 }}>{tr('مفيش صناديق ذكية في المنطقة دلوقتي', 'No smart bins in the area right now')}</p> : null}
            {bins.map((b) => (
              <div role="listitem" key={b.id}>
                <button type="button" className={`m-item${b.id === selectedBin?.id ? ' is-sel' : ''}`} aria-pressed={b.id === selectedBin?.id} onClick={() => selectBin(b.id)} data-testid={`bin-item-${b.id}`}>
                  <span className="w-grow">
                    <span className="w-t">{binDisplayName(b)}</span>
                    <BinStateChip state={b.state} />
                  </span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="m-list" role="list">
            {status === 'ready' && visible.length === 0 ? <p className="w-sub" style={{ padding: 10 }}>{tr('مفيش بلاغات بالفلتر ده', 'No reports match this filter')}</p> : null}
            {visible.map((p) => (
              <div role="listitem" key={p.id}>
                <button type="button" className={`m-item${p.id === card?.id ? ' is-sel' : ''}`} aria-pressed={p.id === card?.id} onClick={() => select(p.id)} data-testid={`map-item-${p.id}`}>
                  <PinIcon className="pn" color={pinColor(p)} glyph={pinGlyph(p)} />
                  <span className="w-grow">
                    <span className="w-t">{p.title}</span>
                    <StatusWord status={p.status} />
                    {p.critical ? <span className="ftc-tag-danger" style={{ marginInlineStart: 4, height: 22 }}>{tr('خطر', 'Danger')}</span> : null}
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </aside>

      <section className="m-stage" aria-label={tr('خريطة المدينة', 'City map')}>
        {isBins ? (
          <BinMap bins={bins} selectedId={selectedBin?.id ?? null} onSelect={selectBin} center={center} onReady={onReady} />
        ) : (
          <IncidentMap pins={visible} selectedId={card?.id ?? null} onSelect={select} center={center} onReady={onReady} />
        )}
        {!isBins ? (
          <div className="m-top">
            <div className="search">
              <label className="w-sr" htmlFor="ms">{tr('ابحث عن شارع', 'Search for a street')}</label>
              <Icon name="search" size={20} />
              <input className="ftc-input" id="ms" type="search" placeholder={tr('ابحث عن شارع أو مكان', 'Search for a street or place')} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
        ) : null}
        <div className="m-zoom">
          <button type="button" aria-label={tr('تكبير', 'Zoom in')} onClick={() => map.current?.zoomIn()}><Icon name="plus" size={20} /></button>
          <button type="button" aria-label={tr('تصغير', 'Zoom out')} onClick={() => map.current?.zoomOut()}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M5 12h14" /></svg></button>
        </div>
        <button className="m-loc" type="button" aria-label={tr('منطقتي', 'My area')} onClick={() => map.current?.flyTo([center.lat, center.lng], 15, { duration: 0.5 })}><Icon name="locate" size={22} /></button>

        {!isBins && status === 'loading' && incidents.length === 0 ? (
          <div className="m-card"><StateMessage loading title={tr('بنحمّل الخريطة…', 'Loading the map…')} /></div>
        ) : null}
        {!isBins && status === 'error' && incidents.length === 0 ? (
          <div className="m-card"><StateMessage tone="error" icon="wifi" title={tr('مقدرناش نحمّل البلاغات', "We couldn't load the reports")} actionLabel={tr('جرّب تاني', 'Try again')} onAction={() => void refreshAll()} /></div>
        ) : null}
        {isBins && binsState === 'loading' ? (
          <div className="m-card"><StateMessage loading title={tr('بنحمّل الصناديق…', 'Loading bins…')} /></div>
        ) : null}
        {isBins && binsState === 'error' ? (
          <div className="m-card"><StateMessage tone="error" icon="wifi" title={tr('مقدرناش نحمّل الصناديق', "We couldn't load the bins")} actionLabel={tr('جرّب تاني', 'Try again')} onAction={() => void loadBins()} /></div>
        ) : null}

        {isBins && selectedBin ? (
          <div className="m-card cc-bin-card">
            <BinSheet bin={selectedBin} busy={binBusy} result={binResult} onReportFull={() => void reportFull()} onOpenRequests={() => router.push('/requests')} onClose={() => setBinId(null)} />
          </div>
        ) : null}

        {!isBins && card ? (
          <article className="m-card" aria-label={tr('تفاصيل البلاغ', 'Report details')} data-testid="pin-card">
            <div className="m-card__top">
              <span className={`ftc-icon-well${isCriticalIncident(card) ? ' ftc-icon-well--danger' : ''}`} style={{ width: 44, height: 44 }}><Icon name={getCategory(card.categoryId).icon} size={22} /></span>
              <h2>{card.title}</h2>
              <button className="x" type="button" aria-label={tr('إغلاق', 'Close')} onClick={() => setSelectedId(null)}><Icon name="x" size={18} /></button>
            </div>
            <div className="meta">
              {isCriticalIncident(card) ? <span className="ftc-chip ftc-chip--critical">{tr('خطر', 'Danger')}</span> : null}
              <StatusWord status={card.status} />
              <span>{localDigits(card.followers)} {tr('متابع', card.followers === 1 ? 'follower' : 'followers')}</span>
              <span>{tr(`${formatDistance(haversineM(center, card.location))} من منطقتك`, `${formatDistance(haversineM(center, card.location))} from your area`)}</span>
            </div>
            <dl>
              <dt>{tr('الجهة المسؤولة', 'Handled by')}</dt><dd>{departmentLabel(card.department)}</dd>
              <dt>{tr('الأولوية', 'Priority')}</dt><dd>{priorityReason(card.priority, card.linkedReportIds.length, card.sensitivePlace)}</dd>
              <dt>{tr('المكان', 'Location')}</dt><dd>{card.location.address}</dd>
              <dt>{tr('آخر تحديث', 'Last update')}</dt><dd>{relativeTime(card.updatedAt)}</dd>
            </dl>
            <div className="btns">
              <button className={`ftc-btn ${following ? 'ftc-btn--secondary' : 'ftc-btn--primary'}`} type="button" disabled={following || followBusy} onClick={() => void follow()} data-testid="pin-follow">
                {following ? <><Icon name="check" size={18} strokeWidth={2.5} />{tr('متابَع', 'Following')}</> : tr('أنا كمان', 'Me too')}
              </button>
              {myReport ? <Link className="ftc-btn ftc-btn--secondary" href={`/requests/${myReport.id}`}>{tr('تابع بلاغك', 'Track your report')}</Link> : null}
            </div>
            {followFailed ? <span className="a-err" role="alert">{tr('معرفناش نسجّل متابعتك، جرّب تاني.', "We couldn't save your follow. Try again.")}</span> : null}
          </article>
        ) : null}
        <span className="m-note">{tr('الخريطة من OpenStreetMap', 'Map by OpenStreetMap')}</span>
      </section>
    </main>
  );
}
