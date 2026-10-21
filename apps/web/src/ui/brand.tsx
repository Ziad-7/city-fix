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

/** Map pin in a status colour (map list and Leaflet markers). */
export function PinIcon({ color, className }: { color: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 4C19.3 4 9 14.1 9 26.8 9 42.6 32 60 32 60s23-17.4 23-33.2C55 14.1 44.7 4 32 4z" fill={color} />
      <circle cx="32" cy="26.5" r="12.5" fill="#fff" />
      <circle cx="32" cy="26.5" r="5" fill={color} />
    </svg>
  );
}

export const pinSvg = (color: string) =>
  `<svg viewBox="0 0 64 64" width="34" height="38" aria-hidden="true"><path d="M32 4C19.3 4 9 14.1 9 26.8 9 42.6 32 60 32 60s23-17.4 23-33.2C55 14.1 44.7 4 32 4z" fill="${color}"/><circle cx="32" cy="26.5" r="12.5" fill="#fff"/><circle cx="32" cy="26.5" r="5" fill="${color}"/></svg>`;
