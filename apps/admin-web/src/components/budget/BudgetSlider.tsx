'use client';

import { FilterChip } from '@/components/ui';
import { formatBudget, formatThousands } from '@/lib/format';

export interface BudgetSliderProps {
  valueEgp: number;
  onChange: (egp: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unlimitedEgp?: number;
  busy?: boolean;
}

export function BudgetSlider({
  valueEgp,
  onChange,
  min = 50000,
  max = 600000,
  step = 1000,
  unlimitedEgp,
  busy,
}: BudgetSliderProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'PageUp') {
      e.preventDefault();
      onChange(Math.min(max, valueEgp + 10000));
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      onChange(Math.max(min, valueEgp - 10000));
    }
  };

  return (
    <section className="ftc-card budget-card" aria-label="الميزانية">
      <div className="budget-top">
        <label htmlFor="budget">الميزانية المتاحة</label>
        <span className="budget-value num" aria-live="polite">
          {formatBudget(valueEgp)}
        </span>
        <div className="budget-presets" role="group" aria-label="ميزانيات جاهزة">
          <FilterChip
            label="تقشّف · 150 ألف"
            pressed={valueEgp === 150000}
            onClick={() => onChange(150000)}
          />
          <FilterChip
            label="الميزانية الحالية · 300 ألف"
            pressed={valueEgp === 300000}
            onClick={() => onChange(300000)}
          />
          <FilterChip
            label={`بدون حد · ${unlimitedEgp ? formatThousands(unlimitedEgp) : '…'}`}
            pressed={unlimitedEgp != null && valueEgp >= unlimitedEgp}
            disabled={unlimitedEgp == null}
            onClick={() => unlimitedEgp && onChange(unlimitedEgp)}
          />
        </div>
      </div>
      <input
        id="budget"
        type="range"
        min={min}
        max={max}
        step={step}
        value={valueEgp}
        aria-valuetext={formatBudget(valueEgp)}
        onChange={(e) => onChange(Number(e.target.value))}
        onKeyDown={handleKeyDown}
        disabled={busy}
      />
      <div className="budget-scale">
        <span>50 ألف جنيه</span>
        <span>600 ألف جنيه</span>
      </div>
    </section>
  );
}
