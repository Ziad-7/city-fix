'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  DEFAULT_GARBAGE_SCHEDULE,
  WEEKDAY_CODES,
  nextCollection,
  perWeekAr,
  scheduleSummary,
  weekdayLabel,
  windowLabel,
  type GarbageSchedule,
} from '@/domain/garbage-schedule';
import { placeName, useLang, useTr } from '@/i18n';
import { usePageTitle } from '@/lib/usePageTitle';
import { getGarbageSchedule } from '@/services/garbage-schedule';
import { useSession } from '@/store';
import { Icon } from '@/ui/Icon';

const TIPS: { ar: string; en: string }[] = [
  { ar: 'حط الأكياس مقفولة قبل الميعاد بساعة.', en: 'Put your bags out, tied shut, an hour before pickup.' },
  { ar: 'سيب الأكياس جنب باب العمارة مش في نص الشارع.', en: 'Leave bags next to the building entrance, not in the middle of the street.' },
  { ar: 'افصل المخلفات الكبيرة، وللعفش القديم احجز خدمة "رفع مخلفات كبيرة".', en: 'Keep large items separate. For old furniture, book “Bulky waste pickup”.' },
];

/** English text for the demo schedule notes (the Arabic note comes with the schedule data). */
const NOTE_EN: Record<string, string> = {
  'لو العربية اتأخرت أكتر من ساعتين، بلّغ من الزرار تحت.': 'If the truck is more than 2 hours late, report it with the button below.',
};

/** "٣ مرات في الأسبوع" / "3 times a week". */
function perWeekLabel(n: number, lang: 'ar' | 'en'): string {
  if (lang === 'ar') return perWeekAr(n);
  return n === 1 ? 'Once a week' : n === 2 ? 'Twice a week' : `${n} times a week`;
}

/** مواعيد جمع القمامة in the citizen's district, with the next collection highlighted (same data as the app's screen). */
export default function GarbageSchedulePage() {
  const tr = useTr();
  const lang = useLang();
  usePageTitle(tr('مواعيد جمع القمامة', 'Garbage collection times'));
  const district = useSession((s) => s.district);
  const governorate = useSession((s) => s.governorate);
  const [schedule, setSchedule] = useState<GarbageSchedule | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getGarbageSchedule(district).then((s) => {
      if (!cancelled) setSchedule(s);
    });
    return () => {
      cancelled = true;
    };
  }, [district]);

  const days = schedule?.days ?? DEFAULT_GARBAGE_SCHEDULE.days;
  const next = nextCollection(days);

  return (
    <main className="ftc-web-main" id="main" style={{ maxWidth: 760 }}>
      <Link className="w-back" href="/services"><Icon name="arrow-back" size={18} />{tr('خدمات المدينة', 'City services')}</Link>
      <div className="w-sec-head" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="w-h1">{tr('مواعيد جمع القمامة', 'Garbage collection times')}</h1>
          <p className="w-sub g-area"><Icon name="pin" size={16} />{tr(`حي ${district}، ${governorate}`, `${placeName(district)}, ${placeName(governorate)}`)}</p>
        </div>
      </div>

      {schedule ? (
        <div className="w-stack" style={{ gap: 16 }}>
          {next ? (
            <section className="g-next" aria-label={`${tr('الجاية', 'Next pickup')}: ${next.label}`} data-testid="garbage-next">
              <span className="k">{tr('الجاية', 'Next pickup')}</span>
              <b>{next.label}</b>
              <span>{tr(`العربية بتعدّي ${windowLabel(schedule.window)}`, `Pickup time: ${windowLabel(schedule.window)}`)}</span>
            </section>
          ) : null}

          <section className="ftc-card v-sec" aria-labelledby="g1">
            <header><h2 className="w-h3" id="g1">{tr('الجدول الأسبوعي', 'Weekly schedule')}</h2><span>{perWeekLabel(schedule.days.length, lang)}</span></header>
            <ul className="g-week">
              {WEEKDAY_CODES.map((code) => {
                const on = schedule.days.includes(code);
                const isNext = next?.code === code;
                return (
                  <li
                    key={code}
                    className={`g-day${on ? ' is-on' : ''}${isNext ? ' is-next' : ''}`}
                    aria-label={`${weekdayLabel(code)}: ${on ? tr('فيه جمع', 'Collection day') : tr('مفيش جمع', 'No collection')}`}
                    data-testid={`garbage-day-${code}`}
                  >
                    {weekdayLabel(code)}
                    {on ? <Icon name="check" size={14} strokeWidth={2.5} /> : null}
                  </li>
                );
              })}
            </ul>
            <p className="w-sub" style={{ margin: 0 }}>{scheduleSummary(schedule)}</p>
            {schedule.note ? <p className="g-note">{lang === 'en' ? (NOTE_EN[schedule.note] ?? schedule.note) : schedule.note}</p> : null}
          </section>

          <section className="ftc-card v-sec" aria-labelledby="g2">
            <h2 className="w-h3" id="g2">{tr('نصايح', 'Tips')}</h2>
            <ul className="g-tips">
              {TIPS.map((t) => (
                <li key={t.ar}><Icon name="check" size={16} strokeWidth={2.5} />{tr(t.ar, t.en)}</li>
              ))}
            </ul>
          </section>

          <div>
            <Link className="ftc-btn ftc-btn--primary" href="/report/new?category=garbage" data-testid="garbage-missed">
              <Icon name="alert-triangle" size={20} />{tr('بلّغ إن العربية مجتش', 'Report a missed pickup')}
            </Link>
          </div>
        </div>
      ) : (
        <p className="w-sub" role="status">{tr('بنجيب المواعيد…', 'Loading the schedule…')}</p>
      )}
    </main>
  );
}
