// Web version of apps/mobile/src/services/network.ts: the browser's own online flag instead of NetInfo.

/** True only when the browser says there is no connection (unknown counts as online: the request decides). */
export async function isOffline(): Promise<boolean> {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}
