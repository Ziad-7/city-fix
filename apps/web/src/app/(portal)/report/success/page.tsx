'use client';

/* eslint-disable @next/next/no-img-element -- brand mark */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { moreReportsAr } from '@/components/report/text';
import { DISTRICT_TITLE, medalFor } from '@/domain/medals';
import { absoluteUrl, copyLink, shareText, whatsappHref } from '@/lib/share';
import { useReports, useSession } from '@/store';
import { isolateLtr, toArabicDigits } from '@/utils/digits';
import { MedalIcon } from '@/ui/brand';
import { Icon } from '@/ui/Icon';

export default function SuccessPage() {
  const router = useRouter();
  const last = useReports((s) => s.lastSubmitted);
  const reportCount = useReports((s) => s.reports.length);
  const whatsapp = useSession((s) => s.prefs.whatsappUpdates);

  // Reloading this page (or opening it directly) has nothing to show: go home, like the app.
  useEffect(() => {
    if (!last) router.replace('/');
  }, [last, router]);
  if (!last) return null;

  const { report, incident } = last;
  const joined = incident.linkedReportIds[0] !== report.id;
  const medal = medalFor(reportCount);
  const n = toArabicDigits(reportCount);
  const steps = [
    'موظف الحي هيراجعه خلال ٢٤ ساعة',
    `هيتحوّل للجهة المسؤولة: ${incident.department}`,
    whatsapp ? 'هنبعتلك على واتساب في كل خطوة' : 'هنبعتلك رسالة SMS في كل خطوة',
  ];
  const message = `بلّغت عن مشكلة على فيكس ذا سيتي، ورقم البلاغ ${isolateLtr(`#${report.id}`)}. لو شايفها كمان، افتح التطبيق وقول "أنا كمان" عشان نرفع أولويتها.`;
  const link = absoluteUrl(`/requests/${report.id}`);

  return (
    <main className="ftc-web-main" id="main" style={{ paddingTop: 40 }}>
      <div className="u-card" role="status" data-testid="success">
        <div className="u-hero">
          <span className="u-disc"><img src="/brand/fixthecity-mark.svg" alt="" /></span>
          <h1>تسلم إيدك!</h1>
          {joined ? (
            <p>اتضمّيت للبلاغ الموجود، رقمه <b dir="ltr">#{incident.linkedReportIds[0]}</b>. ده بيرفع أولويته.</p>
          ) : (
            <p>بلاغك وصل، ورقمه <b dir="ltr" data-testid="report-number">#{report.id}</b></p>
          )}
        </div>
        <div className="u-body">
          <section className="u-next" aria-labelledby="nx">
            <h2 className="w-h3" id="nx">اللي جاي</h2>
            {steps.map((s, i) => (
              <div className="u-step" key={s}><i>{toArabicDigits(i + 1)}</i><span>{s}</span></div>
            ))}
          </section>
          <section className="u-medal" aria-label="لقب المجتمع">
            <div className="top">
              <MedalIcon size={56} />
              <span>
                <span className="cap">{medal.tier === 'none' ? 'في الطريق للقب' : medal.tier === 'district' ? 'أعلى لقب' : 'لقب جديد'}</span>
                <span className="ttl">{medal.title}</span>
              </span>
            </div>
            <p className="ftc-small" style={{ margin: 0 }}>
              {medal.next ? <>ده بلاغك رقم {n}. {moreReportsAr(medal.remaining)} وتاخد لقب <b>{medal.next.title}</b>.</> : `ده بلاغك رقم ${n}. ده أعلى لقب، شكرًا إنك بتصلّح مدينتك.`}
            </p>
            <div className="pr">
              <span className="ftc-bar" role="progressbar" aria-valuemin={0} aria-valuemax={medal.goal} aria-valuenow={Math.min(reportCount, medal.goal)}>
                <span style={{ width: `${Math.round(medal.progress * 100)}%` }} />
              </span>
              <b><bdi dir="ltr">{toArabicDigits(Math.min(reportCount, medal.goal))} / {toArabicDigits(medal.goal)}</bdi></b>
            </div>
            {medal.tier === 'street' ? (
              <span className="earned"><Icon name="check" size={14} strokeWidth={3} />اللقب ده بقى ليك. الهدف الجاي: {DISTRICT_TITLE}</span>
            ) : null}
          </section>
          <section className="u-share" aria-label="مشاركة">
            <h2 className="w-h3">شارك البلاغ عشان جيرانك يقولوا «أنا كمان»</h2>
            <div className="row">
              <button className="ftc-btn ftc-btn--secondary" type="button" onClick={() => void shareText(message, link)}><Icon name="share" size={20} />ابعته لجروب العمارة</button>
              <a className="ftc-btn ftc-btn--secondary" href={whatsappHref(message, link)} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size={20} />واتساب</a>
              <button
                className="ftc-btn ftc-btn--secondary w-neutral"
                type="button"
                onClick={() => void copyLink(link)}
              >
                <Icon name="clipboard" size={20} />انسخ الرابط
              </button>
            </div>
            <div className="u-foot">
              <Link className="ftc-btn ftc-btn--primary" href={`/requests/${report.id}`} style={{ minWidth: 200 }} data-testid="track-report">تابع البلاغ</Link>
              <Link className="w-link" href="/">الرئيسية</Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
