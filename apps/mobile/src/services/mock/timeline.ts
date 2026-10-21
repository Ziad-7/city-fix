import { getCategory } from '@/domain/categories';
import { SEVERITY_LABEL_AR, type Incident, type IncidentStatus, type TimelineEntry } from '@/domain/types';

export const STATUS_ORDER: IncidentStatus[] = ['received', 'triaged', 'assigned', 'in_progress', 'resolved'];

export function nextStatus(s: IncidentStatus): IncidentStatus {
  const i = STATUS_ORDER.indexOf(s);
  return i < 0 || i >= STATUS_ORDER.length - 1 ? 'resolved' : STATUS_ORDER[i + 1];
}

export function incidentTimelineEntry(
  status: IncidentStatus,
  incident: Pick<Incident, 'categoryId' | 'severity' | 'department'>,
  at: string,
): TimelineEntry {
  const cat = getCategory(incident.categoryId);
  switch (status) {
    case 'received':
      return { status, at, actor: 'النظام', note: 'وصلنا بلاغك' };
    case 'triaged':
      return { status, at, actor: 'الذكاء الاصطناعي + موظف الحي', note: `اتصنّف: ${cat.labelAr} · ${SEVERITY_LABEL_AR[incident.severity]}` };
    case 'assigned':
      return { status, at, actor: incident.department, note: `اتحوّل لـ${incident.department}` };
    case 'in_progress':
      return { status, at, actor: incident.department, note: 'الفريق في الموقع' };
    case 'resolved':
      return { status, at, actor: incident.department, note: 'اتصلّحت. شكرًا إنك بلّغت' };
    default:
      return { status, at, actor: 'النظام', note: 'اتقفل البلاغ' };
  }
}

export function serviceTimelineEntry(status: IncidentStatus, at: string): TimelineEntry {
  const notes: Partial<Record<IncidentStatus, string>> = {
    received: 'وصلنا طلبك',
    triaged: 'اتراجع الطلب',
    assigned: 'اتحدد فريق وميعاد التنفيذ',
    in_progress: 'العربية في الطريق',
    resolved: 'اتنفّذ الطلب',
  };
  return { status, at, actor: 'خدمات الحي', note: notes[status] ?? 'اتقفل الطلب' };
}

export function etaFor(status: IncidentStatus): string | undefined {
  if (status === 'resolved' || status === 'closed') return undefined;
  if (status === 'in_progress') return 'متوقع نخلص بكرة';
  return 'خلال ٣ أيام';
}
