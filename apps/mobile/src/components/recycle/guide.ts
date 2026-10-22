import type { MaterialId } from '@/domain/citycycle';
import { tr } from '@/i18n';

export type GuideTips = { do: string[]; dont: string[] };

/**
 * Do and don't lines of the sorting guide: short noun phrases (no gendered commands), one idea each, for low literacy.
 * Read the language when called, so call it while rendering.
 */
export function guideTips(id: MaterialId): GuideTips {
  switch (id) {
    case 'pet_plastic':
      return {
        do: [tr('إزازة فاضية ومشطوفة', 'Empty, rinsed bottles'), tr('مكبوسة عشان تاخد مكان أقل', 'Flattened to save space')],
        dont: [tr('فيها مية أو عصير', 'Still has liquid inside'), tr('متخلطة مع زبالة المطبخ', 'Mixed with kitchen waste')],
      };
    case 'paper_cardboard':
      return {
        do: [tr('ورق وكرتون ناشف', 'Dry paper and cardboard'), tr('كراتين مفرودة', 'Boxes flattened')],
        dont: [tr('ورق مبلول أو متزيّت', 'Wet or greasy paper'), tr('علب أكل متسخة', 'Dirty food boxes')],
      };
    case 'metal_cans':
      return {
        do: [tr('علبة فاضية ومشطوفة', 'Empty, rinsed cans'), tr('العلب مكبوسة', 'Cans squashed flat')],
        dont: [tr('علب بخاخ لسه فيها غاز', 'Spray cans that still have gas'), tr('بطاريات جوه العلب', 'Batteries inside the cans')],
      };
    case 'glass':
      return {
        do: [tr('إزايز وبرطمانات من غير كسر', 'Unbroken bottles and jars'), tr('في كيس لوحدها', 'In a separate bag')],
        dont: [tr('إزاز مكسور سايب', 'Loose broken glass'), tr('مرايات وإزاز شبابيك', 'Mirrors and window glass')],
      };
    case 'e_waste':
      return {
        do: [tr('جهاز زي ما هو، مع شاحنه', 'The device as it is, with its charger'), tr('كابلات وموبايلات قديمة', 'Old cables and phones')],
        dont: [tr('جهاز مفتوح أو مكسور', 'Opened or broken devices'), tr('بطاريات منتفخة', 'Swollen batteries')],
      };
    case 'cooking_oil':
      return {
        do: [tr('زيت بارد في إزازة مقفولة', 'Cooled oil in a closed bottle'), tr('زيت بس في الإزازة', 'Only oil in the bottle')],
        dont: [tr('زيت ساخن', 'Hot oil'), tr('زيت مخلوط بمية أو صابون', 'Oil mixed with water or soap')],
      };
    case 'organics':
      return {
        do: [tr('فضلات في كيس لوحده', 'Scraps in a separate bag'), tr('تتسلّم في نفس اليوم', 'Handed over the same day')],
        dont: [tr('بلاستيك أو إزاز وسطها', 'Plastic or glass mixed in'), tr('فضلات قديمة من أيام', 'Scraps left for days')],
      };
  }
}
