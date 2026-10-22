import { getLang } from '@/i18n';
import { departmentLabel } from '@/i18n/labels';
import { formatEgp, formatKg } from '@/utils/money';
import type { PickupStatus } from './citycycle';
import type { AppNotification, IncidentStatus } from './types';

/**
 * The finer stages a recycling pickup is tracked in. `accepted` and `on_the_way` are both the contract status
 * `accepted` (the collector tapped "start" for the second), so the diff needs this to notify on both.
 */
export type PickupStage = PickupStatus | 'on_the_way';

export const pickupStage = (p: { status: PickupStatus; startedAt?: string }): PickupStage => (p.status === 'accepted' && p.startedAt ? 'on_the_way' : p.status);

/** What the pickup notifications say (first name of the collector only). */
export type PickupFacts = { name?: string; totalKg?: number; paidEgp?: number };

/** One report (via its incident) or service request, as the notification diff sees it. */
export type TrackedItem = {
  entityType: AppNotification['entityType'];
  /** FTC-…, SRV-… or RCY-… */
  entityId: string;
  /** For a pickup, the incident-status colour of its status (see `pickupChipStatus`). */
  status: IncidentStatus;
  /** Pickups only: the stage the diff compares (it replaces `status` there, so "on the way" notifies too). */
  stage?: PickupStage;
  /** Pickups only: facts for the text. */
  pickup?: PickupFacts;
  /** Responsible department (reports only). */
  department?: string;
  /** Latest timeline note, used as the body when present. */
  note?: string;
};

/** Last known status per entity id (a pickup's entry is its `PickupStage`). */
export type KnownStatuses = Record<string, string>;

/** The value the diff compares and stores for an item. */
export const trackedKey = (item: Pick<TrackedItem, 'status' | 'stage'>): string => item.stage ?? item.status;

/** "ل" + name, merging with "ال": الحدائق -> للحدائق, صيانة الطرق -> لصيانة الطرق. */
const toDept = (name: string) => (name.startsWith('ال') ? `لل${name.slice(2)}` : `ل${name}`);

/** Title and body for a status change, in the current language (the text is fixed when the notification is created). */
export function describeChange(item: TrackedItem, previous: string): { title: string; body: string } {
  if (item.entityType === 'pickup') return describePickup(item);
  const prev = previous as IncidentStatus;
  return getLang() === 'en' ? describeChangeEn(item, prev) : describeChangeAr(item, prev);
}

/** Pickup notifications: accepted, on the way, weighed, completed (and cancelled by someone else), in both languages. */
function describePickup(item: TrackedItem): { title: string; body: string } {
  const en = getLang() === 'en';
  const id = item.entityId;
  const name = item.pickup?.name?.trim();
  const stage = item.stage ?? 'requested';
  switch (stage) {
    case 'accepted':
      return en
        ? { title: `Your recycling request ${id} was accepted`, body: name ? `${name} will come on the day you chose` : 'A collector will come on the day you chose' }
        : { title: `طلب التدوير ${id} اتقبل`, body: name ? `${name} هيعدّي عليك في الميعاد اللي اخترته` : 'جامع معتمد هيعدّي عليك في الميعاد اللي اخترته' };
    case 'on_the_way':
      return en
        ? { title: `${name ?? 'The collector'} is on the way`, body: `For your recycling request ${id}. It helps if the materials are by the door` }
        : { title: `${name ?? 'الجامع'} في الطريق ليك`, body: `لطلب التدوير ${id}. يا ريت الخامات تكون عند الباب` };
    case 'weighed':
      return en
        ? { title: `Your materials were weighed`, body: item.pickup?.totalKg !== undefined ? `Weighed amount: ${formatKg(item.pickup.totalKg)}. Request ${id}` : `Request ${id}` }
        : { title: 'اتوزنت الخامات', body: item.pickup?.totalKg !== undefined ? `الوزن الفعلي: ${formatKg(item.pickup.totalKg)}. الطلب ${id}` : `الطلب ${id}` };
    case 'completed': {
      const paid = item.pickup?.paidEgp ?? 0;
      return en
        ? { title: `Your recycling request ${id} is done`, body: paid > 0 ? `${formatEgp(paid)} paid to you. Thank you!` : 'Thank you for recycling!' }
        : { title: `طلب التدوير ${id} خلص`, body: paid > 0 ? `اتدفعلك ${formatEgp(paid)}. تسلم إيدك!` : 'تسلم إيدك على التدوير!' };
    }
    case 'cancelled':
      return en ? { title: `Your recycling request ${id} was cancelled`, body: 'You can ask for a new pickup any time' } : { title: `طلب التدوير ${id} اتلغى`, body: 'تقدر تطلب استلام جديد في أي وقت' };
    default:
      return en ? { title: `We got your recycling request ${id}`, body: 'We are waiting for a collector to accept it' } : { title: `وصلنا طلب التدوير ${id}`, body: 'مستنيين جامع يقبله' };
  }
}

