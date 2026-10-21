'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, clearSession } from '@/lib/session';
import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '@/services/dashboard';

const navItems = [
  { href: '/', label: 'نظرة عامة', icon: 'grid' },
  { href: '/incidents', label: 'البلاغات', icon: 'alert-circle', countKey: 'incidentsOpen' },
  { href: '/map', label: 'الخريطة', icon: 'map' },
  { href: '/service-requests', label: 'طلبات الخدمات', icon: 'truck', countKey: 'serviceRequestsOpen' },
  { href: '/work-orders', label: 'أوامر الشغل', icon: 'wrench' },
  { href: '/budget', label: 'الميزانية', icon: 'wallet', adminOnly: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard', '7d'],
    queryFn: () => getDashboard('7d'),
  });

  // Redirect to login if not authenticated
  if (session === null) {
    // Still hydrating
    return null;
  }

  if (!session) {
    router.replace('/login');
    return null;
  }

  const handleSignOut = () => {
    clearSession();
    router.push('/login');
  };

  return (
    <div className="ftc-admin">
      <aside className="ftc-admin-sidebar">
        <div className="brand">
          <div style={{ width: '32px', height: '32px', backgroundColor: 'var(--ftc-gold)', borderRadius: '8px' }} />
          <div>
            <b>مركز القيادة</b>
            <small>FixTheCity</small>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          {navItems.map((item) => {
            // Hide budget for staff
            if (item.adminOnly && session.role === 'staff') {
              return null;
            }

            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            const count = item.countKey && dashboard ? dashboard.nav[item.countKey as keyof typeof dashboard.nav] : null;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '0 12px',
                  height: '44px',
                  borderRadius: 'var(--ftc-radius-md)',
                }}
              >
                <span className="lbl">{item.label}</span>
                {count !== null && <span className="count">{count}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="sb-user">
          <div className="avatar">{session.name.charAt(0)}</div>
          <div className="who" style={{ minWidth: 0 }}>
            <b>{session.name}</b>
            <small>{session.title}</small>
          </div>
          <button className="out" onClick={handleSignOut} type="button" title="تسجيل الخروج">
            ↪
          </button>
        </div>
      </aside>

      <main className="ftc-admin-main">{children}</main>
    </div>
  );
}
