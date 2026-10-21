import { PRIORITY_LEVEL_EN } from '@/i18n/labels';
import { usePrefs } from '@/store/usePrefs';
import { toArabicDigits } from '@/utils/digits';
import type { Priority, PriorityFactor, Severity } from '@/domain/types';

export type PriorityInput = {
  severity: Severity;
  /** A school, hospital or similar sensitive place is close by. */
  nearSensitivePlace: boolean;
  /** Number of citizens who reported (linked reports). */
  reporters: number;
  daysOpen: number;
  /** Working-day response target for the category. */
  targetDays: number;
  /** District flagged as underserved (area equity). */
  areaUnderserved: boolean;
};

export const SEVERITY_POINTS: Record<Severity, number> = { low: 5, medium: 15, high: 28, critical: 40 };
const MAX = { severity: 40, sensitive: 20, reporters: 20, age: 15, equity: 5 } as const;

/**
 * Deterministic priority score 0-100. Every factor is returned with an Arabic label
 * and its points so the UI can explain the score ("explain, don't hide").
 */
export function computePriority(input: PriorityInput): Priority {
  const reporters = Math.max(1, Math.floor(input.reporters));
  const ratio = input.targetDays > 0 ? input.daysOpen / input.targetDays : 0;

  const factors: PriorityFactor[] = [
    { key: 'severity', label: 'خطورة المشكلة', points: SEVERITY_POINTS[input.severity], max: MAX.severity },
    { key: 'sensitive', label: 'قريب من مدرسة أو مستشفى', points: input.nearSensitivePlace ? MAX.sensitive : 0, max: MAX.sensitive },
    { key: 'reporters', label: 'عدد المواطنين اللي بلّغوا', points: Math.min(MAX.reporters, (reporters - 1) * 3), max: MAX.reporters },
    { key: 'age', label: 'مدة الانتظار مقارنة بالمستهدف', points: Math.min(MAX.age, Math.round(ratio * 10)), max: MAX.age },
    { key: 'equity', label: 'منطقة محتاجة اهتمام أكتر', points: input.areaUnderserved ? MAX.equity : 0, max: MAX.equity },
  ];
  const score = Math.min(100, factors.reduce((s, f) => s + f.points, 0));
  return { score, factors };
}

export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';

export function priorityLevel(score: number): PriorityLevel {
  if (score >= 85) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/** Arabic labels; use priorityLevelLabel() in UI. */
export const PRIORITY_LABEL_AR: Record<PriorityLevel, string> = {
  critical: 'أولوية عاجلة',
  high: 'أولوية عالية',
  medium: 'أولوية متوسطة',
  low: 'أولوية عادية',
};

/** Critical means a life-safety severity or an urgent score; both get the red "خطر" badge. */
export function isCriticalIncident(i: { severity: Severity; priority: Pick<Priority, 'score'> }): boolean {
  return i.severity === 'critical' || priorityLevel(i.priority.score) === 'critical';
}

/**
 * One-line reason, e.g. "أولوية عالية: قريب من مدرسة + ٧ بلاغات".
 * Reasons are only listed from medium priority up; a regular-priority line is the
 * label alone, so it never contradicts itself ("أولوية عادية — خطورة عالية").
 */
export function priorityReason(p: Priority, reporters: number, sensitivePlace?: string): string {
  const level = priorityLevel(p.score);
  const sev = p.factors.find((f) => f.key === 'severity');
  const highSeverity = !!sev && sev.points >= SEVERITY_POINTS.high;
  if (usePrefs.getState().lang === 'en') {
    const label = PRIORITY_LEVEL_EN[level];
    if (level === 'low') return label;
    const parts: string[] = [];
    if (sensitivePlace) parts.push('near a school or hospital');
    if (reporters > 1) parts.push(`${reporters} reports`);
    if (highSeverity) parts.push('high risk');
    return parts.length ? `${label}: ${parts.join(' + ')}` : label;
  }
  const label = PRIORITY_LABEL_AR[level];
  if (level === 'low') return label;
  const parts: string[] = [];
  if (sensitivePlace) parts.push(`قريب من ${sensitivePlace}`);
  if (reporters > 1) parts.push(`${toArabicDigits(reporters)} بلاغات`);
  if (highSeverity) parts.push('خطورة عالية');
  return parts.length ? `${label}: ${parts.join(' + ')}` : label;
}

/** Priority level label in the current language. */
export const priorityLevelLabel = (level: PriorityLevel): string => (usePrefs.getState().lang === 'en' ? PRIORITY_LEVEL_EN[level] : PRIORITY_LABEL_AR[level]);
