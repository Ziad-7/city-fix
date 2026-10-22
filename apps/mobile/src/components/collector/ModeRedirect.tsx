import { router, usePathname, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';
import { useMode } from '@/store/useSession';
import { modeRedirect } from './logic';

/**
 * Keeps the screens in step with the mode (render it once in the root layout, after the navigator):
 * collector mode on a citizen tab -> the collector home; citizen mode inside /collector -> the citizen home.
 * Other routes (deep links, a request opened from a notification) are not touched.
 */
export function ModeRedirect({ enabled }: { enabled: boolean }) {
  const mode = useMode();
  const pathname = usePathname();
  const navReady = !!useRootNavigationState()?.key;
  useEffect(() => {
    if (!enabled || !navReady) return;
    const to = modeRedirect(pathname, mode);
    if (to) router.replace(to as never);
  }, [enabled, navReady, mode, pathname]);
  return null;
}
