import { formatNumber } from '@/lib/format';
import { Tag } from './Tag';
import { StatusChip } from './StatusChip';

export interface HBarRow {
  key: string;
  label: React.ReactNode;
  value: number;
  danger?: boolean;
}

export interface HBarChartProps {
  rows: HBarRow[];
  ariaLabel: string;
}

export function HBarChart({ rows, ariaLabel }: HBarChartProps) {
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <ul className="hbars" aria-label={ariaLabel}>
      {rows.map((r) => {
        const pct = Math.max(3, (r.value / max) * 100);
        return (
          <li key={r.key}>
            <span className="lbl">
              {r.label}
              {r.danger && <Tag tone="danger">خطر</Tag>}
            </span>
            <span className="ftc-bar" aria-hidden="true">
              <span style={{ width: `${pct}%` }} />
            </span>
            <span className="val">{formatNumber(r.value)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export interface StackSegment {
  key: 'received' | 'assigned' | 'progress' | 'resolved';
  value: number;
}

export interface StackBarProps {
  segments: StackSegment[];
  ariaLabel: string;
}

export function StackBar({ segments, ariaLabel }: StackBarProps) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  return (
    <div className="stackbar" role="img" aria-label={ariaLabel}>
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <span key={s.key} className={`seg--${s.key}`} style={{ width: `${(s.value / total) * 100}%` }} />
        ))}
    </div>
  );
}

export interface LegendRowsProps {
  segments: StackSegment[];
}

export function LegendRows({ segments }: LegendRowsProps) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  return (
    <ul className="legend-rows">
      {segments.map((s) => (
        <li key={s.key}>
          <StatusChip kind="incident" status={s.key === 'progress' ? 'in_progress' : s.key} />
          <span className="n">{formatNumber(s.value)}</span>
          <span className="p">{Math.round((s.value / total) * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}
