import type { Href } from 'expo-router';

/**
 * Routes owned by other CityCycle tracks (citizen pickup, sorting guide, impact). Typed routes are off in this app,
 * so a plain string works; the casts keep this file compiling if `experiments.typedRoutes` is turned on before those
 * screens are merged. Use these helpers instead of repeating the paths.
 */
const href = (path: string) => path as Href;

export const RECYCLE_NEW = href('/recycle/new');
export const RECYCLE_GUIDE = href('/recycle/guide');
export const IMPACT = href('/impact');
export const binHref = (id: string): Href => href(`/bins/${encodeURIComponent(id)}`);
