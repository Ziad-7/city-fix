import { getCategory } from '@/domain/categories';
import { SEVERITY_LABEL_AR, type Incident, type IncidentStatus, type ServiceType, type TimelineEntry } from '@/domain/types';
import { CATEGORY_EN, DEPARTMENT_EN, SEVERITY_EN } from '@/i18n/labels';
import type { Lang } from '@/i18n';

export const STATUS_ORDER: IncidentStatus[] = ['received', 'triaged', 'assigned', 'in_progress', 'resolved'];

/**
 * A timeline entry as the mock database stores it: the Arabic fields are the API shape, `noteEn` / `actorEn` are
 * internal (the real backend localises by Accept-Language) and are swapped in at read time (see ./localize.ts).
 */
export type DbTimelineEntry = TimelineEntry & { noteEn?: string; actorEn?: string };

export function nextStatus(s: IncidentStatus): IncidentStatus {
  const i = STATUS_ORDER.indexOf(s);
  return i < 0 || i >= STATUS_ORDER.length - 1 ? 'resolved' : STATUS_ORDER[i + 1];
}

export function incidentTimelineEntry(
  status: IncidentStatus,
  incident: Pick<Incident, 'categoryId' | 'severity' | 'department'>,
  at: string,
): DbTimelineEntry {
  const cat = getCategory(incident.categoryId);
  const deptEn = DEPARTMENT_EN[incident.department] ?? incident.department;
  switch (status) {
    case 'received':
      return { status, at, actor: 'النظام', note: 'وصلنا بلاغك', actorEn: 'System', noteEn: 'We got your report' };
    case 'triaged':
      return {
        status,
        at,
        actor: 'الذكاء الاصطناعي + موظف الحي',
        note: `اتصنّف: ${cat.labelAr} · ${SEVERITY_LABEL_AR[incident.severity]}`,
        actorEn: 'AI + district staff',
        noteEn: `Reviewed: ${CATEGORY_EN[cat.id]} · ${SEVERITY_EN[incident.severity]}`,
      };
    case 'assigned':
      return { status, at, actor: incident.department, note: `اتحوّل لـ${incident.department}`, actorEn: deptEn, noteEn: `Sent to ${deptEn}` };
    case 'in_progress':
      return { status, at, actor: incident.department, note: 'الفريق في الموقع', actorEn: deptEn, noteEn: 'The team is on site' };
    case 'resolved':
      return { status, at, actor: incident.department, note: 'اتصلّحت. شكرًا على بلاغك', actorEn: deptEn, noteEn: 'Fixed. Thank you for your report' };
    default:
      return { status, at, actor: 'النظام', note: 'اتقفل البلاغ', actorEn: 'System', noteEn: 'Report closed' };
  }
}

export function serviceTimelineEntry(status: IncidentStatus, at: string, serviceType: ServiceType = 'bulky_waste'): DbTimelineEntry {
  if (serviceType === 'tree_maintenance') {
    const treeNotes: Partial<Record<IncidentStatus, [string, string]>> = {
      received: ['وصلنا طلب تقليم أو إزالة الشجرة', 'We got your tree trimming or removal request'],
      triaged: ['إدارة الحدائق راجعت الطلب', 'The Parks Department reviewed your request'],
      assigned: ['اتحدد فريق الحدائق وميعاد التنفيذ', 'A Parks team and a time are set'],
      in_progress: ['فريق الحدائق في الطريق', 'The Parks team is on the way'],
      resolved: ['اتنفّذ الطلب', 'Request completed'],
    };
    const [note, noteEn] = treeNotes[status] ?? ['اتقفل الطلب', 'Request closed'];
    return { status, at, actor: 'إدارة الحدائق', note, actorEn: 'Parks Department', noteEn };
  }
  const notes: Partial<Record<IncidentStatus, [string, string]>> = {
    received: ['وصلنا طلبك', 'We got your request'],
    triaged: ['اتراجع الطلب', 'Your request was reviewed'],
    assigned: ['اتحدد فريق وميعاد التنفيذ', 'A team and a time are set'],
    in_progress: ['العربية في الطريق', 'The truck is on the way'],
    resolved: ['اتنفّذ الطلب', 'Request completed'],
  };
  const [note, noteEn] = notes[status] ?? ['اتقفل الطلب', 'Request closed'];
  return { status, at, actor: 'خدمات الحي', note, actorEn: 'District Services', noteEn };
}

/** Human ETA in the given language (Arabic by default, as stored). */
export function etaFor(status: IncidentStatus, lang: Lang = 'ar'): string | undefined {
  if (status === 'resolved' || status === 'closed') return undefined;
  if (lang === 'en') return status === 'in_progress' ? 'Tomorrow' : 'Within 3 days';
  if (status === 'in_progress') return 'متوقع نخلص بكرة';
  return 'خلال ٣ أيام';
}
