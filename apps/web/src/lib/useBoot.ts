'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { refreshAll, useIsSignedIn, useReports, useSession, useSessionHydrated } from '@/store';
import { useToast } from '@/ui/toast';
import { toArabicDigits } from '@/utils/digits';
import { useOutbox } from './outbox';

/**
 * Guards the signed-in pages: waits for the saved session, sends signed-out visitors to /sign-in
 * (remembering where they were going), loads reports, incidents and service requests once, and sends
 * reports that were saved offline as soon as the connection is back.
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

  const userId = useSession((s) => s.userId);
  useEffect(() => {
    if (!signedIn || !userId || status !== 'ready') return;
    const { load, flush } = useOutbox.getState();
    load();
    const send = async () => {
      const sent = await flush(userId);
      if (sent > 0) useToast.getState().show(sent === 1 ? 'البلاغ اللي كان مستني النت اتبعت' : `اتبعت ${toArabicDigits(sent)} بلاغات كانت مستنية النت`);
    };
    void send();
    window.addEventListener('online', send);
    return () => window.removeEventListener('online', send);
  }, [signedIn, userId, status]);

  return hydrated && signedIn ? 'ready' : 'loading';
}
