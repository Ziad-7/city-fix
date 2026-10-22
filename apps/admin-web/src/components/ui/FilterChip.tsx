import { formatNumber } from '@/lib/format';

export interface FilterChipProps {
  label: string;
  pressed: boolean;
  onClick: () => void;
  count?: number;
  disabled?: boolean;
}

export function FilterChip({ label, pressed, onClick, count, disabled }: FilterChipProps) {
  return (
    <button type="button" className="ftc-filter" aria-pressed={pressed} onClick={onClick} disabled={disabled}>
      {label}
      {count != null && <span className="c">{formatNumber(count)}</span>}
    </button>
  );
}

export interface FilterChipGroupProps {
  children: React.ReactNode;
  ariaLabel: string;
}

export function FilterChipGroup({ children, ariaLabel }: FilterChipGroupProps) {
  return (
    <div className="chips" role="group" aria-label={ariaLabel}>
      {children}
    </div>
  );
}
