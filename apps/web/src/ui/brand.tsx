/* eslint-disable @next/next/no-img-element -- the brand SVGs are tiny static files; next/image adds nothing here */

/** Arabic lockup from docs/design/assets (never redrawn). */
export function Logo({ height = 40 }: { height?: number }) {
  return <img src="/brand/cityfix-lockup-ar.svg" alt="سيتي فيكس" height={height} style={{ height, width: 'auto' }} />;
}

export function LogoMark({ size = 48 }: { size?: number }) {
  return <img src="/brand/cityfix-mark.svg" alt="" width={size} height={size} />;
}

export function Skyline({ className }: { className?: string }) {
  return <img className={className} src="/brand/cairo-skyline.svg" alt="" />;
}

/** Gold medal with red and black ribbon tails (same drawing as the app's MedalIcon). */
export function MedalIcon({ size = 56 }: { size?: number }) {
  return (
    <svg className="medal" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <path d="M20 34 L12 60 L22 54 L28 62 L32 38 Z" fill="#C8102E" />
      <path d="M44 34 L52 60 L42 54 L36 62 L32 38 Z" fill="#161616" />
      <circle cx="32" cy="24" r="20" fill="#D4A20B" />
      <circle cx="32" cy="24" r="14.5" fill="none" stroke="#7A5A00" strokeWidth="1.5" />
      <path d="M32 14.5l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2-4.6-4.4 6.3-.9z" fill="#161616" />
    </svg>
  );
}

/** What the pin's white disc shows, so a status is never colour only (same glyphs as docs/design/screens/web/Map.html). */
export type PinGlyph = 'dot' | 'arrow' | 'clock' | 'check' | 'alert';

/** Inner drawing of each glyph on the 64 x 64 pin (the disc is centred at 32 26.5). */
const glyphMarkup = (glyph: PinGlyph, color: string): string => {
  switch (glyph) {
    case 'arrow':
      return `<path d="M25 26.5h13M33 20.5l-6 6 6 6" fill="none" stroke="${color}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'clock':
      return `<path d="M32 19v8l5.5 3.5" fill="none" stroke="${color}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'check':
      return `<path d="M26 26.8l4.4 4.4 8-8.6" fill="none" stroke="${color}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'alert':
      return `<path d="M32 19v9" stroke="${color}" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="34" r="2.4" fill="${color}"/>`;
    default:
      return `<circle cx="32" cy="26.5" r="5" fill="${color}"/>`;
  }
};

const pinBody = (color: string, glyph: PinGlyph) =>
  `<path d="M32 4C19.3 4 9 14.1 9 26.8 9 42.6 32 60 32 60s23-17.4 23-33.2C55 14.1 44.7 4 32 4z" fill="${color}"/><circle cx="32" cy="26.5" r="12.5" fill="#fff"/>${glyphMarkup(glyph, color)}`;

/** Map pin in a status colour with its status glyph (map list). The markup is built here from fixed shapes and token colours. */
export function PinIcon({ color, glyph = 'dot', className }: { color: string; glyph?: PinGlyph; className?: string }) {
  return <svg className={className} viewBox="0 0 64 64" aria-hidden="true" dangerouslySetInnerHTML={{ __html: pinBody(color, glyph) }} />;
}

/** Same pin as an SVG string, for Leaflet markers. */
export const pinSvg = (color: string, glyph: PinGlyph = 'dot') =>
  `<svg viewBox="0 0 64 64" width="34" height="38" aria-hidden="true">${pinBody(color, glyph)}</svg>`;
