'use client';

import { usePathname } from 'next/navigation';
import { useTr } from '@/i18n';
import { useBoot } from '@/lib/useBoot';
import { OutboxBanner } from '@/ui/OutboxBanner';
import { AppShell } from '@/ui/Shell';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const tr = useTr();
  const state = useBoot();
  const path = usePathname();
  return (
    <AppShell bare={path === '/map'}>
      {state === 'ready' ? <OutboxBanner /> : null}
      {state === 'ready' ? children : <main id="main" className="ftc-web-main" aria-busy="true"><span className="a-spin a-spin--page" aria-label={tr('بنحمّل', 'Loading')} /></main>}
    </AppShell>
  );
}
