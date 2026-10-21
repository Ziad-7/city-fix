'use client';

/* eslint-disable @next/next/no-img-element -- static design illustration */
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { getCategory } from '@/domain/categories';
import type { IconName } from '@/domain/types';
import { selectNearby } from '@/components/home/nearby';
import { neighboursAr } from '@/components/report/text';
import { isCriticalIncident } from '@/logic/priority';
import { useAreaCenter } from '@/lib/area';
import { refreshAll, useFollowingSet, useReports, useRequestItems, useSession } from '@/store';
import { formatDistanceAr } from '@/utils/geo';
import { greetingAr } from '@/utils/time';
import { Skyline } from '@/ui/brand';
import { SosGrid } from '@/ui/Hotlines';
import { Icon } from '@/ui/Icon';
import { RequestRow } from '@/ui/RequestRow';
import { StateMessage } from '@/ui/StateMessage';
import { DangerTag, STATUS_COLOR } from '@/ui/StatusChip';
import { usePageTitle } from '@/lib/usePageTitle';

const TILES: { icon: IconName; label: string; href: string }[] = [
  { icon: 'alert-triangle', label: 'بلاغ عن مشكلة', href: '/report/category' },
  { icon: 'trash', label: 'رفع مخلفات', href: '/services/bulky-waste' },
  { icon: 'tree', label: 'صيانة الشجر', href: '/services' },
  { icon: 'map', label: 'خريطة المدينة', href: '/map' },
  { icon: 'clipboard', label: 'طلباتي', href: '/requests' },
  { icon: 'bulb', label: 'إنارة الشوارع', href: '/report/new?category=streetlight_out' },
  { icon: 'clock', label: 'مواعيد جمع القمامة', href: '/services' },
  { icon: 'more', label: 'كل الخدمات', href: '/services' },
];

const LEGEND = [
  { label: 'وصل', color: STATUS_COLOR.received },
  { label: 'اتحوّل', color: STATUS_COLOR.assigned },
  { label: 'جاري التنفيذ', color: STATUS_COLOR.in_progress },
  { label: 'اتصلّح', color: STATUS_COLOR.resolved },
];

export default function HomePage() {
  usePageTitle('الرئيسية');
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
      <section className="h-hero" aria-label="أهلًا">
        <div className="h-nile" />
        <Skyline className="h-sky" />
        <div className="h-text">
          <h1 className="h-greet">{name ? `${greetingAr()} يا ${name}` : greetingAr()}</h1>
          <div className="h-loc">
            <Icon name="pin" size={16} />
            <span>{governorate} · حي {district}</span>
            <Link href="/profile" aria-label="غيّر المنطقة">غيّر</Link>
          </div>
          <p className="h-slogan">مدينتك أحلى لما نصلّحها سوا</p>
          <h2>شايف مشكلة في الشارع؟</h2>
          <p className="lead">صوّرها، وإحنا هنحدد نوعها ونوصّلها للجهة المسؤولة ونتابعها معاك.</p>
          <Link className="ftc-btn ftc-btn--gold h-cta" href="/report/category" data-testid="home-report">
            <Icon name="camera" size={22} strokeWidth={2} />بلّغ دلوقتي
          </Link>
        </div>
      </section>

      <section className="w-sec" aria-labelledby="t-serv">
        <div className="w-sec-head"><h2 className="w-h2" id="t-serv">الخدمات</h2><Link href="/services">كل الخدمات</Link></div>
        <div className="h-tiles">
          {TILES.map((t) => (
            <Link key={t.label} className="ftc-tile h-tile" href={t.href}>
              <span className="ftc-icon-well"><Icon name={t.icon} size={24} /></span>
              <b>{t.label}</b>
            </Link>
          ))}
        </div>
      </section>

      {failed ? (
        <section className="w-sec">
          <StateMessage tone="error" icon="wifi" title="مقدرناش نحمّل البيانات" body={error ?? 'اتأكد من النت وجرّب تاني'} actionLabel="جرّب تاني" onAction={() => void refreshAll()} />
        </section>
      ) : null}

      <section className="w-sec" aria-labelledby="t-near">
        <div className="w-sec-head"><h2 className="w-h2" id="t-near">حوالين بيتك</h2><Link href="/map">افتح الخريطة</Link></div>
        <div className="h-two">
          <div className="w-stack">
            {loading ? <StateMessage loading title="بنجيب البلاغات اللي حواليك…" /> : null}
            {!loading && !failed && nearby.length === 0 ? (
              <StateMessage icon="shield-check" title="مفيش بلاغات مفتوحة حواليك" body="لو فيه مشكلة، بلّغ عنها وجيرانك يقدروا يقولوا «أنا كمان»." />
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
                    <span className="w-m">على بعد {formatDistanceAr(distanceM)} · {neighboursAr(incident.followers)}</span>
                  </span>
                  {isFollowed ? (
                    <span className="w-followed"><Icon name="check" size={16} strokeWidth={2.5} />متابَع</span>
                  ) : (
                    <button className="w-follow" type="button" disabled={busyId === incident.id} onClick={() => void follow(incident.id)} aria-label={`أنا كمان: ${incident.title}`}>
                      أنا كمان
                    </button>
                  )}
                </div>
              );
            })}
            {followFailed ? <span className="a-err" role="alert">معرفناش نسجّل متابعتك، جرّب تاني.</span> : null}
          </div>
          <Link className="ftc-card h-mapcard w-card-link" href="/map" aria-label="افتح خريطة المدينة">
            <img className="citymap" src="/brand/citymap.svg" alt="" />
            <span className="over">
              <span className="h-legend">
                {LEGEND.map((l) => (
                  <span key={l.label}><i style={{ background: l.color }} />{l.label}</span>
                ))}
              </span>
              <span className="ftc-btn ftc-btn--primary ftc-btn--sm"><Icon name="map" size={18} />الخريطة</span>
            </span>
          </Link>
        </div>
      </section>

      <section className="w-sec" aria-labelledby="t-upd">
        <div className="w-sec-head"><h2 className="w-h2" id="t-upd">آخر التحديثات</h2><Link href="/requests">كل الطلبات</Link></div>
        {!loading && latest.length === 0 ? (
          <StateMessage icon="clipboard" title="لسه مفيش طلبات" body="أول ما تبلّغ عن مشكلة أو تحجز خدمة، هتلاقي تحديثاتها هنا." />
        ) : (
          <div className="h-upd">
            {latest.map((item) => (
              <RequestRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      <section className="w-sec" aria-label="أرقام الطوارئ">
        <div className="h-sos">
          <div className="intro"><h2 className="w-h3">أرقام الطوارئ</h2><p className="w-sub">لو فيه خطر على حياة حد، كلّم فورًا. متبلّغش هنا.</p></div>
          <SosGrid />
        </div>
      </section>
    </main>
  );
}
