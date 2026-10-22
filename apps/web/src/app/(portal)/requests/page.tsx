'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { medalFor } from '@/domain/medals';
import { isOpenStatus } from '@/domain/types';
import { REQUEST_FILTERS, filterRequests, type RequestFilter } from '@/components/requests/filters';
import { useTr } from '@/i18n';
import { departmentLabel, medalTitle } from '@/i18n/labels';
import { pickupInFilter } from '@/logic/citycycle';
import { slotLabel } from '@/components/requests/labels';
import { dayLabel } from '@/components/services/day';
import { refreshAll, useRecycling, useReports, useRequestItems, useServiceRequests, useSession, type RequestItem } from '@/store';
import { localDigits } from '@/utils/digits';
import { formatDate, relativeTime } from '@/utils/time';
import { MedalIcon } from '@/ui/brand';
import { Pills } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { itemCritical, itemIcon, itemPhoto } from '@/ui/RequestRow';
import { StateMessage } from '@/ui/StateMessage';
import { PickupCard } from '@/ui/citycycle';
import { StatusChips } from '@/ui/StatusChip';
import { Thumb } from '@/ui/Thumb';
import { usePageTitle } from '@/lib/usePageTitle';
import { serviceDepartment } from '@/lib/service-labels';

/** The "who and when" column: department plus ETA, schedule or fix date. */
function depLine(item: RequestItem, tr: (ar: string, en: string) => string): { who: string; when: string } {
  if (item.kind === 'service') {
    const d = item.request.details;
    return { who: departmentLabel(serviceDepartment(item.request.serviceType)), when: `${tr('الميعاد', 'Scheduled')}: ${dayLabel(d.day)} · ${slotLabel(d.slot)}` };
  }
  const who = departmentLabel(item.incident?.department ?? '');
  if (!isOpenStatus(item.status)) return { who, when: `${tr('اتصلّح', 'Fixed on')} ${formatDate(item.incident?.updatedAt ?? item.createdAt)}` };
  return { who, when: item.incident?.eta ? `${tr('متوقع يخلص', 'Expected to finish')} ${item.incident.eta.replace(/^متوقع\s+(نخلص\s+)?/, '')}` : tr('هنبلّغك أول ما يتحدد', "We'll tell you once it's set") };
}

type PageFilter = RequestFilter | 'recycling';

