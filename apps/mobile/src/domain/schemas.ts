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

export const newReportSchema = z.object({
  categoryId: z.string().min(1, 'اختار نوع المشكلة'),
  description: z.string().trim().min(5, 'اكتب وصف قصير للمشكلة (٥ حروف على الأقل)'),
  photoUris: z.array(z.string()).min(1, 'ضيف صورة للمشكلة'),
  location: placeSchema,
  anonymous: z.boolean(),
  blurFaces: z.boolean(),
});

export const bulkyBookingSchema = z.object({
  items: z.array(z.string()).min(1, 'اختار حاجة واحدة على الأقل'),
  day: z.string().min(1, 'اختار اليوم'),
  slot: z.enum(['morning', 'afternoon']),
  payment: z.enum(['cash', 'fawry', 'instapay', 'wallet']),
});
