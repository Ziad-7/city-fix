import type { Impact, MaterialId } from '@/domain/citycycle';

export type ImpactBar = { materialId: MaterialId; kg: number; /** 0..1, relative to the biggest material. */ fraction: number };

/** Bars for the by-material list: most kg first, widths relative to the biggest one. */
export function impactBars(byMaterial: readonly { materialId: MaterialId; kg: number }[]): ImpactBar[] {
  const rows = byMaterial.filter((r) => r.kg > 0).sort((a, b) => b.kg - a.kg);
  const max = rows[0]?.kg ?? 0;
  return rows.map((r) => ({ materialId: r.materialId, kg: r.kg, fraction: max > 0 ? r.kg / max : 0 }));
}

/** Nothing recycled yet: the screen invites a first pickup instead of showing zeros. */
export const impactIsEmpty = (impact: Pick<Impact, 'totalKg' | 'pickups'> | null): boolean => !impact || (impact.totalKg <= 0 && impact.pickups <= 0);
