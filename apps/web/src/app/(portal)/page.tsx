'use client';

/* eslint-disable @next/next/no-img-element -- static design illustration */
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { getCategory } from '@/domain/categories';
import type { IconName, IncidentStatus } from '@/domain/types';
import { selectNearby } from '@/components/home/nearby';
import { neighbours } from '@/components/report/text';
import { isCriticalIncident } from '@/logic/priority';
import { useAreaCenter } from '@/lib/area';
import { refreshAll, useFollowingSet, useReports, useRequestItems, useSession } from '@/store';
import { formatDistance } from '@/utils/geo';
import { greeting } from '@/utils/time';
import { placeName, statusLabel, useTr } from '@/i18n';
import { Skyline } from '@/ui/brand';
import { SmartBinFigure } from '@/ui/citycycle';
import { SosGrid } from '@/ui/Hotlines';
import { Icon } from '@/ui/Icon';
import { RequestRow } from '@/ui/RequestRow';
import { StateMessage } from '@/ui/StateMessage';
import { DangerTag, STATUS_COLOR } from '@/ui/StatusChip';
import { usePageTitle } from '@/lib/usePageTitle';

const TILES: { icon: IconName; ar: string; en: string; href: string; testId: string }[] = [
  { icon: 'alert-triangle', ar: 'بلاغ عن مشكلة', en: 'Report a problem', href: '/report/category', testId: 'tile-report' },
  { icon: 'trash', ar: 'رفع مخلفات', en: 'Bulky waste', href: '/services/bulky-waste', testId: 'tile-bulky' },
  { icon: 'tree', ar: 'صيانة الشجر', en: 'Tree care', href: '/services/tree', testId: 'tile-tree' },
  { icon: 'map', ar: 'خريطة المدينة', en: 'City map', href: '/map', testId: 'tile-map' },
  { icon: 'clipboard', ar: 'طلباتي', en: 'My requests', href: '/requests', testId: 'tile-requests' },
  { icon: 'recycle', ar: 'تدوير', en: 'Recycling', href: '/services/recycling', testId: 'tile-recycling' },
  { icon: 'bulb', ar: 'إنارة الشوارع', en: 'Streetlights', href: '/report/new?category=streetlight_out', testId: 'tile-streetlight' },
  { icon: 'clock', ar: 'مواعيد جمع القمامة', en: 'Garbage collection times', href: '/services/garbage-schedule', testId: 'tile-garbage' },
  { icon: 'more', ar: 'كل الخدمات', en: 'All services', href: '/services', testId: 'tile-all' },
];

const LEGEND: { status: IncidentStatus; ar: string }[] = [
  { status: 'received', ar: 'وصل' },
  { status: 'assigned', ar: 'اتحوّل' },
  { status: 'in_progress', ar: 'جاري التنفيذ' },
  { status: 'resolved', ar: 'اتصلّح' },
];

