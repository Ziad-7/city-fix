import { z } from 'zod';
import { isolateLtr, isValidEgyptPhone } from '@/utils/digits';

export const phoneSchema = z.string().refine(isValidEgyptPhone, { message: 'رقم الموبايل مش صح، اكتب ١١ رقم زي ' + isolateLtr('010 1234 5678') });

export const otpSchema = z.string().regex(/^\d{6}$/, { message: 'الكود ٦ أرقام' });

export const placeSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  address: z.string().min(3, 'اكتب العنوان'),
  landmark: z.string().optional(),
});

/** A report needs a photo OR a description of at least this many characters. */
export const MIN_DESCRIPTION = 10;

export const newReportSchema = z
  .object({
    categoryId: z.string().min(1, 'اختار نوع المشكلة'),
    description: z.string().trim(),
    photoUris: z.array(z.string()),
    location: placeSchema,
    anonymous: z.boolean(),
    blurFaces: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.photoUris.length === 0 && v.description.length < MIN_DESCRIPTION) {
      ctx.addIssue({ code: 'custom', path: ['description'], message: 'ضيف صورة أو اكتب وصف للمشكلة (١٠ حروف على الأقل)' });
    }
  });

export const bulkyBookingSchema = z.object({
  items: z.array(z.string()).min(1, 'اختار حاجة واحدة على الأقل'),
  day: z.string().min(1, 'اختار اليوم'),
  slot: z.enum(['morning', 'afternoon']),
  payment: z.enum(['cash', 'fawry', 'instapay', 'wallet']),
});

export const treeBookingSchema = z.object({
  workType: z.string().min(1, 'اختار نوع الشغل'),
  day: z.string().min(1, 'اختار اليوم'),
  slot: z.enum(['morning', 'afternoon']),
  note: z.string().trim().optional(),
});
