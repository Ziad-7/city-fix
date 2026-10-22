'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, clearSession } from '@/lib/session';
import { setUnauthorizedHandler } from '@/lib/http';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDashboard } from '@/services/dashboard';
import { Icon } from './Icon';
import { formatNumber } from '@/lib/format';

const navItems = [
  { href: '/', label: 'نظرة عامة', icon: 'grid' as const },
  { href: '/incidents', label: 'البلاغات', icon: 'alert-triangle' as const, countKey: 'incidentsOpen' },
  { href: '/map', label: 'الخريطة', icon: 'map' as const },
  { href: '/citycycle', label: 'إعادة التدوير', icon: 'list' as const },
  { href: '/bins', label: 'الحاويات الذكية', icon: 'trash' as const },
  { href: '/service-requests', label: 'طلبات الخدمات', icon: 'truck' as const, countKey: 'serviceRequestsOpen' },
  { href: '/work-orders', label: 'أوامر الشغل', icon: 'wrench' as const },
  { href: '/budget', label: 'الميزانية', icon: 'wallet' as const, adminOnly: true },
];

function nameInitial(name: string): string {
  const trimmed = name.startsWith('م. ') ? name.slice(3) : name;
  return trimmed.charAt(0);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  // Register unauthorized handler once
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      queryClient.clear();
      router.replace('/login');
    });
  }, [router, queryClient]);

  // Handle null (no session) - redirect to login
  useEffect(() => {
    if (session === null) {
      router.replace('/login');
    }
  }, [session, router]);

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard', '7d'],
    queryFn: () => getDashboard('7d'),
    enabled: !!session,
    refetchInterval: 60000,
  });

  // Handle undefined (still hydrating) - show skeleton
  if (session === undefined) {
    return (
      <div className="ftc-admin">
        <nav className="ftc-admin-sidebar" aria-label="قائمة مركز القيادة">
          <div className="brand">
            <div className="ftc-skel" style={{ width: '34px', height: '34px' }} />
            <div style={{ flex: 1 }}>
              <div className="ftc-skel" style={{ height: '18px', marginBottom: '4px' }} />
              <div className="ftc-skel" style={{ height: '12px', width: '70%' }} />
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="ftc-skel" style={{ height: '44px' }} />
            ))}
          </div>
        </nav>
        <main className="ftc-admin-main">
          <div className="page">
            <div className="ftc-skel" style={{ height: '32px', width: '200px' }} />
          </div>
        </main>
      </div>
    );
  }

  // Handle null (no session) - show nothing while redirecting
  if (session === null) {
    return null;
  }

  const handleSignOut = () => {
    clearSession();
    queryClient.clear();
    router.replace('/login');
  };

  return (
    <div className="ftc-admin">
      <a href="#main" className="sr-only focus:not-sr-only">
        اقفز للمحتوى
      </a>
      <nav className="ftc-admin-sidebar" aria-label="قائمة مركز القيادة">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/cityfix-mark.svg" alt="" width={34} height={34} />
          <span>
            <b>سيتي فيكس</b>
            <small>{session.district}</small>
          </span>
        </div>

        {navItems.map((item) => {
          // Hide budget for staff
          if (item.adminOnly && session.role !== 'admin') {
            return null;
          }

          const isActive =
            (item.href === '/' && pathname === '/') ||
            (item.href !== '/' && (pathname === item.href || pathname?.startsWith(item.href + '/')));
          const count =
            item.countKey && dashboard
              ? dashboard.nav[item.countKey as keyof typeof dashboard.nav]
              : undefined;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon name={item.icon} size={20} />
              <span className="lbl">{item.label}</span>
              {count != null && <span className="count">{formatNumber(count)}</span>}
            </Link>
          );
        })}

        <div className="sb-user">
          <span className="avatar" aria-hidden="true">
            {nameInitial(session.name)}
          </span>
          <span className="who">
            <b>{session.name}</b>
            <small>{session.title}</small>
          </span>
          <button
            type="button"
            className="out"
            aria-label="تسجيل الخروج"
            title="تسجيل الخروج"
            onClick={handleSignOut}
          >
            <Icon name="logout" size={18} />
          </button>
        </div>
      </nav>

      <main className="ftc-admin-main" id="main">
        <div className="page">{children}</div>
      </main>
    </div>
  );
}
