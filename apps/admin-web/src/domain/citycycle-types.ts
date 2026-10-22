/** CityCycle admin shapes, from docs/api-contract.md ("CityCycle - proposed"). */
export type MaterialId =
  | 'pet_plastic'
  | 'paper_cardboard'
  | 'metal_cans'
  | 'glass'
  | 'e_waste'
  | 'cooking_oil'
  | 'organics';

export const MATERIAL_IDS: MaterialId[] = [
  'pet_plastic',
  'paper_cardboard',
  'metal_cans',
  'glass',
  'e_waste',
  'cooking_oil',
  'organics',
];

export type PickupStatus = 'requested' | 'accepted' | 'weighed' | 'completed' | 'cancelled';
export type CollectorStatus = 'pending' | 'verified' | 'suspended';

export interface RecyclingPickup {
  id: string;
  items: { materialId: MaterialId; estimatedKg: number }[];
  location: { address: string; lat?: number; lng?: number; landmark?: string };
  day: string;
  slot: string;
  mode: 'free' | 'paid';
  status: PickupStatus;
  collectorId?: string;
  collectorName?: string;
  totalKg?: number;
  totalValueEgp?: number;
  estimatedValueEgp?: number;
  paidToHouseholdEgp?: number;
  note?: string;
  createdAt: string;
}

export interface Collector {
  id: string;
  name: string;
  district: string;
  status: CollectorStatus;
  materials: MaterialId[];
  vehicle?: string;
  joinedAt: string;
}

export interface MaterialPrice {
  materialId: MaterialId;
  district: string;
  priceEgpPerKg: number | null;
  updatedAt?: string;
}

export interface RecyclingSummary {
  totalKg: number;
  pickups: number;
  avgResponseMinutes?: number | null;
  byMaterial: { materialId: MaterialId; kg: number }[];
  byDistrict: { district: string; kg: number }[];
}
