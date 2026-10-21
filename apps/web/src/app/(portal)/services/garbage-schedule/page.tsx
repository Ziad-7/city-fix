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
import { usePageTitle } from '@/lib/usePageTitle';
import { getGarbageSchedule } from '@/services/garbage-schedule';
import { useSession } from '@/store';
import { Icon } from '@/ui/Icon';

const TIPS = [
  'حط الأكياس مقفولة قبل الميعاد بساعة.',
  'سيب الأكياس جنب باب العمارة مش في نص الشارع.',
  'افصل المخلفات الكبيرة، وللعفش القديم احجز خدمة "رفع مخلفات كبيرة".',
];

/** مواعيد جمع القمامة in the citizen's district, with the next collection highlighted (same data as the app's screen). */
export default function GarbageSchedulePage() {
  usePageTitle('مواعيد جمع القمامة');
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
      <Link className="w-back" href="/services"><Icon name="arrow-back" size={18} />خدمات المدينة</Link>
      <div className="w-sec-head" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="w-h1">مواعيد جمع القمامة</h1>
          <p className="w-sub g-area"><Icon name="pin" size={16} />حي {district}، {governorate}</p>
        </div>
      </div>

      {schedule ? (
        <div className="w-stack" style={{ gap: 16 }}>
          {next ? (
            <section className="g-next" aria-label={`الجاية: ${next.label}`} data-testid="garbage-next">
              <span className="k">الجاية</span>
              <b>{next.label}</b>
              <span>العربية بتعدّي {windowLabel(schedule.window)}</span>
            </section>
          ) : null}

          <section className="ftc-card v-sec" aria-labelledby="g1">
            <header><h2 className="w-h3" id="g1">الجدول الأسبوعي</h2><span>{perWeekAr(schedule.days.length)}</span></header>
            <ul className="g-week">
              {WEEKDAY_CODES.map((code) => {
                const on = schedule.days.includes(code);
                const isNext = next?.code === code;
                return (
                  <li
                    key={code}
                    className={`g-day${on ? ' is-on' : ''}${isNext ? ' is-next' : ''}`}
                    aria-label={`${weekdayLabel(code)}: ${on ? 'فيه جمع' : 'مفيش جمع'}`}
                    data-testid={`garbage-day-${code}`}
                  >
                    {weekdayLabel(code)}
                    {on ? <Icon name="check" size={14} strokeWidth={2.5} /> : null}
                  </li>
                );
              })}
            </ul>
            <p className="w-sub" style={{ margin: 0 }}>{scheduleSummary(schedule)}</p>
            {schedule.note ? <p className="g-note">{schedule.note}</p> : null}
          </section>

          <section className="ftc-card v-sec" aria-labelledby="g2">
            <h2 className="w-h3" id="g2">نصايح</h2>
            <ul className="g-tips">
              {TIPS.map((t) => (
                <li key={t}><Icon name="check" size={16} strokeWidth={2.5} />{t}</li>
              ))}
            </ul>
          </section>

          <div>
            <Link className="ftc-btn ftc-btn--primary" href="/report/new?category=garbage" data-testid="garbage-missed">
              <Icon name="alert-triangle" size={20} />بلّغ إن العربية مجتش
            </Link>
          </div>
        </div>
      ) : (
        <p className="w-sub" role="status">بنجيب المواعيد…</p>
      )}
    </main>
  );
}
