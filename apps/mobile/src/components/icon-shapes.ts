import type { IconName } from '@/domain/types';

/** Compact shape list: path, circle, rect, ellipse (24x24 grid, Lucide-style). */
export type Shape =
  | readonly ['p', string]
  | readonly ['c', number, number, number]
  | readonly ['r', number, number, number, number, number]
  | readonly ['e', number, number, number, number];

const p = (d: string) => ['p', d] as const;
const c = (cx: number, cy: number, r: number) => ['c', cx, cy, r] as const;
const r = (x: number, y: number, w: number, h: number, rx = 0) => ['r', x, y, w, h, rx] as const;
const e = (cx: number, cy: number, rx: number, ry: number) => ['e', cx, cy, rx, ry] as const;

export const ICON_SHAPES: Record<IconName, readonly Shape[]> = {
  home: [p('M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'), p('M9 22V12h6v10')],
  map: [p('M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z'), p('M9 3v15'), p('M15 6v15')],
  camera: [p('M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z'), c(12, 13, 3)],
  clipboard: [r(8, 2, 8, 4, 1), p('M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2'), p('M9 12h6'), p('M9 16h6')],
  user: [c(12, 8, 4), p('M4 21a8 8 0 0 1 16 0')],
  bell: [p('M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9'), p('M10.3 21a1.94 1.94 0 0 0 3.4 0')],
  'arrow-back': [p('M19 12H5'), p('M12 19l-7-7 7-7')],
  'arrow-forward': [p('M5 12h14'), p('M12 5l7 7-7 7')],
  chevron: [p('M9 18l6-6-6-6')],
  'chevron-down': [p('M6 9l6 6 6-6')],
  'alert-triangle': [p('M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'), p('M12 9v4'), p('M12 17h.01')],
  trash: [p('M3 6h18'), p('M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6'), p('M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2')],
  tree: [p('M12 22v-6'), p('M17 16H7l3-4H8l4-7 4 7h-2l3 4z')],
  bulb: [p('M9 18h6'), p('M10 22h4'), p('M12 2a7 7 0 0 0-4 12.7V16h8v-1.3A7 7 0 0 0 12 2z')],
  mic: [r(9, 2, 6, 12, 3), p('M19 10v1a7 7 0 0 1-14 0v-1'), p('M12 18v4')],
  play: [p('M7 5v14l11-7z')],
  pin: [p('M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z'), c(12, 10, 3)],
  'shield-check': [p('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'), p('M9 12l2 2 4-4')],
  wifi: [p('M5 12.6a10 10 0 0 1 14 0'), p('M8.5 16.1a5 5 0 0 1 7 0'), p('M12 20h.01')],
  users: [p('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'), c(9, 7, 4), p('M22 21v-2a4 4 0 0 0-3-3.87'), p('M16 3.13a4 4 0 0 1 0 7.75')],
  share: [c(18, 5, 3), c(6, 12, 3), c(18, 19, 3), p('M8.6 13.5l6.8 4'), p('M15.4 6.5l-6.8 4')],
  check: [p('M20 6 9 17l-5-5')],
  plus: [p('M12 5v14'), p('M5 12h14')],
  search: [c(11, 11, 7), p('M21 21l-4.3-4.3')],
  clock: [c(12, 12, 9), p('M12 7v5l3 2')],
  zap: [p('M13 2 3 14h9l-1 8 10-12h-9z')],
  droplets: [
    p('M7 16.3c2.2 0 4-1.8 4-4 0-1.2-.6-2.3-1.7-3.2C8.2 8.2 7.4 7 7 5.7c-.4 1.3-1.2 2.5-2.3 3.4C3.6 10 3 11.1 3 12.3c0 2.2 1.8 4 4 4z'),
    p('M12.6 6.3c.7-1.1 1.2-2.2 1.4-3.3.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a7 7 0 0 1-11.9 5'),
  ],
  pipe: [p('M2 8h8v4H2'), p('M14 8h8v4h-8'), p('M10 10h4'), p('M12 14v2'), p('M12 19v.01')],
  manhole: [c(12, 12, 9), p('M7 9h10'), p('M6 12h12'), p('M7 15h10')],
  pothole: [e(12, 14, 8, 4), p('M7 13c1.5 1 3.5 1.4 5 1.4s3.5-.4 5-1.4'), p('M4 6l3 3'), p('M20 6l-3 3')],
  cone: [p('M9.3 4h5.4L19 20H5z'), p('M7.5 12h9'), p('M3 20h18')],
  paw: [c(6, 9, 2), c(10, 5, 2), c(14, 5, 2), c(18, 9, 2), p('M8 17c0-2.8 1.8-5 4-5s4 2.2 4 5c0 1.7-1.3 3-3 3h-2c-1.7 0-3-1.3-3-3z')],
  sidewalk: [p('M2 18h20'), p('M4 18v-4h7l2 2 2-2h5v4')],
  more: [c(5, 12, 1.8), c(12, 12, 1.8), c(19, 12, 1.8)],
  phone: [p('M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z')],
  sparkles: [p('M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z'), p('M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z')],
  'eye-off': [p('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z'), p('M3 3l18 18')],
  whatsapp: [p('M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z')],
  x: [p('M18 6L6 18'), p('M6 6l12 12')],
  image: [r(3, 3, 18, 18, 2), c(9, 9, 2), p('M21 15l-5-5L5 21')],
  locate: [c(12, 12, 7), c(12, 12, 2), p('M2 12h3'), p('M19 12h3'), p('M12 2v3'), p('M12 19v3')],
  info: [c(12, 12, 10), p('M12 16v-4'), p('M12 8h.01')],
  flame: [p('M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z')],
  calendar: [r(3, 4, 18, 18, 2), p('M16 2v4'), p('M8 2v4'), p('M3 10h18')],
  refresh: [p('M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8'), p('M21 3v5h-5'), p('M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16'), p('M8 16H3v5')],
};

/** Icons drawn filled instead of stroked. */
export const FILLED_ICONS: ReadonlySet<IconName> = new Set<IconName>(['more', 'play']);

/** Directional icons mirror in RTL; objects never do. */
export const DIRECTIONAL_ICONS: ReadonlySet<IconName> = new Set<IconName>(['arrow-back', 'arrow-forward', 'chevron', 'play']);
