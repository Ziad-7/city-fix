import type { z } from 'zod';
import { newReportSchema } from '@/domain/schemas';

export { MIN_DESCRIPTION } from '@/domain/schemas';

export type ReportFormValues = z.input<typeof newReportSchema>;
export type ReportFormErrors = Partial<Record<'categoryId' | 'description' | 'address', string>>;

/** Maps the shared `newReportSchema` issues to inline messages keyed by field (empty object when valid). */
export function validateReportForm(values: ReportFormValues): ReportFormErrors {
  const res = newReportSchema.safeParse(values);
  if (res.success) return {};
  const errors: ReportFormErrors = {};
  for (const issue of res.error.issues) {
    const head = issue.path[0];
    if (head === 'categoryId') errors.categoryId ??= 'اختار نوع المشكلة';
    else if (head === 'description') errors.description ??= issue.message;
    else if (head === 'location') errors.address ??= 'اكتب العنوان';
  }
  return errors;
}
