import { toArabicDigits } from '@/utils/digits';
import { PAYMENT_METHODS, SLOTS } from '@/domain/services-catalog';
import type { PaymentMethod, SlotId } from '@/domain/types';

export const slotLabel = (id: SlotId) => SLOTS.find((s) => s.id === id)?.labelAr ?? id;
export const paymentLabel = (id: PaymentMethod) => PAYMENT_METHODS.find((p) => p.id === id)?.labelAr ?? id;

/** "٧ مواطنين متابعين البلاغ ده", with the Arabic count agreement (1, 2, 3-10, 11+). */
export function followersLine(n: number): string {
  if (n <= 0) return 'لسه محدش بيتابع البلاغ ده';
  if (n === 1) return 'مواطن واحد بيتابع البلاغ ده';
  if (n === 2) return 'مواطنين بيتابعوا البلاغ ده';
  if (n <= 10) return `${toArabicDigits(n)} مواطنين متابعين البلاغ ده`;
  return `${toArabicDigits(n)} مواطن متابعين البلاغ ده`;
}
