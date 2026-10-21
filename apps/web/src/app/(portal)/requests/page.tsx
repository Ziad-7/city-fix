'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { medalFor } from '@/domain/medals';
import { isOpenStatus } from '@/domain/types';
import { REQUEST_FILTERS, filterRequests, type RequestFilter } from '@/components/requests/filters';
import { slotLabel } from '@/components/requests/labels';
import { dayLabel } from '@/components/services/day';
import { refreshAll, useReports, useRequestItems, useServiceRequests, useSession, type RequestItem } from '@/store';
import { toArabicDigits } from '@/utils/digits';
import { formatDateAr, relativeTimeAr } from '@/utils/time';
import { MedalIcon } from '@/ui/brand';
import { Pills } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { itemCritical, itemIcon, itemPhoto } from '@/ui/RequestRow';
import { StateMessage } from '@/ui/StateMessage';
import { StatusChips } from '@/ui/StatusChip';
import { Thumb } from '@/ui/Thumb';
import { usePageTitle } from '@/lib/usePageTitle';
import { serviceDepartment } from '@/lib/service-labels';

/** The "who and when" column: department plus ETA, schedule or fix date. */
function depLine(item: RequestItem): { who: string; when: string } {
  if (item.kind === 'service') {
    const d = item.request.details;
    return { who: serviceDepartment(item.request.serviceType), when: `الميعاد: ${dayLabel(d.day)} · ${slotLabel(d.slot)}` };
  }
  const who = item.incident?.department ?? '';
  if (!isOpenStatus(item.status)) return { who, when: `اتصلّح ${formatDateAr(item.incident?.updatedAt ?? item.createdAt)}` };
  return { who, when: item.incident?.eta ? `متوقع يخلص ${item.incident.eta.replace(/^متوقع\s+(نخلص\s+)?/, '')}` : 'هنبلّغك أول ما يتحدد' };
}

export default function RequestsPage() {
  usePageTitle('طلباتي');
  const items = useRequestItems();
  const reportsStatus = useReports((s) => s.status);
  const servicesStatus = useServiceRequests((s) => s.status);
  const errorText = useReports((s) => s.error) ?? useServiceRequests.getState().error;
  const whatsapp = useSession((s) => s.prefs.whatsappUpdates);
  const reportCount = useReports((s) => s.reports.length);
  const [filter, setFilter] = useState<RequestFilter>('all');
  const visible = useMemo(() => filterRequests(items, filter), [items, filter]);
  const open = items.filter((i) => isOpenStatus(i.status)).length;
  const medal = medalFor(reportCount);

  const loading = items.length === 0 && (reportsStatus === 'idle' || reportsStatus === 'loading' || servicesStatus === 'loading');
  const failed = items.length === 0 && (reportsStatus === 'error' || servicesStatus === 'error');

  let body: React.ReactNode;
  if (loading) body = <StateMessage loading title="بنجيب طلباتك…" />;
  else if (failed) body = <StateMessage tone="error" icon="wifi" title="مقدرناش نحمّل طلباتك" body={errorText ?? 'اتأكد من النت وجرّب تاني'} actionLabel="جرّب تاني" onAction={() => void refreshAll()} />;
  else if (items.length === 0) body = <StateMessage icon="clipboard" title="لسه مفيش طلبات" body="أول ما تبلّغ عن مشكلة أو تحجز خدمة هتلاقيها هنا وتتابع حالتها." actionLabel="بلّغ عن مشكلة" actionHref="/report/category" />;
  else if (visible.length === 0) body = <StateMessage icon="search" title="مفيش طلبات في القسم ده" body="جرّب فلتر تاني من فوق." />;
  else
    body = (
      <div className="q-list">
        {visible.map((item) => {
          const dep = depLine(item);
          return (
            <Link className="w-rowcard q-row" href={`/requests/${item.id}`} key={item.id} data-testid={`request-${item.id}`}>
              <Thumb uri={itemPhoto(item)} icon={itemIcon(item)} />
              <span className="w-grow">
                <span className="w-t">{item.title}{item.kind === 'service' ? <span className="q-kind">خدمة</span> : null}</span>
                <span className="w-m"><bdi dir="ltr">#{item.id}</bdi> · {item.kind === 'report' ? 'اتبلّغ' : 'اتحجز'} {relativeTimeAr(item.createdAt)}</span>
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
        <div><h1 className="w-h1">طلباتي</h1><p className="w-sub">البلاغات والخدمات اللي طلبتها، الأحدث فوق.</p></div>
        <Link className="ftc-btn ftc-btn--gold" href="/report/category"><Icon name="camera" size={20} strokeWidth={2} />بلّغ عن مشكلة</Link>
      </div>
      <div className="q-grid">
        <section aria-label="قايمة الطلبات">
          <div className="q-tools">
            <Pills options={REQUEST_FILTERS} value={filter} onChange={setFilter} label="فلتر الطلبات" />
          </div>
          {body}
        </section>
        <aside className="q-side" aria-label="ملخص">
          <div className="ftc-card">
            <h2 className="w-h3" style={{ marginBottom: 12 }}>ملخص طلباتك</h2>
            <div className="q-stats">
              <div><b>{toArabicDigits(items.length)}</b><span>الكل</span></div>
              <div><b>{toArabicDigits(open)}</b><span>مفتوحة</span></div>
              <div><b>{toArabicDigits(items.length - open)}</b><span>اتصلّحت</span></div>
            </div>
          </div>
          <div className="ftc-card" style={{ background: 'var(--ftc-gold-soft)', boxShadow: 'none' }}>
            <div className="w-row">
              <MedalIcon size={48} />
              <span>
                <span className="ftc-caption" style={{ color: 'var(--ftc-gold-deep)', display: 'block' }}>{medal.earnedTitle ? 'لقبك' : 'في الطريق للقب'}</span>
                <span style={{ font: '700 22px/32px var(--ftc-font-ruqaa)', color: 'var(--ftc-gold-deep)' }}>{medal.title}</span>
              </span>
            </div>
          </div>
          <div className="ftc-notice ftc-notice--ai">
            <Icon name="whatsapp" size={20} className="w-notice-ic" />
            <span>{whatsapp ? 'بنبعتلك تحديث على واتساب في كل خطوة، ولو مفيش نت هتوصلك SMS.' : 'بنبعتلك تحديث برسالة SMS في كل خطوة.'}</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
