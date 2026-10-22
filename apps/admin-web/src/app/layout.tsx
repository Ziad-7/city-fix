import type { Metadata } from "next";
import { Readex_Pro, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import "./ftc.css";
import Providers from "./providers";

const readex = Readex_Pro({
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-readex",
  display: "swap",
});

const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CityFix — مركز القيادة",
  description: "CityFix command center for city staff",
  icons: { icon: "/brand/cityfix-mark.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${readex.variable} ${plex.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
