'use client';

/* eslint-disable @next/next/no-img-element -- report photo (data URL or storage URL) */
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Fragment, useMemo, useState } from 'react';
import { getCategory } from '@/domain/categories';
import { FEE_LABEL, FREE_SERVICE_LABEL, SERVICES } from '@/domain/services-catalog';
import { isOpenStatus, type ServiceRequest } from '@/domain/types';
import { useLang, useTr } from '@/i18n';
import { FEE_LABEL_EN, FREE_SERVICE_LABEL_EN, departmentLabel, factorLabel, itemLabel, placeName } from '@/i18n/labels';
import { followersLine, paymentLabel, slotLabel } from '@/components/requests/labels';
import { buildTimelineSteps } from '@/components/requests/timeline';
import { dayLabel } from '@/components/services/day';
import { isCriticalIncident, priorityReason } from '@/logic/priority';
import { absoluteUrl, shareText, whatsappHref } from '@/lib/share';
import { API_MODE } from '@/services';
import { refreshAll, useReports, useRequestItem, useServiceRequests, useSession } from '@/store';
import { isolateLtr, localDigits, maskPhone } from '@/utils/digits';
import { formatDate, formatDateTime, formatTime } from '@/utils/time';
import { ToggleRow } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { StateMessage } from '@/ui/StateMessage';
import { StatusChips } from '@/ui/StatusChip';
import { usePageTitle } from '@/lib/usePageTitle';
import { serviceDepartment } from '@/lib/service-labels';
import { ReopenCard } from '@/ui/ReopenCard';
import { PickupDetail } from '@/ui/citycycle';

/** Booking details rows in the current language (the shared Arabic helper stays for the Arabic wording). */
function bookingRows(request: ServiceRequest, tr: (ar: string, en: string) => string) {
  const { details, location } = request;
  const free = !details.payment;
  const items = details.items.map(itemLabel).join(tr('، ', ', '));
  return [
    free
      ? { label: tr('نوع الشغل', 'Type of work'), value: details.workType ? itemLabel(details.workType) : items }
      : { label: tr('اللي هيترفع', 'Items'), value: items },
    { label: tr('اليوم', 'Day'), value: dayLabel(details.day) },
    { label: tr('الفترة', 'Time slot'), value: slotLabel(details.slot) },
    ...(free ? [] : [{ label: tr('طريقة الدفع', 'Payment'), value: paymentLabel(details.payment) }]),
    { label: tr('الرسوم', 'Fee'), value: free ? tr(FREE_SERVICE_LABEL, FREE_SERVICE_LABEL_EN) : tr(FEE_LABEL.replace(/[[\]]/g, ''), FEE_LABEL_EN.charAt(0).toUpperCase() + FEE_LABEL_EN.slice(1)) },
    { label: tr('العنوان', 'Address'), value: [location.address, location.landmark].filter(Boolean).join(' · ') },
    ...(details.note ? [{ label: tr('ملاحظة', 'Note'), value: details.note }] : []),
  ];
}

/** CityCycle pickups (RCY-…) have their own detail; everything else is a report or a city service. */
export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  if (typeof id === 'string' && id.startsWith('RCY-')) return <PickupDetail id={id} />;
  return <RequestDetail id={id} />;
}

