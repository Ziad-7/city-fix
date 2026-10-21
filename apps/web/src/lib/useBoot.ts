'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { refreshAll, useIsSignedIn, useReports, useSessionHydrated } from '@/store';

/**
 * Guards the signed-in pages: waits for the saved session, sends signed-out visitors to /sign-in
 * (remembering where they were going), and loads reports, incidents and service requests once.
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

  return hydrated && signedIn ? 'ready' : 'loading';
}
