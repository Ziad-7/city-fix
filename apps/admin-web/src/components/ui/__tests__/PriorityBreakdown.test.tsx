import { render } from '@testing-library/react';
import { PriorityBreakdown } from '../PriorityBreakdown';
import { computePriority } from '@/logic/priority';
import { describe, it, expect } from 'vitest';

describe('PriorityBreakdown', () => {
  it('displays score correctly', () => {
    const priority = computePriority({
      severity: 'high',
      nearSensitivePlace: true,
      reporters: 5,
      daysOpen: 2,
      targetDays: 3,
      areaUnderserved: true,
    });

    const { container } = render(<PriorityBreakdown priority={priority} variant="full" />);
    const scoreElement = container.querySelector('.score-big b');
    expect(scoreElement).toHaveTextContent(priority.score.toString());
  });

  it('factor points sum equals score (capped at 100)', () => {
    const priority = computePriority({
      severity: 'critical',
      nearSensitivePlace: true,
      reporters: 10,
      daysOpen: 10,
      targetDays: 3,
      areaUnderserved: true,
    });

    const summedPoints = Math.min(100, priority.factors.reduce((s, f) => s + f.points, 0));
    expect(summedPoints).toBe(priority.score);
  });

  it('renders level label in full variant', () => {
    const priority = computePriority({
      severity: 'high',
      nearSensitivePlace: false,
      reporters: 1,
      daysOpen: 1,
      targetDays: 3,
      areaUnderserved: false,
    });

    const { container } = render(<PriorityBreakdown priority={priority} variant="full" />);
    // Should render the level label (e.g., "أولوية عالية")
    expect(container.textContent).toContain('أولوية');
  });

  it('renders factors in compact variant', () => {
    const priority = computePriority({
      severity: 'medium',
      nearSensitivePlace: true,
      reporters: 3,
      daysOpen: 1,
      targetDays: 5,
      areaUnderserved: false,
    });

    const { container } = render(
      <PriorityBreakdown
        priority={priority}
        variant="compact"
        labelByKey={{
          severity: 'خطورة',
          sensitive: 'قريب',
          reporters: 'بلاغات',
          age: 'عمر',
          equity: 'منطقة',
        }}
      />,
    );

    // Should render the compact format
    expect(container.querySelector('.pf')).toBeInTheDocument();
    expect(container.querySelector('.pf-head')).toBeInTheDocument();
  });
});
