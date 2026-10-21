import type { AppNotification } from '@/domain/types';

// Web version of apps/mobile/src/notifications/os.ts. The website has no OS notification centre: the shared
// notification store (apps/mobile/src/store/useNotifications.ts) still records status changes, nothing is shown.

/** No-op on the web (never throws). */
export async function showLocalNotification(_n: Pick<AppNotification, 'title' | 'body' | 'entityId'>): Promise<void> {}
