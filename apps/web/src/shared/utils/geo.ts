export type LatLng = { lat: number; lng: number };

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Arabic distance label: "٤٠ متر" / "١٫٢ كم". */
export function formatDistanceAr(m: number): string {
  const ar = (s: string) => s.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]).replace('.', '٫');
  if (m < 1000) return `${ar(String(Math.max(5, Math.round(m / 5) * 5)))} متر`;
  return `${ar((m / 1000).toFixed(1))} كم`;
}
