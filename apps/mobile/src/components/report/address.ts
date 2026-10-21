/** The parts of an `expo-location` reverse-geocode result that make a short Arabic address line. */
export type GeocodeParts = {
  street?: string | null;
  name?: string | null;
  district?: string | null;
  subregion?: string | null;
  city?: string | null;
};

/** Shown when the pin moved but nothing usable came back (offline, no result). */
export const MAP_PIN_ADDRESS = 'موقع على الخريطة';

/** "شارع عباس العقاد، مدينة نصر": street (or place name) + area; '' when there is nothing useful. */
export function formatAddress(a: GeocodeParts | null | undefined): string {
  if (!a) return '';
  const street = (a.street ?? a.name ?? '').trim();
  const area = (a.district ?? a.subregion ?? a.city ?? '').trim();
  const line = [street, area].filter(Boolean).join('، ');
  return line.length >= 3 ? line : '';
}

/** Address for a moved pin: the geocoded line, else what was there before, else the generic label. */
export function addressAfterMove(geocoded: string, previous: string): string {
  return geocoded || previous.trim() || MAP_PIN_ADDRESS;
}
