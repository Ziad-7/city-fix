'use client';

/* eslint-disable @next/next/no-img-element -- brand mark */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { moreReports } from '@/components/report/text';
import { useTr } from '@/i18n';
import { departmentLabel, medalTitle } from '@/i18n/labels';
import { DISTRICT_TITLE, medalFor } from '@/domain/medals';
import { absoluteUrl, copyLink, shareText, whatsappHref } from '@/lib/share';
import { useReports, useSession } from '@/store';
import { isolateLtr, localDigits } from '@/utils/digits';
import { MedalIcon } from '@/ui/brand';
import { Icon } from '@/ui/Icon';
import { usePageTitle } from '@/lib/usePageTitle';

export default function SuccessPage() {
  const tr = useTr();
  usePageTitle(tr('وصل بلاغك', 'We got your report'));
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
  const n = localDigits(reportCount);
  const sentReports = reportCount === 1 ? 'This is your 1st report' : `This is report number ${n}`;
  const steps = [
    tr('موظف الحي هيراجعه خلال ٢٤ ساعة', 'A district officer will review it within 24 hours'),
    tr(`هيتحوّل للجهة المسؤولة: ${incident.department}`, `Then it goes to the team in charge: ${departmentLabel(incident.department)}`),
    whatsapp ? tr('هنبعتلك على واتساب في كل خطوة', 'We’ll message you on WhatsApp at every step') : tr('هنبعتلك رسالة SMS في كل خطوة', 'We’ll text you at every step'),
  ];
  const message = tr(
    `بلّغت عن مشكلة على سيتي فيكس، ورقم البلاغ ${isolateLtr(`#${report.id}`)}. لو المشكلة عندك كمان، افتح الرابط وقول "أنا كمان" عشان نرفع أولويتها.`,
    `I reported a problem on CityFix. The report number is ${isolateLtr(`#${report.id}`)}. If you see it too, open the link and tap "Me\u00a0too" to raise its priority.`,
  );
  const link = absoluteUrl(`/requests/${report.id}`);

  return (
    <main className="ftc-web-main" id="main" style={{ paddingTop: 40 }}>
      <div className="u-card" role="status" data-testid="success">
        <div className="u-hero">
          <span className="u-disc"><img src="/brand/cityfix-mark.svg" alt="" /></span>
          <h1>{tr('تسلم إيدك!', 'Thank you!')}</h1>
          {joined ? (
            <p>{tr('بلاغك اتضم للبلاغ الموجود، رقمه ', 'You joined the existing report ')}<b dir="ltr">#{incident.linkedReportIds[0]}</b>{tr('. ده بيرفع أولويته.', '. This raises its priority.')}</p>
          ) : (
            <p>{tr('بلاغك وصل، ورقمه ', 'We got your report. Report number: ')}<b dir="ltr" data-testid="report-number">#{report.id}</b></p>
          )}
        </div>
        <div className="u-body">
          <section className="u-next" aria-labelledby="nx">
            <h2 className="w-h3" id="nx">{tr('اللي جاي', 'What’s next')}</h2>
            {steps.map((s, i) => (
              <div className="u-step" key={s}><i>{localDigits(i + 1)}</i><span>{s}</span></div>
            ))}
          </section>
          <section className="u-medal" aria-label={tr('لقب المجتمع', 'Community title')}>
            <div className="top">
              <MedalIcon size={56} />
              <span>
                <span className="cap">{medal.tier === 'none' ? tr('في الطريق للقب', 'On the way to a title') : medal.tier === 'district' ? tr('أعلى لقب', 'Highest title') : tr('لقب جديد', 'New title')}</span>
                <span className="ttl">{medalTitle(medal.title)}</span>
              </span>
            </div>
            <p className="ftc-small" style={{ margin: 0 }}>
              {medal.next ? <>{tr(`ده بلاغك رقم ${n}. ${moreReports(medal.remaining)} وتاخد لقب `, `${sentReports}. ${moreReports(medal.remaining)} to earn the title `)}<b>{medalTitle(medal.next.title)}</b>.</> : tr(`ده بلاغك رقم ${n}. ده أعلى لقب، شكرًا على مشاركتك في تصليح مدينتك.`, `${sentReports}. That’s the highest title. Thanks for helping fix your city.`)}
            </p>
            <div className="pr">
              <span className="ftc-bar" role="progressbar" aria-label={tr('التقدّم للقب الجاي', 'Progress to the next title')} aria-valuemin={0} aria-valuemax={medal.goal} aria-valuenow={Math.min(reportCount, medal.goal)}>
                <span style={{ width: `${Math.round(medal.progress * 100)}%` }} />
              </span>
              <b><bdi dir="ltr">{localDigits(Math.min(reportCount, medal.goal))} / {localDigits(medal.goal)}</bdi></b>
            </div>
            {medal.tier === 'street' ? (
              <span className="earned"><Icon name="check" size={14} strokeWidth={3} />{tr('اللقب ده بقى ليك. الهدف الجاي: ', 'The title is yours. Next goal: ')}{medalTitle(DISTRICT_TITLE)}</span>
            ) : null}
          </section>
          <section className="u-share" aria-label={tr('مشاركة', 'Share')}>
            <h2 className="w-h3">{tr('شارك البلاغ عشان جيرانك يقولوا «أنا كمان»', 'Share the report so your neighbours can say “Me\u00a0too”')}</h2>
            <div className="row">
              <button className="ftc-btn ftc-btn--secondary" type="button" onClick={() => void shareText(message, link)}><Icon name="share" size={20} />{tr('ابعته لجروب العمارة', 'Share with your building group')}</button>
              <a className="ftc-btn ftc-btn--secondary" href={whatsappHref(message, link)} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size={20} />{tr('واتساب', 'WhatsApp')}</a>
              <button
                className="ftc-btn ftc-btn--secondary w-neutral"
                type="button"
                onClick={() => void copyLink(link)}
              >
                <Icon name="clipboard" size={20} />{tr('انسخ الرابط', 'Copy the link')}
              </button>
            </div>
            <div className="u-foot">
              <Link className="ftc-btn ftc-btn--primary" href={`/requests/${report.id}`} style={{ minWidth: 200 }} data-testid="track-report">{tr('تابع البلاغ', 'Track your report')}</Link>
              <Link className="w-link" href="/">{tr('الرئيسية', 'Home')}</Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