export default function RequestsPage() {
  const tr = useTr();
  usePageTitle(tr('طلباتي', 'My requests'));
  const items = useRequestItems();
  const reportsStatus = useReports((s) => s.status);
  const servicesStatus = useServiceRequests((s) => s.status);
  const errorText = useReports((s) => s.error) ?? useServiceRequests.getState().error;
  const whatsapp = useSession((s) => s.prefs.whatsappUpdates);
  const reportCount = useReports((s) => s.reports.length);
  const pickups = useRecycling((s) => s.pickups);
  const pickupsStatus = useRecycling((s) => s.status);
  const loadPrices = useRecycling((s) => s.loadPrices);
  const refreshPickups = useRecycling((s) => s.refresh);
  useEffect(() => {
    void loadPrices(); // the pickup rows say "From" only when they know the price list
  }, [loadPrices]);
  useEffect(() => {
    if (pickupsStatus === 'idle') void refreshPickups();
  }, [pickupsStatus, refreshPickups]);
  const [filter, setFilter] = useState<PageFilter>('all');
  const filters = useMemo(
    () => [...REQUEST_FILTERS, { id: 'recycling' as const, labelAr: 'تدوير', labelEn: 'Recycling' }].map((f) => ({ id: f.id as PageFilter, labelAr: tr(f.labelAr, f.labelEn) })),
    [tr],
  );
  const visible = useMemo(() => (filter === 'recycling' ? [] : filterRequests(items, filter)), [items, filter]);
  const visiblePickups = useMemo(() => pickups.filter((p) => pickupInFilter(p.status, filter)), [pickups, filter]);
  // Reports, services and pickups in one list, newest first.
  const rows = useMemo(
    () =>
      [
        ...visible.map((item) => ({ key: item.id, at: item.createdAt, item, pickup: null })),
        ...visiblePickups.map((pickup) => ({ key: pickup.id, at: pickup.createdAt, item: null, pickup })),
      ].sort((a, b) => b.at.localeCompare(a.at)),
    [visible, visiblePickups],
  );
  const total = items.length + pickups.length;
  const open = items.filter((i) => isOpenStatus(i.status)).length + pickups.filter((p) => pickupInFilter(p.status, 'open')).length;
  const fixed = items.filter((i) => !isOpenStatus(i.status)).length;
  const medal = medalFor(reportCount);

  const loading = total === 0 && (reportsStatus === 'idle' || reportsStatus === 'loading' || servicesStatus === 'loading');
  const failed = total === 0 && (reportsStatus === 'error' || servicesStatus === 'error' || pickupsStatus === 'error');

  let body: React.ReactNode;
  if (loading) body = <StateMessage loading title={tr('بنجيب طلباتك…', 'Loading your requests…')} />;
  else if (failed) body = <StateMessage tone="error" icon="wifi" title={tr('مقدرناش نحمّل طلباتك', "We couldn't load your requests")} body={errorText ?? tr('اتأكد من النت وجرّب تاني', 'Check your connection and try again')} actionLabel={tr('جرّب تاني', 'Try again')} onAction={() => void refreshAll()} />;
  else if (total === 0) body = <StateMessage icon="clipboard" title={tr('لسه مفيش طلبات', 'No requests yet')} body={tr('أول ما تبلّغ عن مشكلة أو تحجز خدمة هتلاقيها هنا وتتابع حالتها.', "When you report a problem or book a service, it'll show up here so you can follow it.")} actionLabel={tr('بلّغ عن مشكلة', 'Report a problem')} actionHref="/report/category" />;
  else if (rows.length === 0) body = <StateMessage icon="search" title={tr('مفيش طلبات في القسم ده', 'Nothing in this section')} body={tr('جرّب فلتر تاني من فوق.', 'Try another filter above.')} />;
  else
    body = (
      <div className="q-list">
        {rows.map((row) => {
          if (row.pickup) return <PickupCard key={row.key} pickup={row.pickup} />;
          const item = row.item;
          const dep = depLine(item, tr);
          return (
            <Link className="w-rowcard q-row" href={`/requests/${item.id}`} key={item.id} data-testid={`request-${item.id}`}>
              <Thumb uri={itemPhoto(item)} icon={itemIcon(item)} />
              <span className="w-grow">
                <span className="w-t">{item.title}{item.kind === 'service' ? <span className="q-kind">{tr('خدمة', 'Service')}</span> : null}</span>
                <span className="w-m"><bdi dir="ltr">#{item.id}</bdi> · {item.kind === 'report' ? tr('اتبلّغ', 'Reported') : tr('اتحجز', 'Booked')} {relativeTime(item.createdAt)}</span>
              </span>
              <span className="dep"><b>{dep.who}</b>{dep.when}</span>
              <span className="stc a-chips"><StatusChips status={item.status} critical={itemCritical(item)} /></span>
              <span className="go"><Icon name="chevron" size={20} /></span>
            </Link>
          );
        })}
      </div>
    );

  return (
    <main className="ftc-web-main" id="main">
      <div className="w-page-head">
        <div><h1 className="w-h1">{tr('طلباتي', 'My requests')}</h1><p className="w-sub">{tr('البلاغات والخدمات والتدوير اللي طلبتها، الأحدث فوق.', 'The reports, services and recycling pickups you asked for, newest first.')}</p></div>
        <Link className="ftc-btn ftc-btn--gold" href="/report/category"><Icon name="camera" size={20} strokeWidth={2} />{tr('بلّغ عن مشكلة', 'Report a problem')}</Link>
      </div>
      <div className="q-grid">
        <section aria-label={tr('قايمة الطلبات', 'Requests list')}>
          <div className="q-tools">
            <Pills options={filters} value={filter} onChange={setFilter} label={tr('فلتر الطلبات', 'Filter requests')} />
          </div>
          {body}
        </section>
        <aside className="q-side" aria-label={tr('ملخص', 'Summary')}>
          <div className="ftc-card">
            <h2 className="w-h3" style={{ marginBottom: 12 }}>{tr('ملخص طلباتك', 'Your requests at a glance')}</h2>
            <div className="q-stats">
              <div><b>{localDigits(total)}</b><span>{tr('الكل', 'All')}</span></div>
              <div><b>{localDigits(open)}</b><span>{tr('مفتوحة', 'Open')}</span></div>
              <div><b>{localDigits(fixed)}</b><span>{tr('اتصلّحت', 'Fixed')}</span></div>
            </div>
          </div>
          <div className="ftc-card" style={{ background: 'var(--ftc-gold-soft)', boxShadow: 'none' }}>
            <div className="w-row">
              <MedalIcon size={48} />
              <span>
                <span className="ftc-caption" style={{ color: 'var(--ftc-gold-deep)', display: 'block' }}>{medal.earnedTitle ? tr('لقبك', 'Your title') : tr('في الطريق للقب', 'On the way to a title')}</span>
                <span style={{ font: '700 22px/32px var(--ftc-font-ruqaa)', color: 'var(--ftc-gold-deep)' }}>{medalTitle(medal.title)}</span>
              </span>
            </div>
          </div>
          <div className="ftc-notice ftc-notice--ai">
            <Icon name="whatsapp" size={20} className="w-notice-ic" />
            <span>{whatsapp ? tr('بنبعتلك تحديث على واتساب في كل خطوة، ولو مفيش نت هتوصلك SMS.', "We'll message you on WhatsApp at every step. No internet? We'll send an SMS instead.") : tr('بنبعتلك تحديث برسالة SMS في كل خطوة.', "We'll text you at every step.")}</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
