import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const readex = localFont({
  src: './fonts/ReadexPro.ttf',
  weight: '500 700',
  variable: '--font-readex',
  display: 'swap',
});
const plex = localFont({
  src: [
    { path: './fonts/IBMPlexSansArabic-Regular.ttf', weight: '400' },
    { path: './fonts/IBMPlexSansArabic-Medium.ttf', weight: '500' },
    { path: './fonts/IBMPlexSansArabic-SemiBold.ttf', weight: '600' },
    { path: './fonts/IBMPlexSansArabic-Bold.ttf', weight: '700' },
  ],
  variable: '--font-plex',
  display: 'swap',
});
const ruqaa = localFont({
  src: './fonts/ArefRuqaa-Bold.ttf',
  weight: '700',
  variable: '--font-ruqaa-face',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'سيتي فيكس', template: '%s · سيتي فيكس' },
  description: 'بلّغ عن مشاكل الشارع، تابعها لحد ما تتصلّح، واحجز خدمات الحي.',
  icons: { icon: '/brand/cityfix-mark.svg' },
};

export const viewport: Viewport = { themeColor: '#C8102E', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${readex.variable} ${plex.variable} ${ruqaa.variable}`}>
      <body>{children}</body>
    </html>
  );
}
