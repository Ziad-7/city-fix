import type { IconName, PaymentMethod, ServiceType, SlotId } from './types';

export type ServiceGroup = 'cleaning' | 'gardens' | 'lighting';

export type CatalogService = {
  id: string;
  /** Set when the service has a booking flow in the app. */
  serviceType?: ServiceType;
  titleAr: string;
  subtitleAr: string;
  icon: IconName;
  group: ServiceGroup;
  /** App route to open; services without one are shown as "قريبًا". */
  route?: '/services/bulky-waste';
};

export const SERVICE_GROUPS: { id: ServiceGroup | 'all'; labelAr: string }[] = [
  { id: 'all', labelAr: 'الكل' },
  { id: 'cleaning', labelAr: 'النظافة' },
  { id: 'gardens', labelAr: 'الحدائق' },
  { id: 'lighting', labelAr: 'الإنارة' },
];

export const SERVICES: CatalogService[] = [
  { id: 'bulky', serviceType: 'bulky_waste', titleAr: 'رفع مخلفات كبيرة', subtitleAr: 'عفش قديم، أجهزة، مخلفات بناء · خلال ٤٨ ساعة', icon: 'trash', group: 'cleaning', route: '/services/bulky-waste' },
  { id: 'tree', serviceType: 'tree_maintenance', titleAr: 'تقليم أو إزالة شجرة', subtitleAr: 'إدارة الحدائق · خلال ٥ أيام', icon: 'tree', group: 'gardens' },
  { id: 'garbage-schedule', titleAr: 'مواعيد جمع القمامة', subtitleAr: 'شوف ميعاد العربية في شارعك', icon: 'clock', group: 'cleaning' },
];

export const BULKY_ITEMS = ['كنبة', 'تلاجة قديمة', 'سرير', 'مخلفات بناء'];

export const SLOTS: { id: SlotId; labelAr: string }[] = [
  { id: 'morning', labelAr: '٩ ص – ١٢ ظ' },
  { id: 'afternoon', labelAr: '٢ م – ٥ م' },
];

export const PAYMENT_METHODS: { id: PaymentMethod; labelAr: string }[] = [
  { id: 'cash', labelAr: 'كاش مع العامل' },
  { id: 'fawry', labelAr: 'فوري' },
  { id: 'instapay', labelAr: 'إنستاباي' },
  { id: 'wallet', labelAr: 'محفظة موبايل' },
];

/** Never invent a fee: always show the district's published rate. */
export const FEE_LABEL = '[حسب لائحة الحي]';

export const SERVICE_TITLE_AR: Record<ServiceType, string> = {
  bulky_waste: 'رفع مخلفات كبيرة',
  tree_maintenance: 'تقليم أو إزالة شجرة',
};

/** Next N working days (Sunday-Thursday; Friday/Saturday are weekends) as ISO dates. */
export function nextWorkingDays(count: number, from: Date = new Date()): string[] {
  const out: string[] = [];
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (out.length < count) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 5 && dow !== 6) {
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
  }
  return out;
}
