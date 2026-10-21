import type { Priority } from '@/domain/types';
import { priorityLevel } from '@/logic/priority';
import { Icon } from '../Icon';
import { StatusChip } from './StatusChip';

export interface PriorityBreakdownProps {
  priority: Priority;
  variant: 'full' | 'compact';
  whyByKey?: Record<string, string>;
  labelByKey?: Record<string, string>;
  reason?: string;
}

export function PriorityBreakdown({ priority, variant, whyByKey, labelByKey, reason }: PriorityBreakdownProps) {
  const { score, factors } = priority;
  const level = priorityLevel(score);

  if (variant === 'compact') {
    return (
      <div className="pf">
        <div className="pf-head">
          <span className="strong small">سبب الأولوية</span>
          <span className="pf-score num">
            {score}
            <small> / 100</small>
          </span>
        </div>
        {factors.map((f) => (
          <div className="pf-row" key={f.key}>
            <span className="nm">{labelByKey?.[f.key] || f.label}</span>
            <span className="ftc-bar" style={{ background: 'var(--ftc-paper)' }}>
              <span style={{ width: `${(f.points / f.max) * 100}%` }} />
            </span>
            <span className="pts">+{f.points}</span>
          </div>
        ))}
      </div>
    );
  }

  // full variant
  return (
    <>
      <div className="score-big" aria-label={`الأولوية ${score} من 100`}>
        <b className={['num', level === 'medium' && 'is-mid', level === 'low' && 'is-low'].filter(Boolean).join(' ')}>
          {score}
        </b>
        <span>/ 100</span>
        <span style={{ marginInlineStart: '8px' }}>
          <StatusChip kind="priority" score={score} levelOnly />
        </span>
      </div>
      {reason && level !== 'low' && (
        <div className={['ftc-notice', 'reason', score >= 65 && 'ftc-notice--danger'].filter(Boolean).join(' ')}>
          <Icon name="alert-triangle" size={20} />
          <span>{reason}</span>
        </div>
      )}
      <div className="factors">
        {factors.map((f) => (
          <div className="factor" key={f.key}>
            <span className="nm">{f.label}</span>
            <span className="ftc-bar" role="img" aria-label={`${f.points} من ${f.max}`}>
              <span style={{ width: `${(f.points / f.max) * 100}%` }} />
            </span>
            <span className="pts">
              +{f.points} <small>/ {f.max}</small>
            </span>
            {whyByKey?.[f.key] && <span className="why">{whyByKey[f.key]}</span>}
          </div>
        ))}
      </div>
    </>
  );
}
