'use client';

import { Icon } from '../Icon';
import { MAX_KG, MIN_KG, formatKg, stepKg } from '@/domain/citycycle';
import { useTr } from '@/i18n';

type Props = { value: number; onChange: (kg: number) => void; testId?: string };

/** − 2 kg + : half-kilo steps, big touch targets. */
export function KgStepper({ value, onChange, testId }: Props) {
  const tr = useTr();
  return (
    <div className="cc-stepper" data-testid={testId}>
      <button
        type="button"
        className="cc-stepper-btn"
        aria-label={tr('أقل', 'Less')}
        disabled={value <= MIN_KG}
        onClick={() => onChange(stepKg(value, -1))}
        data-testid={testId ? `${testId}-minus` : undefined}
      >
        <span className="cc-stepper-minus" aria-hidden="true" />
      </button>
      <span className="cc-stepper-value" aria-live="polite">{formatKg(value)}</span>
      <button
        type="button"
        className="cc-stepper-btn"
        aria-label={tr('أكتر', 'More')}
        disabled={value >= MAX_KG}
        onClick={() => onChange(stepKg(value, 1))}
        data-testid={testId ? `${testId}-plus` : undefined}
      >
        <Icon name="plus" size={20} strokeWidth={2.5} />
      </button>
    </div>
  );
}
