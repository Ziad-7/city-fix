import { PICKUP_TIMELINE_STATUS, type PickupStatus } from '@/domain/citycycle';
import { toArabicDigits } from '@/utils/digits';
import type { DbTimelineEntry } from './timeline';

type Who = { collectorName?: string; collectorNameEn?: string };

/** "2.5" -> "٢٫٥" for stored Arabic notes. */
const arNum = (n: number) => toArabicDigits(String(Math.round(n * 100) / 100)).replace('.', '٫');
const enNum = (n: number) => String(Math.round(n * 100) / 100);

/**
 * Timeline entry of a pickup as the mock stores it (Arabic + English, like the other mock timelines).
 * `extra.kind: 'started'` is the collector's "on my way" (still the `accepted` status).
 */
export function pickupTimelineEntry(
  status: PickupStatus,
  at: string,
  who: Who = {},
  extra: { kind?: 'started'; totalKg?: number; paidEgp?: number } = {},
): DbTimelineEntry {
  const timelineStatus = PICKUP_TIMELINE_STATUS[status];
  const name = who.collectorName ?? 'الجامع';
  const nameEn = who.collectorNameEn ?? 'The collector';
  switch (status) {
    case 'requested':
      return { status: timelineStatus, at, actor: 'سيتي سايكل', actorEn: 'CityCycle', note: 'وصلنا طلب الفرز', noteEn: 'We got your recycling request' };
    case 'accepted':
      return extra.kind === 'started'
        ? { status: timelineStatus, at, actor: name, actorEn: nameEn, note: `${name} في الطريق`, noteEn: `${nameEn} is on the way` }
        : { status: timelineStatus, at, actor: name, actorEn: nameEn, note: `اتقبل الطلب: ${name}`, noteEn: `Accepted by ${nameEn}` };
    case 'weighed': {
      const kg = extra.totalKg ?? 0;
      return { status: timelineStatus, at, actor: name, actorEn: nameEn, note: `اتوزنت الخامات: ${arNum(kg)} كجم`, noteEn: `Materials weighed: ${enNum(kg)} kg` };
    }
    case 'completed': {
      const paid = extra.paidEgp ?? 0;
      return {
        status: timelineStatus,
        at,
        actor: name,
        actorEn: nameEn,
        note: paid > 0 ? `خلص الاستلام. اتدفع ${arNum(paid)} جنيه. تسلم إيدك!` : 'خلص الاستلام. تسلم إيدك!',
        noteEn: paid > 0 ? `Pickup done. ${enNum(paid)} EGP paid. Thank you!` : 'Pickup done. Thank you!',
      };
    }
    default:
      return { status: timelineStatus, at, actor: 'سيتي سايكل', actorEn: 'CityCycle', note: 'اتلغى الطلب', noteEn: 'Request cancelled' };
  }
}
