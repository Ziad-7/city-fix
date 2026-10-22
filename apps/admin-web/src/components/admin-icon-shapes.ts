import type { Shape } from './icon-shapes';
import { ICON_SHAPES } from './icon-shapes';

const p = (d: string) => ['p', d] as const;
const c = (cx: number, cy: number, r: number) => ['c', cx, cy, r] as const;
const r = (x: number, y: number, w: number, h: number, rx = 0) => ['r', x, y, w, h, rx] as const;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const e = (cx: number, cy: number, rx: number, ry: number) => ['e', cx, cy, rx, ry] as const;

export const ADMIN_EXTRA_SHAPES: Record<string, readonly Shape[]> = {
  grid: [r(3, 3, 7, 7, 1), r(14, 3, 7, 7, 1), r(3, 14, 7, 7, 1), r(14, 14, 7, 7, 1)],
  truck: [
    p('M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2'),
    p('M15 18H9'),
    p('M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14'),
    c(17, 18, 2),
    c(7, 18, 2),
  ],
  wrench: [p('M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.6-.6-2.6z')],
  wallet: [r(2, 6, 20, 12, 2), c(12, 12, 2.5)],
  logout: [p('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4'), p('m16 17 5-5-5-5'), p('M21 12H9')],
  eye: [p('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z'), c(12, 12, 3)],
  'eye-slash': [
    p('M9.88 9.88a3 3 0 1 0 4.24 4.24'),
    p('M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68'),
    p('M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61'),
    p('M2 2l20 20'),
  ],
  lock: [r(3, 11, 18, 11, 2), p('M7 11V7a5 5 0 0 1 10 0v4')],
  send: [p('m22 2-7 20-4-9-9-4z'), p('M22 2 11 13')],
  merge: [c(18, 18, 3), c(6, 6, 3), p('M6 21V9a9 9 0 0 0 9 9')],
  list: [p('M8 6h13'), p('M8 12h13'), p('M8 18h13'), p('M3 6h.01'), p('M3 12h.01'), p('M3 18h.01')],
  'chevron-left': [p('m15 18-6-6 6-6')],
};

export const ALL_ICON_SHAPES = { ...ICON_SHAPES, ...ADMIN_EXTRA_SHAPES };

export type AdminIconName =
  // Mobile base icons
  | 'home' | 'map' | 'camera' | 'clipboard' | 'user' | 'bell'
  | 'arrow-back' | 'arrow-forward' | 'chevron' | 'chevron-down'
  | 'alert-triangle' | 'trash' | 'tree' | 'bulb' | 'mic' | 'play'
  | 'pin' | 'shield-check' | 'wifi' | 'users' | 'share' | 'check' | 'plus'
  | 'search' | 'clock' | 'zap' | 'droplets' | 'pipe' | 'manhole' | 'pothole'
  | 'cone' | 'paw' | 'sparkles' | 'eye-off' | 'whatsapp' | 'x' | 'image'
  | 'locate' | 'info' | 'flame' | 'calendar' | 'refresh' | 'phone' | 'more'
  // Admin extra icons
  | 'grid' | 'truck' | 'wrench' | 'wallet' | 'logout' | 'eye' | 'eye-slash'
  | 'lock' | 'send' | 'merge' | 'list' | 'chevron-left';
