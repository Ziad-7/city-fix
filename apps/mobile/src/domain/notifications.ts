import { getLang } from '@/i18n';
import { departmentLabel } from '@/i18n/labels';
import type { AppNotification, IncidentStatus } from './types';

/** One report (via its incident) or service request, as the notification diff sees it. */
export type TrackedItem = {
  entityType: AppNotification['entityType'];
  /** FTC-… or SRV-… */
  entityId: string;
  status: IncidentStatus;
  /** Responsible department (reports only). */
  department?: string;
  /** Latest timeline note, used as the body when present. */
  note?: string;
};

/** Last known status per entity id. */
export type KnownStatuses = Record<string, IncidentStatus>;

/** "ل" + name, merging with "ال": الحدائق -> للحدائق, صيانة الطرق -> لصيانة الطرق. */
const toDept = (name: string) => (name.startsWith('ال') ? `لل${name.slice(2)}` : `ل${name}`);

/** Title and body for a status change, in the current language (the text is fixed when the notification is created). */
export function describeChange(item: TrackedItem, previous: IncidentStatus): { title: string; body: string } {
  return getLang() === 'en' ? describeChangeEn(item, previous) : describeChangeAr(item, previous);
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
    next[item.entityId] = item.status;
    if (before === undefined || before === item.status) return;
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
