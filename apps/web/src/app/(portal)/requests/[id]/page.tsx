'use client';

/* eslint-disable @next/next/no-img-element -- report photo (data URL or storage URL) */
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { getCategory } from '@/domain/categories';
import { FEE_LABEL, SERVICES } from '@/domain/services-catalog';
import { isOpenStatus } from '@/domain/types';
import { followersLine, paymentLabel, slotLabel } from '@/components/requests/labels';
import { buildTimelineSteps } from '@/components/requests/timeline';
import { dayLabel } from '@/components/services/day';
import { isCriticalIncident, priorityReason } from '@/logic/priority';
import { absoluteUrl, shareText, whatsappHref } from '@/lib/share';
import { API_MODE } from '@/services';
import { refreshAll, useReports, useRequestItem, useServiceRequests, useSession } from '@/store';
import { isolateLtr, maskPhone, toArabicDigits } from '@/utils/digits';
import { formatDateAr, formatDateTimeAr, formatTimeAr } from '@/utils/time';
import { ToggleRow } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { StateMessage } from '@/ui/StateMessage';
import { StatusChips } from '@/ui/StatusChip';

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const item = useRequestItem(id);
  const reportsStatus = useReports((s) => s.status);
  const servicesStatus = useServiceRequests((s) => s.status);
  const simulateReport = useReports((s) => s.simulateProgress);
  const simulateService = useServiceRequests((s) => s.simulateProgress);
  const phone = useSession((s) => s.phone);
  const district = useSession((s) => s.district);
  const whatsapp = useSession((s) => s.prefs.whatsappUpdates);
  const setPrefs = useSession((s) => s.setPrefs);
  const [simulating, setSimulating] = useState(false);
  const [simulateError, setSimulateError] = useState(false);

  const steps = useMemo(() => {
    if (!item) return [];
    if (item.kind === 'report') return buildTimelineSteps(item.incident?.timeline ?? [], 'report', item.status);
    return buildTimelineSteps(item.request.timeline, 'service', item.status);
  }, [item]);

  const back = <Link className="w-back" href="/requests"><Icon name="arrow-back" size={18} />طلباتي</Link>;

  if (!item) {
    const failed = reportsStatus === 'error' || servicesStatus === 'error';
    const loading = reportsStatus === 'idle' || reportsStatus === 'loading' || servicesStatus === 'idle' || servicesStatus === 'loading';
    return (
      <main className="ftc-web-main" id="main">
        {back}
        {loading ? (
          <StateMessage loading title="بنجيب التفاصيل…" />
        ) : failed ? (
          <StateMessage tone="error" icon="wifi" title="مقدرناش نحمّل الطلب" body="اتأكد من النت وجرّب تاني" actionLabel="جرّب تاني" onAction={() => void refreshAll()} />
        ) : (
          <StateMessage icon="search" title="مش لاقيين الطلب ده" body="ممكن يكون اتمسح أو الرابط مش صح. تقدر ترجع لقايمة طلباتك." actionLabel="طلباتي" actionHref="/requests" />
        )}
      </main>
    );
  }

  const isReport = item.kind === 'report';
  const incident = isReport ? item.incident : null;
  const category = isReport ? getCategory(item.categoryId) : null;
  const catalog = isReport ? null : SERVICES.find((s) => s.serviceType === item.request.serviceType);
  const photo = isReport ? item.report.photoUris[0] : undefined;
  const link = absoluteUrl(`/requests/${item.id}`);
  const message = isReport
    ? `بلّغت عن "${item.title}" على فيكس ذا سيتي، رقم البلاغ ${isolateLtr(`#${item.id}`)}. تابعوا معايا لحد ما يتصلّح.`
    : `حجزت خدمة "${item.title}" على فيكس ذا سيتي، رقم الطلب ${isolateLtr(`#${item.id}`)}.`;

  const tiles = isReport
    ? [
        { label: 'الجهة المسؤولة', value: `${incident?.department ?? category?.department ?? ''} · حي ${district}` },
        isOpenStatus(item.status)
          ? { label: 'متوقع يخلص', value: incident?.eta ? incident.eta.replace(/^متوقع\s+(نخلص\s+)?/, '') : 'هنبلّغك أول ما يتحدد' }
          : { label: 'اتصلّح', value: formatDateAr(incident?.updatedAt ?? item.createdAt) },
      ]
    : [
        { label: 'الجهة المسؤولة', value: `خدمات الحي · حي ${district}` },
        { label: 'الميعاد', value: dayLabel(item.request.details.day) },
      ];

  const reason = incident ? priorityReason(incident.priority, incident.linkedReportIds.length, incident.sensitivePlace) : '';
  const colon = reason.indexOf(':');
  const reasonHead = colon > 0 ? reason.slice(0, colon) : reason;
  const reasonTail = colon > 0 ? reason.slice(colon + 1).trim().replace(/ \+ /g, '، و') : '';

  const simulate = async () => {
    setSimulating(true);
    setSimulateError(false);
    try {
      if (item.kind === 'report') {
        if (item.incident) await simulateReport(item.incident.id);
      } else {
        await simulateService(item.id);
      }
    } catch {
      setSimulateError(true);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <main className="ftc-web-main" id="main">
      {back}
      <div className="w-page-head">
        <h1 className="w-h1">{isReport ? 'متابعة البلاغ' : 'متابعة الطلب'}</h1>
        <button className="ftc-btn ftc-btn--secondary ftc-btn--sm" type="button" onClick={() => void shareText(message, link)}><Icon name="share" size={18} />مشاركة</button>
      </div>
      <div className="t-grid">
        <div className="t-main">
          <section className="ftc-card t-sum" aria-label={isReport ? 'ملخص البلاغ' : 'ملخص الطلب'}>
            <div className="t-ph">
              {photo ? <img src={photo} alt={`صورة ${item.title}`} /> : <span className="a-ph-icon"><Icon name={isReport ? category!.icon : (catalog?.icon ?? 'clipboard')} size={48} /></span>}
            </div>
            <div>
              <h2 data-testid="detail-title">{item.title}</h2>
              <div className="t-meta">
                <bdi dir="ltr">#{item.id}</bdi> · {isReport ? 'اتبلّغ' : 'اتحجز'} {formatDateTimeAr(item.createdAt)}
                <StatusChips status={item.status} critical={!!incident && isCriticalIncident(incident)} />
              </div>
              <div className="t-info">
                {tiles.map((t) => (
                  <div key={t.label}><span>{t.label}</span><b>{t.value}</b></div>
                ))}
              </div>
            </div>
          </section>

          {incident ? (
            <section className="ftc-card t-prio" aria-labelledby="pr">
              <h2 className="w-h3" id="pr" style={{ marginBottom: 14 }}>الأولوية</h2>
              <div className="t-prio__top">
                <span className="t-score" aria-label={`درجة الأولوية ${toArabicDigits(incident.priority.score)}`}>{toArabicDigits(incident.priority.score)}</span>
                <span><b>{reasonHead}</b>{reasonTail ? <span className="r">{reasonTail}</span> : null}</span>
              </div>
              {incident.priority.factors.map((f) => (
                <div className={`t-f${f.points === 0 ? ' zero' : ''}`} key={f.key}>
                  <span>{f.label}</span>
                  <span className="ftc-bar" role="progressbar" aria-label={f.label} aria-valuemin={0} aria-valuemax={f.max} aria-valuenow={f.points}>
                    <span style={{ width: `${Math.round((f.points / f.max) * 100)}%` }} />
                  </span>
                  <span className="pts">+{toArabicDigits(f.points)}</span>
                </div>
              ))}
            </section>
          ) : null}

          {item.kind === 'service' ? (
            <section className="ftc-card t-prio" aria-labelledby="bk">
              <h2 className="w-h3" id="bk" style={{ marginBottom: 14 }}>تفاصيل الحجز</h2>
              <dl className="a-dl">
                <dt>اللي هيترفع</dt><dd>{item.request.details.items.join('، ')}</dd>
                <dt>اليوم</dt><dd>{dayLabel(item.request.details.day)}</dd>
                <dt>الفترة</dt><dd>{slotLabel(item.request.details.slot)}</dd>
                <dt>طريقة الدفع</dt><dd>{paymentLabel(item.request.details.payment)}</dd>
                <dt>الرسوم</dt><dd>{FEE_LABEL}</dd>
                <dt>العنوان</dt><dd>{[item.request.location.address, item.request.location.landmark].filter(Boolean).join(' · ')}</dd>
              </dl>
            </section>
          ) : null}

          <section className="ftc-card t-tl" aria-labelledby="tl">
            <h2 className="w-h3" id="tl" style={{ marginBottom: 16 }}>{isReport ? 'مراحل البلاغ' : 'مراحل الطلب'}</h2>
            <ol className="ftc-timeline" data-testid="timeline">
              {steps.map((s) => (
                <li key={s.key} className={s.state === 'done' ? 'is-done' : s.state === 'current' ? 'is-current' : undefined} aria-current={s.state === 'current' ? 'step' : undefined}>
                  <b>{s.title}</b>
                  {s.detail ? <span className="n">{s.detail}</span> : null}
                  {s.at ? <span className="tm">{formatTimeAr(s.at)}</span> : null}
                </li>
              ))}
            </ol>
          </section>

          {API_MODE === 'mock' ? (
            <div className="w-stack" style={{ gap: 6, alignItems: 'center' }}>
              <button className="ftc-btn ftc-btn--ghost ftc-btn--sm" type="button" disabled={simulating || !isOpenStatus(item.status)} onClick={() => void simulate()} data-testid="simulate-progress">
                <Icon name="refresh" size={18} />محاكاة تحديث الحالة
              </button>
              {simulateError ? <span className="a-err">المحاكاة مش متاحة دلوقتي.</span> : null}
            </div>
          ) : null}
        </div>

        <aside className="t-side" aria-label="خيارات">
          <div className="ftc-card w-stack" style={{ gap: 14 }}>
            <h2 className="w-h3">التحديثات</h2>
            <ToggleRow
              bare
              icon="whatsapp"
              title="ابعتلي التحديثات على واتساب"
              subtitle={<>على رقم {phone ? <bdi dir="ltr">{maskPhone(phone)}</bdi> : 'موبايلك'} — ولو مفيش نت هتوصلك SMS</>}
              on={whatsapp}
              onChange={(v) => setPrefs({ whatsappUpdates: v })}
              testId="toggle-whatsapp"
            />
          </div>
          {isReport ? (
            <div className="ftc-card w-stack" style={{ gap: 14 }}>
              <h2 className="w-h3">شارك البلاغ</h2>
              {incident ? <div className="t-follow"><Icon name="users" size={20} /><span>{followersLine(incident.followers)}</span></div> : null}
              <button className="ftc-btn ftc-btn--secondary ftc-btn--block" type="button" onClick={() => void shareText(message, link)}><Icon name="share" size={20} />ابعت البلاغ لجروب العمارة</button>
              <a className="ftc-btn ftc-btn--secondary ftc-btn--block w-neutral" href={whatsappHref(message, link)} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size={20} />ابعته على واتساب</a>
            </div>
          ) : null}
          {isReport ? (
            <div className="ftc-notice"><Icon name="info" size={20} className="w-notice-ic" /><span>الأولوية بتتحسب من خطورة المشكلة، قربها من مدرسة أو مستشفى، وعدد اللي بلّغوا عنها.</span></div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
