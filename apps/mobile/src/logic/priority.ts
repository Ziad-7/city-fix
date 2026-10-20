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

export const PRIORITY_LABEL_AR: Record<PriorityLevel, string> = {
  critical: 'أولوية عاجلة',
  high: 'أولوية عالية',
  medium: 'أولوية متوسطة',
  low: 'أولوية عادية',
};

/** One-line reason, e.g. "أولوية عالية: قريب من مدرسة + ٧ بلاغات". */
export function priorityReason(p: Priority, reporters: number, sensitivePlace?: string): string {
  const parts: string[] = [];
  if (sensitivePlace) parts.push(`قريب من ${sensitivePlace}`);
  if (reporters > 1) parts.push(`${toArabicDigits(reporters)} بلاغات`);
  const sev = p.factors.find((f) => f.key === 'severity');
  if (sev && sev.points >= SEVERITY_POINTS.high) parts.push('خطورة عالية');
  const label = PRIORITY_LABEL_AR[priorityLevel(p.score)];
  return parts.length ? `${label}: ${parts.join(' + ')}` : label;
}
