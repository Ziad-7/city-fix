import type { z } from 'zod';
import { tr } from '@/i18n';
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
    if (head === 'categoryId') errors.categoryId ??= tr('اختار نوع المشكلة', 'Choose the type of problem');
    else if (head === 'description') errors.description ??= issue.message;
    else if (head === 'location') errors.address ??= tr('اكتب العنوان', 'Enter the address');
  }
  return errors;
}
