export type MedalTier = 'none' | 'street' | 'district';

export type MedalState = {
  /** Highest title earned so far. */
  tier: MedalTier;
  /** Title shown on the card: the earned one, or the one being worked towards when nothing is earned yet. */
  title: string;
  /** The next title and how many reports it needs (null once everything is earned). */
  next: { title: string; goal: number } | null;
  /** Reports still missing for `next` (0 when there is no next). */
  remaining: number;
  /** Progress bar value 0..1 and the "٣ / ١٠" denominator. */
  progress: number;
  goal: number;
};

export const STREET_TITLE = 'جدع الشارع';
export const DISTRICT_TITLE = 'جدع الحي';
export const STREET_GOAL = 3;
export const DISTRICT_GOAL = 10;

/** Community medals: 3 reports = جدع الشارع, 10 reports = جدع الحي. */
export function medalFor(reportCount: number): MedalState {
  const n = Math.max(0, Math.floor(reportCount));
  if (n < STREET_GOAL) {
    return {
      tier: 'none',
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
      title: STREET_TITLE,
      next: { title: DISTRICT_TITLE, goal: DISTRICT_GOAL },
      remaining: DISTRICT_GOAL - n,
      progress: n / DISTRICT_GOAL,
      goal: DISTRICT_GOAL,
    };
  }
  return { tier: 'district', title: DISTRICT_TITLE, next: null, remaining: 0, progress: 1, goal: DISTRICT_GOAL };
}
