import type { MaterialId, PickupItem, WasteClassification, WasteSize } from '@/domain/citycycle';
import { MATERIAL_IDS, PICKUP_LIMITS, normalizeItems, roundKg } from '@/domain/materials';
import { tr } from '@/i18n';
import { formatKg } from '@/utils/money';

/** Estimated kg per chosen material. A material that is not a key is not chosen. */
export type KgSelection = Partial<Record<MaterialId, number>>;

/** How much one tap on the stepper adds or removes: small steps for light things, whole kilos for heavy ones. */
const STEP: Record<MaterialId, number> = {
  pet_plastic: 0.5,
  paper_cardboard: 1,
  metal_cans: 0.5,
  glass: 1,
  e_waste: 0.5,
  cooking_oil: 0.5,
  organics: 1,
};

export const kgStep = (id: MaterialId): number => STEP[id];

/** The kg a material starts with when it is tapped on: two steps, never below the minimum. */
export const defaultKg = (id: MaterialId): number => Math.max(PICKUP_LIMITS.minKg, roundKg(STEP[id] * 2));

const clampKg = (kg: number): number => Math.min(PICKUP_LIMITS.maxKgPerMaterial, Math.max(PICKUP_LIMITS.minKg, roundKg(kg)));

/** One tap of "+" (`dir` 1) or "-" (`dir` -1), kept between the form's minimum and maximum. */
export const stepKg = (current: number, dir: 1 | -1, id: MaterialId): number => clampKg(current + dir * STEP[id]);

/** Tap on a material tile: adds it with its default weight, or removes it. */
export function toggleMaterial(sel: KgSelection, id: MaterialId): KgSelection {
  if (sel[id] !== undefined) {
    const next = { ...sel };
    delete next[id];
    return next;
  }
  return { ...sel, [id]: defaultKg(id) };
}

/** The chosen materials in catalogue order, ready for the service call. */
export function selectionToItems(sel: KgSelection): PickupItem[] {
  return normalizeItems(MATERIAL_IDS.filter((id) => sel[id] !== undefined).map((id) => ({ materialId: id, estimatedKg: sel[id] as number })));
}

// ---- AI photo check ----

const SIZE_KG: Record<WasteSize, number> = { small: 1, medium: 3, large: 8 };

/** The kg to put in the form for a suggestion: the middle of the model's range (to the nearest half kilo), else by size. */
export function suggestionKg(c: Pick<WasteClassification, 'size' | 'estimatedKgRange'>): number {
  const range = c.estimatedKgRange;
  const kg = range ? Math.round(((range[0] + range[1]) / 2) * 2) / 2 : SIZE_KG[c.size];
  return clampKg(kg);
}

/** True when the check found a material to suggest (a fallback or an empty answer has none). */
export const hasSuggestion = (c: Pick<WasteClassification, 'materials'> | null): c is Pick<WasteClassification, 'materials'> & WasteClassification =>
  !!c && c.materials.length > 0;

/** Tapping the suggestion card: puts the most likely material in the form with the suggested weight. Never called on its own. */
export function applySuggestion(sel: KgSelection, c: WasteClassification): KgSelection {
  const top = c.materials[0];
  if (!top) return sel;
  return { ...sel, [top.materialId]: suggestionKg(c) };
}

// ---- Validation ----

export type PickupFormErrors = Partial<Record<'items' | 'kg' | 'address' | 'day', string>>;

/** Errors in the current language (call while rendering or submitting, never at module level). */
export function validatePickupForm(v: { items: readonly PickupItem[]; address: string; day: string | null }): PickupFormErrors {
  const errors: PickupFormErrors = {};
  if (v.items.length === 0) {
    errors.items = tr('اختار خامة واحدة على الأقل', 'Choose at least one material');
  } else if (v.items.some((i) => !(i.estimatedKg >= PICKUP_LIMITS.minKg) || i.estimatedKg > PICKUP_LIMITS.maxKgPerMaterial)) {
    errors.kg = tr(
      `الوزن التقريبي لكل خامة من ${formatKg(PICKUP_LIMITS.minKg)} لحد ${formatKg(PICKUP_LIMITS.maxKgPerMaterial)}`,
      `The approximate weight of each material must be between ${formatKg(PICKUP_LIMITS.minKg)} and ${formatKg(PICKUP_LIMITS.maxKgPerMaterial)}`,
    );
  }
  if (!v.address.trim()) errors.address = tr('اكتب العنوان عشان الجامع يعرف يجيلك', 'Enter the address so the collector can find you');
  if (!v.day || !/^\d{4}-\d{2}-\d{2}$/.test(v.day)) errors.day = tr('اختار اليوم', 'Choose a day');
  return errors;
}

export const hasErrors = (e: PickupFormErrors): boolean => Object.keys(e).length > 0;
