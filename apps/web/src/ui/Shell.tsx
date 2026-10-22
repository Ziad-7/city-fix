'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './brand';
import { Icon } from './Icon';
import { Toast, useToast } from './toast';

const NAV = [
  { href: '/', label: 'الرئيسية' },
  { href: '/map', label: 'الخريطة' },
  { href: '/requests', label: 'طلباتي' },
  { href: '/services', label: 'الخدمات' },
] as const;

const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`));

export const NOTIFICATIONS_SOON = 'الإشعارات قريبًا. لحد ما تنزل، تابع طلباتك من تبويب طلباتي.';

/** Desktop top bar: logo, nav, gold report button, bell, account. Bottom tabs replace the nav on phones. */
export function TopBar() {
  const path = usePathname();
  const show = useToast((s) => s.show);
  return (
    <header className="ftc-web-topbar">
      <div className="ftc-web-topbar__inner w-top">
        <Link className="w-logo" href="/" aria-label="سيتي فيكس"><Logo /></Link>
        <nav className="w-nav" aria-label="التنقل الرئيسي">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={isActive(path, n.href) ? 'page' : undefined}>{n.label}</Link>
          ))}
        </nav>
        <div className="w-actions">
          <Link className="ftc-btn ftc-btn--gold ftc-btn--sm w-cta" href="/report/category">
            <Icon name="camera" size={20} strokeWidth={2} />بلّغ عن مشكلة
          </Link>
          <button className="w-iconbtn" type="button" aria-label="الإشعارات" onClick={() => show(NOTIFICATIONS_SOON)}>
            <Icon name="bell" size={22} />
          </button>
          <Link className="w-account" href="/profile" aria-current={isActive(path, '/profile') ? 'page' : undefined}>
            <span className="w-avatar"><Icon name="user" size={18} /></span>
            <span className="w-account__t">حسابي</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Phone-width bottom tab bar with the gold report button in the middle (same as the app). */
export function TabBar() {
  const path = usePathname();
  const tab = (href: string, label: string, icon: Parameters<typeof Icon>[0]['name']) => (
    <Link href={href} aria-current={isActive(path, href) ? 'page' : undefined}>
      <Icon name={icon} size={22} />
      {label}
    </Link>
  );
  return (
    <nav className="ftc-tabbar w-tabbar" aria-label="التنقل الرئيسي">
      {tab('/', 'الرئيسية', 'home')}
      {tab('/map', 'الخريطة', 'map')}
      <Link className="ftc-fab w-fab" href="/report/category" aria-label="بلّغ عن مشكلة">
        <Icon name="camera" size={26} strokeWidth={2} />
      </Link>
      {tab('/requests', 'طلباتي', 'clipboard')}
      {tab('/profile', 'حسابي', 'user')}
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="w-foot">
      <span>CityFix · النسخة ١٫٠</span>
      <span>بلّغ.. وإحنا نتابع لحد ما تتصلّح</span>
      <a href="/smart-bin-simulator.html">محاكاة الحاويات الذكية</a>
    </footer>
  );
}

/** Top bar + page + footer + bottom tabs. `bare` drops the footer (full-height map). */
export function AppShell({ children, bare }: { children: React.ReactNode; bare?: boolean }) {
  return (
    <>
      <a className="a-skip" href="#main">اتنقل للمحتوى</a>
      <TopBar />
      {children}
      {bare ? null : <Footer />}
      <TabBar />
      <Toast />
    </>
  );
}
