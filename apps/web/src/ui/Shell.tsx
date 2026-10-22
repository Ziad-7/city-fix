'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDocumentLang } from '@/lib/useDocumentLang';
import { useTr } from '@/i18n';
import { useUnreadCount } from '@/store';
import { localDigits } from '@/utils/digits';
import { Logo } from './brand';
import { Icon } from './Icon';
import { LangToggle } from './LangToggle';
import { Toast } from './toast';

const NAV = [
  { href: '/', ar: 'الرئيسية', en: 'Home' },
  { href: '/map', ar: 'الخريطة', en: 'Map' },
  { href: '/requests', ar: 'طلباتي', en: 'My requests' },
  { href: '/services', ar: 'الخدمات', en: 'Services' },
  { href: '/services/recycling', ar: 'تدوير', en: 'Recycling' },
] as const;

const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`));

/** Services stays highlighted on its own pages, but not on the recycling page (that has its own item). */
const isNavActive = (path: string, href: string) =>
  href === '/services' ? isActive(path, href) && !isActive(path, '/services/recycling') : isActive(path, href);

/** Desktop top bar: logo, nav, gold report button, bell, account. Bottom tabs replace the nav on phones. */
export function TopBar() {
  const path = usePathname();
  const tr = useTr();
  const unread = useUnreadCount();
  return (
    <header className="ftc-web-topbar">
      <div className="ftc-web-topbar__inner w-top">
        <Link className="w-logo" href="/" aria-label={tr('سيتي فيكس', 'CityFix')}><Logo /></Link>
        <nav className="w-nav" aria-label={tr('التنقل الرئيسي', 'Main navigation')}>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={isNavActive(path, n.href) ? 'page' : undefined}>{tr(n.ar, n.en)}</Link>
          ))}
        </nav>
        <div className="w-actions">
          <Link className="ftc-btn ftc-btn--gold ftc-btn--sm w-cta" href="/report/category">
            <Icon name="camera" size={20} strokeWidth={2} />{tr('بلّغ عن مشكلة', 'Report a problem')}
          </Link>
          <LangToggle className="w-lang" />
          <Link
            className="w-iconbtn"
            href="/notifications"
            data-testid="bell"
            aria-label={unread > 0 ? tr(`الإشعارات، ${localDigits(unread)} جديد`, `Notifications, ${unread} unread`) : tr('الإشعارات', 'Notifications')}
            aria-current={isActive(path, '/notifications') ? 'page' : undefined}
          >
            <Icon name="bell" size={22} />
            {unread > 0 ? <span className="w-badge" data-testid="bell-badge" aria-hidden="true">{unread > 99 ? `${localDigits(99)}+` : localDigits(unread)}</span> : null}
          </Link>
          <Link className="w-account" href="/profile" aria-current={isActive(path, '/profile') ? 'page' : undefined}>
            <span className="w-avatar"><Icon name="user" size={18} /></span>
            <span className="w-account__t">{tr('حسابي', 'Account')}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Phone-width bottom tab bar with the gold report button in the middle (same as the app). */
export function TabBar() {
  const path = usePathname();
  const tr = useTr();
  const tab = (href: string, label: string, icon: Parameters<typeof Icon>[0]['name']) => (
    <Link href={href} aria-current={isActive(path, href) ? 'page' : undefined}>
      <Icon name={icon} size={22} />
      {label}
    </Link>
  );
  return (
    <nav className="ftc-tabbar w-tabbar" aria-label={tr('التنقل الرئيسي', 'Main navigation')}>
      {tab('/', tr('الرئيسية', 'Home'), 'home')}
      {tab('/map', tr('الخريطة', 'Map'), 'map')}
      <Link className="ftc-fab w-fab" href="/report/category" aria-label={tr('بلّغ عن مشكلة', 'Report a problem')}>
        <Icon name="camera" size={26} strokeWidth={2} />
      </Link>
      {tab('/requests', tr('طلباتي', 'My requests'), 'clipboard')}
      {tab('/profile', tr('حسابي', 'Account'), 'user')}
    </nav>
  );
}

export function Footer() {
  const tr = useTr();
  return (
    <footer className="w-foot">
      <span>{tr('CityFix · النسخة ١٫٠', 'CityFix · Version 1.0')}</span>
      <span>{tr('بلّغ.. وإحنا نتابع لحد ما تتصلّح', 'Report it, and we’ll follow it until it’s fixed')}</span>
      <Link href="/recycling-guide">{tr('دليل التدوير', 'Recycling guide')}</Link>
      <a href="/smart-bin-simulator.html">{tr('محاكاة الحاويات الذكية', 'Smart bin simulator')}</a>
    </footer>
  );
}

/** Top bar + page + footer + bottom tabs. `bare` drops the footer (full-height map). */
export function AppShell({ children, bare }: { children: React.ReactNode; bare?: boolean }) {
  const tr = useTr();
  useDocumentLang();
  return (
    <>
      <a className="a-skip" href="#main">{tr('اتنقل للمحتوى', 'Skip to content')}</a>
      <TopBar />
      {children}
      {bare ? null : <Footer />}
      <TabBar />
      <Toast />
    </>
  );
}
