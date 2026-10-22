import type { Severity, ServiceType } from '@/domain/types';
import type { WorkOrderStatus } from '@/domain/admin-types';

export const SEVERITY_AI_AR: Record<Severity, string> = {
  low: 'خطورة بسيطة',
  medium: 'خطورة متوسطة',
  high: 'خطورة عالية',
  critical: 'خطورة حرجة',
};

export const WORK_ORDER_LABEL_AR: Record<WorkOrderStatus, string> = {
  open: 'اتسلّم',
  assigned: 'اتوزّع',
  in_progress: 'شغالين عليه',
  done: 'اتحلّت',
};

export const SERVICE_TYPE_LABEL_AR: Record<ServiceType, string> = {
  bulky_waste: 'رفع مخلفات كبيرة',
  tree_maintenance: 'صيانة أشجار',
};

export const PAYMENT_LABEL_AR: Record<string, string> = {
  cash: 'كاش مع العامل',
  fawry: 'فوري',
  instapay: 'إنستاباي',
  wallet: 'محفظة موبايل',
};

export const SOURCE_LABEL_AR: Record<string, string> = {
  app: 'تطبيق',
  web: 'موقع',
};

/**
 * Determine the tone/urgency level of a score.
 */
export function scoreTone(score: number): 'urgent' | 'high' | 'low' {
  if (score >= 85) return 'urgent';
  if (score >= 65) return 'high';
  return 'low';
}

export const MATERIAL_LABEL_AR: Record<string, string> = {
  pet_plastic: 'بلاستيك PET',
  paper_cardboard: 'ورق وكرتون',
  metal_cans: 'علب معدنية',
  glass: 'زجاج',
  e_waste: 'إلكترونيات',
  cooking_oil: 'زيت طبخ مستعمل',
  organics: 'عضوي',
};

export const PICKUP_STATUS_LABEL_AR: Record<string, string> = {
  requested: 'مطلوب',
  accepted: 'اتقبل',
  weighed: 'اتوزن',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

export const COLLECTOR_STATUS_LABEL_AR: Record<string, string> = {
  pending: 'منتظر المراجعة',
  verified: 'موثّق',
  suspended: 'موقوف',
};