function describeChangeEn(item: TrackedItem, previous: IncidentStatus): { title: string; body: string } {
  const isReport = item.entityType === 'report';
  const mine = isReport ? `report ${item.entityId}` : `request ${item.entityId}`;
  const who = `Your ${mine}`;
  const note = item.note?.trim();
  switch (item.status) {
    case 'received':
      return isReport && (previous === 'resolved' || previous === 'closed')
        ? { title: `${who} was reopened`, body: note ?? "We'll look at the problem again" }
        : { title: `We got your ${mine}`, body: note ?? "We'll start reviewing it" };
    case 'triaged':
      return { title: `${who} was reviewed`, body: note ?? (isReport ? 'We identified the problem and how urgent it is' : 'Your request was reviewed') };
    case 'assigned':
      return {
        title: isReport && item.department ? `${who} was sent to ${departmentLabel(item.department)}` : `${who} was sent to the responsible team`,
        body: note ?? "We'll let you know when the team arrives",
      };
    case 'in_progress':
      return { title: isReport ? `The team started work on your ${mine}` : `${who} is being carried out`, body: note ?? 'The team is on site now' };
    case 'resolved':
      return isReport
        ? { title: `${who} is fixed`, body: "It's fixed! Thank you for your report" }
        : { title: `${who} was completed`, body: note ?? 'Request completed. Thank you for using the service' };
    default:
      return { title: `${who} was closed`, body: note ?? 'Closed with no further changes' };
  }
}

/** Egyptian Arabic title and body for a status change. */
function describeChangeAr(item: TrackedItem, previous: IncidentStatus): { title: string; body: string } {
  const isReport = item.entityType === 'report';
  const who = isReport ? `بلاغك ${item.entityId}` : `طلبك ${item.entityId}`;
  const note = item.note?.trim();
  switch (item.status) {
    case 'received':
      return isReport && (previous === 'resolved' || previous === 'closed')
        ? { title: `${who} اتفتح تاني`, body: note ?? 'هنراجع المشكلة من الأول' }
        : { title: `${who} وصلنا`, body: note ?? 'وصلنا وهنبدأ نراجعه' };
    case 'triaged':
      return { title: `${who} اتصنّف`, body: note ?? (isReport ? 'اتحدد نوع المشكلة وأولويتها' : 'اتراجع الطلب') };
    case 'assigned':
      return {
        title: isReport && item.department ? `${who} اتحوّل ${toDept(item.department)}` : `${who} اتحوّل للفريق المسؤول`,
        body: note ?? 'هنبلّغك أول ما الفريق يوصل',
      };
    case 'in_progress':
      return { title: isReport ? `الفريق بدأ شغل في ${who}` : `${who} جاري تنفيذه`, body: note ?? 'الفريق في الموقع دلوقتي' };
    case 'resolved':
      return isReport
        ? { title: `${who} اتصلّح`, body: 'اتصلّحت! شكرًا على بلاغك' }
        : { title: `${who} اتنفّذ`, body: note ?? 'اتنفّذ الطلب. شكرًا لاستخدام الخدمة' };
    default:
      return { title: `${who} اتقفل`, body: note ?? 'اتقفل من غير تغيير تاني' };
  }
}

/**
 * Diffs the current items against the last known statuses. Items never seen before are only recorded
 * (no notification on first load); items whose status changed produce one notification each.
 * Entities missing from `items` keep their known status.
 */
export function diffStatuses(
  known: KnownStatuses,
  items: TrackedItem[],
  at: string,
  makeId: (item: TrackedItem, index: number) => string,
): { known: KnownStatuses; created: AppNotification[] } {
  const next: KnownStatuses = { ...known };
  const created: AppNotification[] = [];
  items.forEach((item, index) => {
    const before = known[item.entityId];
    const key = trackedKey(item);
    next[item.entityId] = key;
    if (before === undefined || before === key) return;
    const { title, body } = describeChange(item, before);
    created.push({
      id: makeId(item, index),
      entityType: item.entityType,
      entityId: item.entityId,
      status: item.status,
      title,
      body,
      at,
      read: false,
    });
  });
  return { known: next, created };
}
