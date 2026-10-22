import { FEE_LABEL, FREE_SERVICE_LABEL } from '@/domain/services-catalog';
import type { ServiceRequest, ServiceType } from '@/domain/types';

/** The department that handles each kind of booking (the tree service is the district gardens department's). */
export const SERVICE_DEPARTMENT_AR: Record<ServiceType, string> = {
  bulky_waste: 'خدمات الحي',
  tree_maintenance: 'إدارة الحدائق',
};

export const serviceDepartment = (type: ServiceType): string => SERVICE_DEPARTMENT_AR[type] ?? 'خدمات الحي';

/** A booking with no payment method is a free district service (the tree service). */
export const isFreeService = (r: ServiceRequest): boolean => !r.details.payment;

export type DetailRow = { label: string; value: string };

/** Rows of the booking details card: the bulky layout for a bulky pickup, the work type and "free" for a tree service. */
export function serviceDetailRows(r: ServiceRequest, dayText: string, slotText: string, paymentText: string): DetailRow[] {
  const { details, location } = r;
  const free = isFreeService(r);
  const items = details.items.join('، ');
  return [
    free ? { label: 'نوع الشغل', value: details.workType ?? items } : { label: 'اللي هيترفع', value: items },
    { label: 'اليوم', value: dayText },
    { label: 'الفترة', value: slotText },
    ...(free ? [] : [{ label: 'طريقة الدفع', value: paymentText }]),
    { label: 'الرسوم', value: free ? FREE_SERVICE_LABEL : FEE_LABEL.replace(/[[\]]/g, '') },
    { label: 'العنوان', value: [location.address, location.landmark].filter(Boolean).join(' · ') },
    ...(details.note ? [{ label: 'ملاحظة', value: details.note }] : []),
  ];
}
