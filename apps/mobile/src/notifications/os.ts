import { Platform } from 'react-native';
import type { AppNotification } from '@/domain/types';
import { colors } from '@/theme/tokens';

export const UPDATES_CHANNEL = 'updates';

const supported = Platform.OS !== 'web';

// Loaded on first use, not at startup: web never needs it, and importing it early has side effects (it also
// keeps Expo Go on Android from logging its remote-push warning before a notification is needed).
type NotificationsModule = typeof import('expo-notifications');
const load = (): NotificationsModule =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('expo-notifications') as NotificationsModule;
let ready = false;

/** Foreground handler (show the banner) and the Android channel. Safe to call repeatedly; no-op on web. */
export async function setupOsNotifications(): Promise<void> {
  if (!supported || ready) return;
  ready = true;
  try {
    const Notifications = load();
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(UPDATES_CHANNEL, {
        name: 'تحديثات البلاغات والطلبات',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: colors.red,
      });
    }
  } catch {
    // Notifications are best effort: the in-app centre still works.
  }
}

/** Asks for permission when it has not been decided yet. Returns true when notifications may be shown. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!supported) return false;
  try {
    const Notifications = load();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Shows a local OS notification right away (never throws). */
export async function showLocalNotification(n: Pick<AppNotification, 'title' | 'body' | 'entityId'>): Promise<void> {
  if (!supported) return;
  try {
    await setupOsNotifications();
    // The first notification is when the permission is needed, if it was not asked for already.
    if (!(await ensureNotificationPermission())) return;
    const Notifications = load();
    await Notifications.scheduleNotificationAsync({
      content: { title: n.title, body: n.body, data: { entityId: n.entityId } },
      trigger: Platform.OS === 'android' ? { channelId: UPDATES_CHANNEL } : null,
    });
  } catch {
    // ignore
  }
}

/**
 * Calls `onOpen(entityId)` when the citizen taps an OS notification. Returns an unsubscribe function.
 * A tap that launched the app from the killed state is delivered too (once), after the navigator has mounted.
 */
export function onNotificationTapped(onOpen: (entityId: string) => void): () => void {
  if (!supported) return () => undefined;
  try {
    const Notifications = load();
    const open = (res: { notification: { request: { content: { data?: Record<string, unknown> | null } } } } | null) => {
      const id = res?.notification.request.content.data?.entityId;
      if (typeof id === 'string') onOpen(id);
    };
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    let coldStart: ReturnType<typeof setTimeout> | null = null;
    const last = Notifications.getLastNotificationResponse?.();
    if (last) {
      Notifications.clearLastNotificationResponse?.();
      coldStart = setTimeout(() => open(last), 0);
    }
    return () => {
      if (coldStart) clearTimeout(coldStart);
      sub.remove();
    };
  } catch {
    return () => undefined;
  }
}
