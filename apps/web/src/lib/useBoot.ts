'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { refreshAll, startNotificationSync, useIsSignedIn, useOutboxSync, useReports, usePrefs, useSessionHydrated } from '@/store';
import { useOutbox } from '@/store/useOutbox';
import { useToast } from '@/ui/toast';

/** True once the saved language and display settings are loaded. */
function usePrefsHydrated(): boolean {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (usePrefs.persist.hasHydrated()) setDone(true);
    return usePrefs.persist.onFinishHydration(() => setDone(true));
  }, []);
  return done;
}

/**
 * Guards the signed-in pages: waits for the saved session, sends signed-out visitors to /sign-in
 * (remembering where they were going), loads reports, incidents and service requests once, and sends
 * reports that were saved offline as soon as the connection is back (shared outbox). Also waits for the saved
 * language, so the first screen is already in the right one, and starts the status-change notifications.
 */
export function useBoot(): 'loading' | 'ready' {
  const sessionHydrated = useSessionHydrated();
  const prefsHydrated = usePrefsHydrated();
  const hydrated = sessionHydrated && prefsHydrated;
  const signedIn = useIsSignedIn();
  const status = useReports((s) => s.status);
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (!hydrated) return;
    if (!signedIn) {
      router.replace(path && path !== '/' ? `/sign-in?next=${encodeURIComponent(path)}` : '/sign-in');
      return;
    }
    if (status === 'idle') void refreshAll();
  }, [hydrated, signedIn, status, router, path]);

  // Reports saved while offline go out when the connection is back (page load, `online`, tab visible again).
  useOutboxSync(signedIn && status === 'ready');
  useEffect(() => {
    // Toast for the queue's own outcomes ("بلاغك اتبعت" / a saved report the server refused).
    return useOutbox.subscribe((s, prev) => {
      if (s.notice && s.notice !== prev.notice) useToast.getState().show(s.notice.text);
    });
  }, []);

  // Status-change notifications (the bell and /notifications): diff the report and service-request stores.
  useEffect(() => {
    if (!hydrated || !signedIn) return;
    return startNotificationSync();
  }, [hydrated, signedIn]);

  return hydrated && signedIn ? 'ready' : 'loading';
}
