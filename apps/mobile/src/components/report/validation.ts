import { z } from 'zod';
import { newReportSchema } from '@/domain/schemas';

export const MIN_DESCRIPTION = 10;

/**
 * The shared newReportSchema asks for a photo AND a description. The product rule is looser:
 * a category, a location, and at least a photo OR a description of 10+ characters.
 */
export const reportFormSchema = newReportSchema
  .extend({
    description: z.string().trim(),
    photoUris: z.array(z.string()),
  })
  .superRefine((v, ctx) => {
    if (v.photoUris.length === 0 && v.description.length < MIN_DESCRIPTION) {
      ctx.addIssue({ code: 'custom', path: ['description'], message: 'ضيف صورة أو اكتب وصف للمشكلة (١٠ حروف على الأقل)' });
    }
  });

export type ReportFormValues = z.input<typeof reportFormSchema>;
export type ReportFormErrors = Partial<Record<'categoryId' | 'description' | 'address', string>>;

/** Returns inline error messages keyed by field (empty object when valid). */
export function validateReportForm(values: ReportFormValues): ReportFormErrors {
  const res = reportFormSchema.safeParse(values);
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
