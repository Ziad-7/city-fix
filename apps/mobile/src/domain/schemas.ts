import { z } from 'zod';
import { tr } from '@/i18n';
import { isolateLtr, isValidEgyptPhone } from '@/utils/digits';

/** Zod messages are built when a value is validated (not when the schema loads), so they follow the current language. */
const msg = (ar: string, en: string) => ({ error: () => tr(ar, en) });

export const phoneSchema = z.string().refine(isValidEgyptPhone, {
  // English keeps the example number on one line (no-break spaces); the Arabic text is unchanged.
  error: () => tr('رقم الموبايل مش صح، اكتب ١١ رقم زي ', "That phone number doesn't look right. Enter 11 digits, like ") + isolateLtr(tr('010 1234 5678', '010 1234 5678')),
});

export const otpSchema = z.string().regex(/^\d{6}$/, msg('الكود ٦ أرقام', 'The code is 6 digits'));

export const placeSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  address: z.string().min(3, msg('اكتب العنوان', 'Enter the address')),
  landmark: z.string().optional(),
});

/** A report needs a photo OR a description of at least this many characters. */
export const MIN_DESCRIPTION = 10;

export const newReportSchema = z
  .object({
    categoryId: z.string().min(1, msg('اختار نوع المشكلة', 'Choose the type of problem')),
    description: z.string().trim(),
    photoUris: z.array(z.string()),
    location: placeSchema,
    anonymous: z.boolean(),
    blurFaces: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.photoUris.length === 0 && v.description.length < MIN_DESCRIPTION) {
      ctx.addIssue({ code: 'custom', path: ['description'], message: tr('ضيف صورة أو اكتب وصف للمشكلة (١٠ حروف على الأقل)', 'Add a photo or describe the problem (at least 10 characters)') });
    }
  });

export const bulkyBookingSchema = z.object({
  items: z.array(z.string()).min(1, msg('اختار حاجة واحدة على الأقل', 'Choose at least one item')),
  day: z.string().min(1, msg('اختار اليوم', 'Choose a day')),
  slot: z.enum(['morning', 'afternoon']),
  payment: z.enum(['cash', 'fawry', 'instapay', 'wallet']),
});

export const treeBookingSchema = z.object({
  workType: z.string().min(1, msg('اختار نوع الشغل', 'Choose the type of work')),
  day: z.string().min(1, msg('اختار اليوم', 'Choose a day')),
  slot: z.enum(['morning', 'afternoon']),
  note: z.string().trim().optional(),
});
