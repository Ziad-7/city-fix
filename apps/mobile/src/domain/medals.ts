import { toArabicDigits } from '@/utils/digits';

/** Single source of truth for community medals (profile card and report-success card). */
export const STREET_TITLE = 'جدع الشارع';
export const DISTRICT_TITLE = 'جدع الحي';
export const STREET_GOAL = 3;
export const DISTRICT_GOAL = 10;

export type MedalTier = 'none' | 'street' | 'district';

export type MedalState = {
  /** Highest title earned so far. */
  tier: MedalTier;
  /** Title earned so far, or null below the first goal. */
  earnedTitle: string | null;
  /** Title shown on a card: the earned one, or the first one being worked towards. */
  title: string;
  /** The next title and how many reports it needs (null once everything is earned). */
  next: { title: string; goal: number } | null;
  /** Reports still missing for `next` (0 when there is no next). */
  remaining: number;
  /** Progress bar value 0..1, defined as reports / goal (the "٣ / ١٠" shown next to the bar). */
  progress: number;
  /** Denominator of the progress ("٣ / ١٠"). */
  goal: number;
};

/** Community medals: 3 reports = جدع الشارع, 10 reports = جدع الحي. */
export function medalFor(reportCount: number): MedalState {
  const n = Math.max(0, Math.floor(reportCount));
  if (n < STREET_GOAL) {
    return {
      tier: 'none',
      earnedTitle: null,
      title: STREET_TITLE,
      next: { title: STREET_TITLE, goal: STREET_GOAL },
      remaining: STREET_GOAL - n,
      progress: n / STREET_GOAL,
      goal: STREET_GOAL,
    };
  }
  if (n < DISTRICT_GOAL) {
    return {
      tier: 'street',
      earnedTitle: STREET_TITLE,
      title: STREET_TITLE,
      next: { title: DISTRICT_TITLE, goal: DISTRICT_GOAL },
      remaining: DISTRICT_GOAL - n,
      progress: n / DISTRICT_GOAL,
      goal: DISTRICT_GOAL,
    };
  }
  return { tier: 'district', earnedTitle: DISTRICT_TITLE, title: DISTRICT_TITLE, next: null, remaining: 0, progress: 1, goal: DISTRICT_GOAL };
}

/** "فاضل بلاغين وتاخد لقب جدع الشارع", with Arabic count agreement. */
export function remainingLine(remaining: number, title: string): string {
  const count = remaining === 1 ? 'بلاغ واحد' : remaining === 2 ? 'بلاغين' : `${toArabicDigits(remaining)} ${remaining <= 10 ? 'بلاغات' : 'بلاغ'}`;
  return `فاضل ${count} وتاخد لقب ${title}`;
}
