import { FEE_LABEL, FREE_SERVICE_LABEL } from '@/domain/services-catalog';
import type { ServiceRequest, ServiceType } from '@/domain/types';
import { FEE_LABEL_EN, FREE_SERVICE_LABEL_EN, departmentLabel, getLang, itemLabel, tr } from '@/i18n';

/** The department that handles each kind of booking (the tree service is the district gardens department's). */
export const SERVICE_DEPARTMENT_AR: Record<ServiceType, string> = {
  bulky_waste: 'خدمات الحي',
  tree_maintenance: 'إدارة الحدائق',
};

export const serviceDepartment = (type: ServiceType): string => {
  const ar = SERVICE_DEPARTMENT_AR[type] ?? 'خدمات الحي';
  return ar === 'خدمات الحي' ? tr(ar, 'District services') : departmentLabel(ar);
};

/** A booking with no payment method is a free district service (the tree service). */
export const isFreeService = (r: ServiceRequest): boolean => !r.details.payment;

export type DetailRow = { label: string; value: string };

/** Rows of the booking details card: the bulky layout for a bulky pickup, the work type and "free" for a tree service. */
export function serviceDetailRows(r: ServiceRequest, dayText: string, slotText: string, paymentText: string): DetailRow[] {
  const { details, location } = r;
  const free = isFreeService(r);
  const items = details.items.map(itemLabel).join(tr('، ', ', '));
  return [
    free ? { label: tr('نوع الشغل', 'Type of work'), value: details.workType ? itemLabel(details.workType) : items } : { label: tr('اللي هيترفع', 'To be picked up'), value: items },
    { label: tr('اليوم', 'Day'), value: dayText },
    { label: tr('الفترة', 'Time slot'), value: slotText },
    ...(free ? [] : [{ label: tr('طريقة الدفع', 'Payment method'), value: paymentText }]),
    { label: tr('الرسوم', 'Fee'), value: getLang() === 'en' ? (free ? FREE_SERVICE_LABEL_EN : FEE_LABEL_EN) : free ? FREE_SERVICE_LABEL : FEE_LABEL.replace(/[[\]]/g, '') },
    { label: tr('العنوان', 'Address'), value: [location.address, location.landmark].filter(Boolean).join(' · ') },
    ...(details.note ? [{ label: tr('ملاحظة', 'Note'), value: details.note }] : []),
  ];
}
