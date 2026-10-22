import { getLang, tr } from '@/i18n';
import { paymentLabelFor, slotLabel as slotLabelFor } from '@/i18n/labels';
import { PAYMENT_METHODS, SLOTS } from '@/domain/services-catalog';
import type { PaymentMethod, SlotId } from '@/domain/types';
import { localDigits } from '@/utils/digits';
import { formatDate, weekdayName } from '@/utils/time';

/** Labels in the current language; call them while rendering a component that uses useTr() / useLang(). */
export const slotLabel = (id: SlotId) => {
  const slot = SLOTS.find((s) => s.id === id);
  return slot ? slotLabelFor(slot) : id;
};
/** Absent payment means a free district service. */
export const paymentLabel = (id?: PaymentMethod) => {
  if (!id) return tr('مجانية', 'Free');
  const method = PAYMENT_METHODS.find((p) => p.id === id);
  return method ? paymentLabelFor(method) : id;
};

/** "Wednesday 22 Oct" / "الأربع ٢٢ أكتوبر" for an ISO day (YYYY-MM-DD), parsed as a local date. */
export function dayText(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return `${weekdayName(date.getDay())} ${formatDate(date)}`;
}

/** "٧ مواطنين متابعين البلاغ ده" (Arabic count agreement: 1, 2, 3-10, 11+) / "7 people are following this report". */
export function followersLine(n: number): string {
  if (getLang() === 'en') {
    if (n <= 0) return 'No one is following this report yet';
    if (n === 1) return '1 person is following this report';
    return `${n} people are following this report`;
  }
  if (n <= 0) return 'لسه محدش بيتابع البلاغ ده';
  if (n === 1) return 'مواطن واحد بيتابع البلاغ ده';
  if (n === 2) return 'مواطنين بيتابعوا البلاغ ده';
  if (n <= 10) return `${localDigits(n)} مواطنين متابعين البلاغ ده`;
  return `${localDigits(n)} مواطن متابعين البلاغ ده`;
}