export default function HomePage() {
  const tr = useTr();
  usePageTitle(tr('الرئيسية', 'Home'));
  const name = useSession((s) => s.name);
  const governorate = useSession((s) => s.governorate);
  const district = useSession((s) => s.district);
  const status = useReports((s) => s.status);
  const error = useReports((s) => s.error);
  const incidents = useReports((s) => s.incidents);
  const reports = useReports((s) => s.reports);
  const followIncident = useReports((s) => s.followIncident);
  const items = useRequestItems();
  const followed = useFollowingSet();
  const center = useAreaCenter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [followFailed, setFollowFailed] = useState(false);

  const nearby = useMemo(() => selectNearby(incidents, new Set(reports.map((r) => r.incidentId)), center, 3), [incidents, reports, center]);
  const latest = items.slice(0, 2);
  const loading = (status === 'idle' || status === 'loading') && incidents.length === 0 && items.length === 0;
  const failed = status === 'error' && incidents.length === 0 && items.length === 0;

  const follow = async (id: string) => {
    setBusyId(id);
    setFollowFailed(false);
    try {
      await followIncident(id);
    } catch {
      setFollowFailed(true);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="ftc-web-main" id="main">
      <section className="h-hero" aria-label={tr('أهلًا', 'Welcome')}>
        <div className="h-nile" />
        <Skyline className="h-sky" />
        <div className="h-text">
          <h1 className="h-greet">{name ? tr(`${greeting()} يا ${name}`, `${greeting()}, ${name}`) : greeting()}</h1>
          <div className="h-loc">
            <Icon name="pin" size={16} />
            <span>{tr(`${governorate} · حي ${district}`, `${placeName(governorate)} · ${placeName(district)}`)}</span>
            <Link href="/profile" aria-label={tr('غيّر المنطقة', 'Change area')}>{tr('غيّر', 'Change')}</Link>
          </div>
          <p className="h-slogan">{tr('مدينتك أحلى لما نصلّحها سوا', 'Your city is better when we fix it together')}</p>
          <h2>{tr('شايف مشكلة في الشارع؟', 'See a problem in the street?')}</h2>
          <p className="lead">{tr('صوّرها، وإحنا هنحدد نوعها ونوصّلها للجهة المسؤولة ونتابعها معاك.', "Take a photo. We'll work out what it is, send it to the right team and follow it with you.")}</p>
          <Link className="ftc-btn ftc-btn--gold h-cta" href="/report/category" data-testid="home-report">
            <Icon name="camera" size={22} strokeWidth={2} />{tr('بلّغ دلوقتي', 'Report now')}
          </Link>
        </div>
      </section>

      <section className="w-sec" aria-labelledby="t-serv">
        <div className="w-sec-head"><h2 className="w-h2" id="t-serv">{tr('الخدمات', 'City services')}</h2><Link href="/services">{tr('كل الخدمات', 'All services')}</Link></div>
        <div className="h-tiles">
          {TILES.map((t) => (
            <Link key={t.testId} className="ftc-tile h-tile" href={t.href} data-testid={t.testId}>
              <span className="ftc-icon-well"><Icon name={t.icon} size={24} /></span>
              <b>{tr(t.ar, t.en)}</b>
            </Link>
          ))}
        </div>
        <div className="h-quick">
          <Link className="ftc-btn ftc-btn--secondary ftc-btn--sm" href="/impact" data-testid="home-impact"><Icon name="leaf" size={18} />{tr('أثري في التدوير', 'My recycling impact')}</Link>
          <Link className="ftc-btn ftc-btn--secondary ftc-btn--sm" href="/recycling-guide" data-testid="home-recycling-guide"><Icon name="recycle" size={18} />{tr('دليل التدوير', 'Recycling guide')}</Link>
        </div>
      </section>

      <section className="w-sec" aria-labelledby="t-bin">
        <Link className="ftc-card h-bin w-card-link" href="/smart-bin" data-testid="home-smart-bin">
          <SmartBinFigure fillPct={85} state="full" size={120} decorative />
          <span className="w-grow">
            <h2 className="w-h2" id="t-bin">{tr('الصندوق الذكي', 'Smart bin')}</h2>
            <span className="w-sub">{tr('صندوق بيقول للحي إنه اتملى قبل ما يفيض. جرّبه بنفسك.', 'A bin that tells the district it is full before it overflows. Try it.')}</span>
            <span className="ftc-btn ftc-btn--primary ftc-btn--sm"><Icon name="trash" size={18} />{tr('جرّب الصندوق الذكي', 'Try the smart bin')}</span>
          </span>
        </Link>
      </section>

      {failed ? (
        <section className="w-sec">
          <StateMessage tone="error" icon="wifi" title={tr('مقدرناش نحمّل البيانات', "We couldn't load your data")} body={error ?? tr('اتأكد من النت وجرّب تاني', 'Check your internet and try again')} actionLabel={tr('جرّب تاني', 'Try again')} onAction={() => void refreshAll()} />
        </section>
      ) : null}

      <section className="w-sec" aria-labelledby="t-near">
        <div className="w-sec-head"><h2 className="w-h2" id="t-near">{tr('حوالين بيتك', 'Near your home')}</h2><Link href="/map">{tr('افتح الخريطة', 'Open the map')}</Link></div>
        <div className="h-two">
          <div className="w-stack">
            {loading ? <StateMessage loading title={tr('بنجيب البلاغات اللي حواليك…', 'Loading reports near you…')} /> : null}
            {!loading && !failed && nearby.length === 0 ? (
              <StateMessage icon="shield-check" title={tr('مفيش بلاغات مفتوحة حواليك', 'No open reports near you')} body={tr('لو فيه مشكلة، بلّغ عنها وجيرانك يقدروا يقولوا «أنا كمان».', 'If you see a problem, report it and your neighbours can say “Me\u00a0too”.')} />
            ) : null}
            {nearby.map(({ incident, distanceM }) => {
              const cat = getCategory(incident.categoryId);
              const critical = isCriticalIncident(incident);
              const isFollowed = followed.has(incident.id);
              return (
                <div className="w-rowcard" key={incident.id} data-testid={`nearby-${incident.id}`}>
                  <span className={`ftc-icon-well${critical ? ' ftc-icon-well--danger' : ''}`} style={{ width: 44, height: 44 }}><Icon name={cat.icon} size={20} /></span>
                  <span className="w-grow">
                    <span className="w-t">{incident.title} {critical ? <DangerTag /> : null}</span>
                    <span className="w-m">{tr('على بعد', 'About')} {formatDistance(distanceM)}{tr('', ' away')} · {neighbours(incident.followers)}</span>
                  </span>
                  {isFollowed ? (
                    <span className="w-followed"><Icon name="check" size={16} strokeWidth={2.5} />{tr('متابَع', 'Following')}</span>
                  ) : (
                    <button className="w-follow" type="button" disabled={busyId === incident.id} onClick={() => void follow(incident.id)} aria-label={`${tr('أنا كمان', 'Me\u00a0too')}: ${incident.title}`}>
                      {tr('أنا كمان', 'Me\u00a0too')}
                    </button>
                  )}
                </div>
              );
            })}
            {followFailed ? <span className="a-err" role="alert">{tr('معرفناش نسجّل متابعتك، جرّب تاني.', "We couldn't save your follow. Try again.")}</span> : null}
          </div>
          <Link className="ftc-card h-mapcard w-card-link" href="/map" aria-label={tr('افتح خريطة المدينة', 'Open the city map')}>
            <img className="citymap" src="/brand/citymap.svg" alt="" />
            <span className="over">
              <span className="h-legend">
                {LEGEND.map((l) => (
                  <span key={l.status}><i style={{ background: STATUS_COLOR[l.status] }} />{statusLabel(l.status, l.ar)}</span>
                ))}
              </span>
              <span className="ftc-btn ftc-btn--primary ftc-btn--sm"><Icon name="map" size={18} />{tr('الخريطة', 'Map')}</span>
            </span>
          </Link>
        </div>
      </section>

      <section className="w-sec" aria-labelledby="t-upd">
        <div className="w-sec-head"><h2 className="w-h2" id="t-upd">{tr('آخر التحديثات', 'Latest updates')}</h2><Link href="/requests">{tr('كل الطلبات', 'All requests')}</Link></div>
        {!loading && latest.length === 0 ? (
          <StateMessage icon="clipboard" title={tr('لسه مفيش طلبات', 'No requests yet')} body={tr('أول ما تبلّغ عن مشكلة أو تحجز خدمة، هتلاقي تحديثاتها هنا.', 'Once you report a problem or book a service, its updates will show up here.')} />
        ) : (
          <div className="h-upd">
            {latest.map((item) => (
              <RequestRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      <section className="w-sec" aria-label={tr('أرقام الطوارئ', 'Emergency numbers')}>
        <div className="h-sos">
          <div className="intro"><h2 className="w-h3">{tr('أرقام الطوارئ', 'Emergency numbers')}</h2><p className="w-sub">{tr('لو فيه خطر على حياة حد، كلّم فورًا. متبلّغش هنا.', "If someone's life is in danger, call right away. Don't report it here.")}</p></div>
          <SosGrid />
        </div>
      </section>
    </main>
  );
}
