import type { SVGProps } from 'react';
import { ALL_ICON_SHAPES, type AdminIconName } from './admin-icon-shapes';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'title'> {
  name: AdminIconName;
  size?: number;
  title?: string;
}

const FILLED_ICONS = new Set(['more', 'play']);
const DIRECTIONAL_ICONS = new Set(['arrow-back', 'arrow-forward', 'chevron', 'chevron-down', 'chevron-left']);

export function Icon({ name, size = 20, className = '', title, ...props }: IconProps) {
  const shapes = ALL_ICON_SHAPES[name as keyof typeof ALL_ICON_SHAPES];
  if (!shapes) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }

  const isFilled = FILLED_ICONS.has(name);
  const isDirectional = DIRECTIONAL_ICONS.has(name) && name !== 'chevron-left';

  const classes = [
    className,
    isDirectional && 'rtl:-scale-x-100',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      {...props}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={isFilled ? 'currentColor' : 'none'}
      stroke={isFilled ? 'none' : 'currentColor'}
      strokeWidth={isFilled ? undefined : 1.75}
      strokeLinecap={isFilled ? undefined : 'round'}
      strokeLinejoin={isFilled ? undefined : 'round'}
      aria-hidden={!title}
      role={title ? 'img' : undefined}
      aria-label={title}
      className={classes}
    >
      {shapes.map((shape: readonly unknown[], idx: number) => {
        const [type, ...args] = shape;
        if (type === 'p') {
          return <path key={idx} d={args[0] as string} />;
        }
        if (type === 'c') {
          return <circle key={idx} cx={args[0] as number} cy={args[1] as number} r={args[2] as number} />;
        }
        if (type === 'r') {
          return (
            <rect
              key={idx}
              x={args[0] as number}
              y={args[1] as number}
              width={args[2] as number}
              height={args[3] as number}
              rx={args[4] as number}
            />
          );
        }
        if (type === 'e') {
          return (
            <ellipse
              key={idx}
              cx={args[0] as number}
              cy={args[1] as number}
              rx={args[2] as number}
              ry={args[3] as number}
            />
          );
        }
        return null;
      })}
    </svg>
  );
}