function RequestDetail({ id }: { id: string }) {
  const tr = useTr();
  const lang = useLang();
  const item = useRequestItem(id);
  usePageTitle(item?.title ?? tr('تتبّع الطلب', 'Track your request'));
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
  // The future-step labels are written when the steps are built: rebuild on a language switch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, lang]);

  const back = <Link className="w-back" href="/requests"><Icon name="arrow-back" size={18} />{tr('طلباتي', 'My requests')}</Link>;

  if (!item) {
    const failed = reportsStatus === 'error' || servicesStatus === 'error';
    const loading = reportsStatus === 'idle' || reportsStatus === 'loading' || servicesStatus === 'idle' || servicesStatus === 'loading';
    return (
      <main className="ftc-web-main" id="main">
        {back}
        {loading ? (
          <StateMessage loading title={tr('بنجيب التفاصيل…', 'Loading the details…')} />
        ) : failed ? (
          <StateMessage tone="error" icon="wifi" title={tr('مقدرناش نحمّل الطلب', "We couldn't load this request")} body={tr('اتأكد من النت وجرّب تاني', 'Check your connection and try again')} actionLabel={tr('جرّب تاني', 'Try again')} onAction={() => void refreshAll()} />
        ) : (
          <StateMessage icon="search" title={tr('مش لاقيين الطلب ده', "We couldn't find this request")} body={tr('ممكن يكون اتمسح أو الرابط مش صح. ارجع لقايمة طلباتك.', 'It may have been deleted, or the link is wrong. Go back to your requests.')} actionLabel={tr('طلباتي', 'My requests')} actionHref="/requests" />
        )}
      </main>
    );
  }

  const isReport = item.kind === 'report';
  const incident = isReport ? item.incident : null;
  const category = isReport ? getCategory(item.categoryId) : null;
  const catalog = isReport ? null : SERVICES.find((s) => s.serviceType === item.request.serviceType);
  const photo = isReport ? item.report.photoUris[0] : item.request.details.photoUris?.[0];
  const link = absoluteUrl(`/requests/${item.id}`);
  const message = isReport
    ? tr(`بلّغت عن "${item.title}" على سيتي فيكس، رقم البلاغ ${isolateLtr(`#${item.id}`)}. تابعوا معايا لحد ما يتصلّح.`, `I reported "${item.title}" on CityFix, report number ${isolateLtr(`#${item.id}`)}. Follow it with me until it's fixed.`)
    : tr(`حجزت خدمة "${item.title}" على سيتي فيكس، رقم الطلب ${isolateLtr(`#${item.id}`)}.`, `I booked "${item.title}" on CityFix, request number ${isolateLtr(`#${item.id}`)}.`);

  const tiles = isReport
    ? [
        { label: tr('الجهة المسؤولة', 'Handled by'), value: `${departmentLabel(incident?.department ?? category?.department ?? '')} · ${tr(`حي ${district}`, placeName(district))}` },
        isOpenStatus(item.status)
          ? { label: tr('متوقع يخلص', 'Expected to finish'), value: incident?.eta ? incident.eta.replace(/^متوقع\s+(نخلص\s+)?/, '') : tr('هنبلّغك أول ما يتحدد', "We'll tell you once it's set") }
          : { label: tr('اتصلّح', 'Fixed on'), value: formatDate(incident?.updatedAt ?? item.createdAt) },
      ]
    : [
        { label: tr('الجهة المسؤولة', 'Handled by'), value: `${departmentLabel(serviceDepartment(item.request.serviceType))} · ${tr(`حي ${district}`, placeName(district))}` },
        { label: tr('الميعاد', 'Scheduled'), value: dayLabel(item.request.details.day) },
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
        <h1 className="w-h1">{isReport ? tr('متابعة البلاغ', 'Track your report') : tr('متابعة الطلب', 'Track your request')}</h1>
        <button className="ftc-btn ftc-btn--secondary ftc-btn--sm" type="button" onClick={() => void shareText(message, link)}><Icon name="share" size={18} />{tr('مشاركة', 'Share')}</button>
      </div>
      <div className="t-grid">
        <div className="t-main">
          <section className="ftc-card t-sum" aria-label={isReport ? tr('ملخص البلاغ', 'Report summary') : tr('ملخص الطلب', 'Request summary')}>
            <div className="t-ph">
              {photo ? <img src={photo} alt={tr(`صورة ${item.title}`, `Photo: ${item.title}`)} /> : <span className="a-ph-icon"><Icon name={isReport ? category!.icon : (catalog?.icon ?? 'clipboard')} size={48} /></span>}
            </div>
            <div>
              <h2 data-testid="detail-title">{item.title}</h2>
              <div className="t-meta">
                <bdi dir="ltr">#{item.id}</bdi> · {isReport ? tr('اتبلّغ', 'Reported') : tr('اتحجز', 'Booked')} {formatDateTime(item.createdAt)}
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
              <h2 className="w-h3" id="pr" style={{ marginBottom: 14 }}>{tr('الأولوية', 'Priority')}</h2>
              <div className="t-prio__top">
                <span className="t-score" aria-label={`${tr('درجة الأولوية', 'Priority score')} ${localDigits(incident.priority.score)}`}>{localDigits(incident.priority.score)}</span>
                <span><b>{reasonHead}</b>{reasonTail ? <span className="r">{reasonTail}</span> : null}</span>
              </div>
              {incident.priority.factors.map((f) => (
                <div className={`t-f${f.points === 0 ? ' zero' : ''}`} key={f.key}>
                  <span>{factorLabel(f.key, f.label)}</span>
                  <span className="ftc-bar" role="progressbar" aria-label={factorLabel(f.key, f.label)} aria-valuemin={0} aria-valuemax={f.max} aria-valuenow={f.points}>
                    <span style={{ width: `${Math.round((f.points / f.max) * 100)}%` }} />
                  </span>
                  <span className="pts">+{localDigits(f.points)}</span>
                </div>
              ))}
            </section>
          ) : null}

          {item.kind === 'service' ? (
            <section className="ftc-card t-prio" aria-labelledby="bk">
              <h2 className="w-h3" id="bk" style={{ marginBottom: 14 }}>{tr('تفاصيل الحجز', 'Booking details')}</h2>
              <dl className="a-dl">
                {bookingRows(item.request, tr).map((r) => (
                  <Fragment key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></Fragment>
                ))}
              </dl>
            </section>
          ) : null}

          <section className="ftc-card t-tl" aria-labelledby="tl">
            <h2 className="w-h3" id="tl" style={{ marginBottom: 16 }}>{isReport ? tr('مراحل البلاغ', 'Report progress') : tr('مراحل الطلب', 'Request progress')}</h2>
            <ol className="ftc-timeline" data-testid="timeline">
              {steps.map((s) => (
                <li key={s.key} className={s.state === 'done' ? 'is-done' : s.state === 'current' ? 'is-current' : undefined} aria-current={s.state === 'current' ? 'step' : undefined}>
                  <b>{s.title}</b>
                  {s.detail ? <span className="n">{s.detail}</span> : null}
                  {s.at ? <span className="tm">{formatTime(s.at)}</span> : null}
                </li>
              ))}
            </ol>
          </section>

          {incident ? <ReopenCard key={incident.id} incidentId={incident.id} status={incident.status} /> : null}

          {API_MODE === 'mock' ? (
            <div className="w-stack" style={{ gap: 6, alignItems: 'center' }}>
              <button className="ftc-btn ftc-btn--ghost ftc-btn--sm" type="button" disabled={simulating || !isOpenStatus(item.status)} onClick={() => void simulate()} data-testid="simulate-progress">
                <Icon name="refresh" size={18} />{tr('محاكاة تحديث الحالة', 'Simulate a status update')}
              </button>
              {simulateError ? <span className="a-err">{tr('المحاكاة مش متاحة دلوقتي.', "Simulation isn't available right now.")}</span> : null}
            </div>
          ) : null}
        </div>

        <aside className="t-side" aria-label={tr('خيارات', 'Options')}>
          <div className="ftc-card w-stack" style={{ gap: 14 }}>
            <h2 className="w-h3">{tr('التحديثات', 'Updates')}</h2>
            <ToggleRow
              bare
              icon="whatsapp"
              title={tr('ابعتلي التحديثات على واتساب', 'Send me updates on WhatsApp')}
              subtitle={<>{tr('على رقم', 'To')} {phone ? <bdi dir="ltr">{maskPhone(phone)}</bdi> : tr('موبايلك', 'your phone')}{tr(' — ولو مفيش نت هتوصلك SMS', ". No internet? We'll send an SMS instead.")}</>}
              on={whatsapp}
              onChange={(v) => setPrefs({ whatsappUpdates: v })}
              testId="toggle-whatsapp"
            />
          </div>
          {isReport ? (
            <div className="ftc-card w-stack" style={{ gap: 14 }}>
              <h2 className="w-h3">{tr('شارك البلاغ', 'Share this report')}</h2>
              {incident ? <div className="t-follow"><Icon name="users" size={20} /><span>{followersLine(incident.followers)}</span></div> : null}
              <button className="ftc-btn ftc-btn--secondary ftc-btn--block" type="button" onClick={() => void shareText(message, link)}><Icon name="share" size={20} />{tr('ابعت البلاغ لجروب العمارة', 'Share with your building group')}</button>
              <a className="ftc-btn ftc-btn--secondary ftc-btn--block w-neutral" href={whatsappHref(message, link)} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size={20} />{tr('ابعته على واتساب', 'Send on WhatsApp')}</a>
            </div>
          ) : null}
          {isReport ? (
            <div className="ftc-notice"><Icon name="info" size={20} className="w-notice-ic" /><span>{tr('الأولوية بتتحسب من خطورة المشكلة، قربها من مدرسة أو مستشفى، وعدد اللي بلّغوا عنها.', 'Priority is worked out from how serious the problem is, how close it is to a school or hospital, and how many people reported it.')}</span></div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
