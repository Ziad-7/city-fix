import type { Category, CategoryId } from './types';

/** The 12 Egyptian problem categories, in street language (see brand-book "Made for Egypt"). */
export const CATEGORIES: Category[] = [
  { id: 'pothole', labelAr: 'حفرة أو مطب عشوائي', icon: 'pothole', danger: false, defaultSeverity: 'medium', department: 'صيانة الطرق', targetDays: 5, estimatedCostEgp: 4500 },
  { id: 'open_manhole', labelAr: 'بالوعة مفتوحة', icon: 'manhole', danger: true, defaultSeverity: 'high', department: 'الصرف الصحي', targetDays: 1, estimatedCostEgp: 1800 },
  { id: 'sewage_overflow', labelAr: 'طفح مجاري', icon: 'droplets', danger: false, defaultSeverity: 'high', department: 'الصرف الصحي', externalHotline: '175', targetDays: 2, estimatedCostEgp: 6000 },
  { id: 'water_pipe_burst', labelAr: 'كسر ماسورة مياه', icon: 'pipe', danger: false, defaultSeverity: 'high', department: 'شركة مياه الشرب', externalHotline: '125', targetDays: 2, estimatedCostEgp: 7500 },
  { id: 'garbage', labelAr: 'زبالة متراكمة', icon: 'trash', danger: false, defaultSeverity: 'medium', department: 'هيئة النظافة والتجميل', targetDays: 2, estimatedCostEgp: 1200 },
  { id: 'streetlight_out', labelAr: 'عمود نور مطفي', icon: 'bulb', danger: false, defaultSeverity: 'low', department: 'إنارة الحي', targetDays: 4, estimatedCostEgp: 900 },
  { id: 'exposed_wire', labelAr: 'سلك كهربا مكشوف', icon: 'zap', danger: true, defaultSeverity: 'high', department: 'شركة الكهرباء', externalHotline: '121', targetDays: 1, estimatedCostEgp: 2500 },
  { id: 'road_obstruction', labelAr: 'إشغالات طريق', icon: 'cone', danger: false, defaultSeverity: 'low', department: 'مرافق الحي', targetDays: 5, estimatedCostEgp: 600 },
  { id: 'stray_dogs', labelAr: 'كلاب ضالة', icon: 'paw', danger: false, defaultSeverity: 'medium', department: 'الطب البيطري', targetDays: 5, estimatedCostEgp: 800 },
  { id: 'fallen_tree', labelAr: 'شجرة واقعة أو مايلة', icon: 'tree', danger: false, defaultSeverity: 'medium', department: 'حدائق الحي', targetDays: 3, estimatedCostEgp: 2200 },
  { id: 'broken_sidewalk', labelAr: 'رصيف مكسور', icon: 'sidewalk', danger: false, defaultSeverity: 'low', department: 'صيانة الطرق', targetDays: 7, estimatedCostEgp: 3500 },
  { id: 'other', labelAr: 'حاجة تانية', icon: 'more', danger: false, defaultSeverity: 'low', department: 'مرافق الحي', targetDays: 7, estimatedCostEgp: 1000 },
];

const BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<CategoryId, Category>;

export const getCategory = (id: CategoryId): Category => BY_ID[id] ?? BY_ID.other;
