import type { MaterialId, PickupItem, PickupStatus, RecyclingPickup } from '@/domain/citycycle';
import { aggregateWeighings, roundEgp } from '@/domain/materials';
import { materialLabel, pickupStatusLabel } from '@/i18n/labels';
import { tr } from '@/i18n';
import { localDigits } from '@/utils/digits';

/** "تدوير: بلاستيك (إزايز)، إزاز" / "Recycling: Plastic bottles (PET), Glass"; more than two materials end with "و٢ كمان" / "+2 more". */
export function pickupTitle(items: readonly PickupItem[]): string {
  const sep = tr('، ', ', ');
  const labels = items.map((i) => materialLabel(i.materialId));
  const shown = labels.slice(0, 2);
  if (labels.length > 2) shown.push(tr(`و${localDigits(labels.length - 2)} كمان`, `+${labels.length - 2} more`));
  return `${tr('تدوير', 'Recycling')}: ${shown.join(sep)}`;
}

/** The status word: "on the way" once the collector tapped start, else the contract status. */
export function pickupStatusText(p: Pick<RecyclingPickup, 'status' | 'startedAt'>): string {
  if (p.status === 'accepted' && p.startedAt) return tr('الجامع في الطريق', 'The collector is on the way');
  return pickupStatusLabel(p.status);
}

/** Privacy rule: only the first name of the collector is shown to the household. */
export function collectorFirstName(name: string | undefined): string | undefined {
  const first = name?.trim().split(/\s+/)[0];
  return first || undefined;
}

export type PickupItemRow = { materialId: MaterialId; estimatedKg: number; weighedKg?: number };

/** Items with the weighed kg beside the estimate (once the collector weighed that material). */
export function pickupItemRows(p: Pick<RecyclingPickup, 'items' | 'weighings'>): PickupItemRow[] {
  const weighed = new Map(aggregateWeighings(p.weighings).byMaterial.map((r) => [r.materialId, r.kg]));
  return p.items.map((i) => ({ materialId: i.materialId, estimatedKg: i.estimatedKg, ...(weighed.has(i.materialId) ? { weighedKg: weighed.get(i.materialId) } : {}) }));
}

/** Weighed material the household did not list (the collector added it): shown after the listed ones. */
export function extraWeighedRows(p: Pick<RecyclingPickup, 'items' | 'weighings'>): PickupItemRow[] {
  const listed = new Set(p.items.map((i) => i.materialId));
  return aggregateWeighings(p.weighings)
    .byMaterial.filter((r) => !listed.has(r.materialId))
    .map((r) => ({ materialId: r.materialId, estimatedKg: 0, weighedKg: r.kg }));
}

/** Money of finished pickups: cash received for paid ones, and the value given away in free ones. */
export function pickupMoney(pickups: readonly Pick<RecyclingPickup, 'status' | 'mode' | 'totalValueEgp' | 'paidToHouseholdEgp'>[]): { earnedEgp: number; donatedEgp: number } {
  let earned = 0;
  let donated = 0;
  for (const p of pickups) {
    if (p.status !== 'completed') continue;
    if (p.mode === 'paid') earned += p.paidToHouseholdEgp ?? p.totalValueEgp ?? 0;
    else donated += p.totalValueEgp ?? 0;
  }
  return { earnedEgp: roundEgp(earned), donatedEgp: roundEgp(donated) };
}

export const pickupCount = (pickups: readonly { status: PickupStatus }[]): number => pickups.filter((p) => p.status === 'completed').length;
