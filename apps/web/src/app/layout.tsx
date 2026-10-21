import type { Metadata, Viewport } from 'next';
import { Aref_Ruqaa, IBM_Plex_Sans_Arabic, Readex_Pro } from 'next/font/google';
import './globals.css';

const readex = Readex_Pro({ subsets: ['arabic', 'latin'], weight: ['500', '600', '700'], variable: '--font-readex', display: 'swap' });
const plex = IBM_Plex_Sans_Arabic({ subsets: ['arabic', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex', display: 'swap' });
const ruqaa = Aref_Ruqaa({ subsets: ['arabic', 'latin'], weight: ['700'], variable: '--font-ruqaa-face', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'فيكس ذا سيتي', template: '%s · فيكس ذا سيتي' },
  description: 'بلّغ عن مشاكل الشارع، تابعها لحد ما تتصلّح، واحجز خدمات الحي.',
  icons: { icon: '/brand/fixthecity-mark.svg' },
};

export const viewport: Viewport = { themeColor: '#C8102E', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${readex.variable} ${plex.variable} ${ruqaa.variable}`}>
      <body>{children}</body>
    </html>
  );
}
