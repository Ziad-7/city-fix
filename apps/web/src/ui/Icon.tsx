import type { CSSProperties } from 'react';
import { DIRECTIONAL_ICONS, FILLED_ICONS, ICON_SHAPES } from '@/components/icon-shapes';
import type { IconName } from '@/domain/types';

export type IconProps = {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
};

/** Lucide-style SVG icon from the app's shared shapes. Directional icons mirror in RTL, like the app. */
export function Icon({ name, size = 22, strokeWidth = 1.75, className, style }: IconProps) {
  const filled = FILLED_ICONS.has(name);
  const mirror = DIRECTIONAL_ICONS.has(name);
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={[mirror ? 'flip' : '', className ?? ''].join(' ').trim() || undefined}
      style={style}
    >
      {ICON_SHAPES[name].map((s, i) => {
        switch (s[0]) {
          case 'p':
            return <path key={i} d={s[1]} />;
          case 'c':
            return <circle key={i} cx={s[1]} cy={s[2]} r={s[3]} />;
          case 'r':
            return <rect key={i} x={s[1]} y={s[2]} width={s[3]} height={s[4]} rx={s[5]} />;
          case 'e':
            return <ellipse key={i} cx={s[1]} cy={s[2]} rx={s[3]} ry={s[4]} />;
        }
      })}
    </svg>
  );
}
