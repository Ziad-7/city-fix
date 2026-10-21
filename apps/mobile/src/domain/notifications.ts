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

/** Egyptian Arabic title and body for a status change. */
export function describeChange(item: TrackedItem, previous: IncidentStatus): { title: string; body: string } {
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
        ? { title: `${who} اتصلّح`, body: 'اتصلّحت! شكرًا إنك بلّغت' }
        : { title: `${who} اتنفّذ`, body: note ?? 'اتنفّذ الطلب. شكرًا إنك استخدمت الخدمة' };
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
