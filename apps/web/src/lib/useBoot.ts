'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { refreshAll, useIsSignedIn, useOutboxSync, useReports, useSessionHydrated } from '@/store';
import { useOutbox } from '@/store/useOutbox';
import { useToast } from '@/ui/toast';

/**
 * Guards the signed-in pages: waits for the saved session, sends signed-out visitors to /sign-in
 * (remembering where they were going), loads reports, incidents and service requests once, and sends
 * reports that were saved offline as soon as the connection is back (shared outbox).
 */
export function useBoot(): 'loading' | 'ready' {
  const hydrated = useSessionHydrated();
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

  return hydrated && signedIn ? 'ready' : 'loading';
}
