'use client';

import { dayLabel, dayParts, parseIsoDay } from '@/components/services/day';
import { ChoiceGroup } from './controls';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

/** The booking day tiles (weekday, day of month, month): one radiogroup, arrows move between the days. */
export function DayPicker({ days, value, onChange, columns }: { days: string[]; value: string; onChange: (d: string) => void; columns?: number }) {
  return (
    <ChoiceGroup
      className="v-days"
      label="اليوم"
      marker={false}
      value={value}
      onChange={onChange}
      testIdPrefix="day"
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
      options={days.map((d) => {
        const p = dayParts(d);
        return {
          id: d,
          ariaLabel: dayLabel(d),
          className: 'v-day',
          style: { flexDirection: 'column', padding: '12px 4px', gap: 2 },
          label: <><span>{p.weekday}</span><b>{p.dayOfMonth}</b><small>{MONTHS[parseIsoDay(d).getMonth()]}</small></>,
        };
      })}
    />
  );
}
