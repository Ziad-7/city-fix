import { toArabicDigits } from '@/utils/digits';

export type MedalInfo = { title: string; threshold: number };

export const MEDALS: MedalInfo[] = [
  { threshold: 10, title: 'جدع الحي' },
  { threshold: 3, title: 'جدع الشارع' },
];

/** Medal earned for a number of reports: 3+ جدع الشارع, 10+ جدع الحي; none below 3. */
export function medalTitle(reportCount: number): string | null {
  return MEDALS.find((m) => reportCount >= m.threshold)?.title ?? null;
}

/** Next medal to aim for, with how many more reports it needs. */
export function nextMedal(reportCount: number): { title: string; remaining: number; progress: number } | null {
  const next = [...MEDALS].reverse().find((m) => reportCount < m.threshold);
  if (!next) return null;
  const prev = MEDALS.find((m) => m.threshold < next.threshold)?.threshold ?? 0;
  return { title: next.title, remaining: next.threshold - reportCount, progress: (reportCount - prev) / (next.threshold - prev) };
}

/** "فاضل بلاغين وتاخد لقب جدع الشارع", with Arabic count agreement. */
export function remainingLine(remaining: number, title: string): string {
  const count = remaining === 1 ? 'بلاغ واحد' : remaining === 2 ? 'بلاغين' : `${toArabicDigits(remaining)} ${remaining <= 10 ? 'بلاغات' : 'بلاغ'}`;
  return `فاضل ${count} وتاخد لقب ${title}`;
}
