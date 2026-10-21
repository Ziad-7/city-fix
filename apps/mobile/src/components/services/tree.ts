import { placeSchema, treeBookingSchema } from '@/domain/schemas';
import type { NewServiceRequestInput, Place, SlotId } from '@/domain/types';

export type TreeFormValues = {
  workType: string;
  day: string;
  slot: SlotId;
  note: string;
  place: Place;
  photoUris: string[];
};

export type TreeFormErrors = Partial<Record<'workType' | 'day' | 'address', string>>;

/** Validates the tree-maintenance form; returns inline errors, or the booking input when valid. */
export function validateTreeBooking(v: TreeFormValues): { errors: TreeFormErrors; input: NewServiceRequestInput | null } {
  const errors: TreeFormErrors = {};
  const parsed = treeBookingSchema.safeParse({ workType: v.workType, day: v.day, slot: v.slot, note: v.note });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] === 'workType' ? 'workType' : 'day';
      errors[key] ??= issue.message;
    }
  }
  const place = placeSchema.safeParse({ ...v.place, address: v.place.address.trim(), landmark: v.place.landmark?.trim() || undefined });
  if (!place.success) errors.address = 'اكتب العنوان';
  if (!parsed.success || !place.success) return { errors, input: null };
  return {
    errors,
    input: {
      serviceType: 'tree_maintenance',
      // Free district service: no payment. `items` carries the work type for the generic request views.
      details: {
        items: [parsed.data.workType],
        workType: parsed.data.workType,
        day: parsed.data.day,
        slot: parsed.data.slot,
        note: parsed.data.note || undefined,
        photoUris: v.photoUris.length ? v.photoUris : undefined,
      },
      location: place.data,
    },
  };
}
